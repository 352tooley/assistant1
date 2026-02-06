const fs = require('fs');
const path = require('path');

const { runCodex } = require('./agents/codex');
const { runClaude } = require('./agents/claude');
const { classifyFailure } = require('./failureClassifier');

const repoRoot = path.resolve(__dirname, '..');
const acceptancePath = path.join(repoRoot, 'docs', 'ACCEPTANCE.md');
const loopLogPath = path.join(repoRoot, 'docs', 'LOOP_LOG.md');
const headPath = path.join(repoRoot, '.git', 'HEAD');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getBranchName() {
  try {
    const head = readFile(headPath).trim();
    const prefix = 'ref: refs/heads/';
    if (head.startsWith(prefix)) {
      return head.slice(prefix.length);
    }
    return 'detached-head';
  } catch {
    return 'unknown';
  }
}

function getNextCycleNumber() {
  try {
    const log = readFile(loopLogPath);
    const count = log.split('\n').filter((line) => line.trim() === '- Event: Orchestrator cycle').length;
    return count + 1;
  } catch {
    return 1;
  }
}

function extractSectionList(markdown, heading) {
  const lines = markdown.split('\n');
  const results = [];
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === heading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) {
      break;
    }
    if (inSection && line.trim().startsWith('- ')) {
      results.push(line.trim().slice(2));
    }
  }

  return results;
}

/**
 * Task shape:
 * { id: string, type: string, input: any, expectedOutput?: any }
 */
function buildTaskQueue(acceptanceItems) {
  const tasks = [
    {
      id: 'task-success',
      type: 'text_transform',
      input: { text: 'Cycle Three', mode: 'upper' },
      expectedOutput: 'CYCLE THREE',
    },
    {
      id: 'task-fail',
      type: 'compute_sum',
      input: { values: [1, 2, 3] },
      expectedOutput: 10,
    },
  ];

  acceptanceItems.forEach((item, index) => {
    tasks.push({
      id: `acc-${index + 1}`,
      type: 'text_transform',
      input: { text: item, mode: 'upper' },
      expectedOutput: item.toUpperCase(),
    });
  });

  return tasks;
}

function summarize(value) {
  if (value === undefined) {
    return 'none';
  }
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (raw.length <= 120) {
    return raw;
  }
  return `${raw.slice(0, 117)}...`;
}

function buildClaudeReturn(claudeResult, routingLog, escalationReason) {
  routingLog.push('- Agent chosen: Claude');
  routingLog.push(`- Claude result: ${claudeResult.status}`);
  routingLog.push(`- Claude diagnosis: ${summarize(claudeResult.diagnosis)}`);
  routingLog.push(`- Claude proposed fix: ${claudeResult.proposedFix ? claudeResult.proposedFix.strategy : 'none'}`);
  const nextAction = claudeResult.status === 'resolved' ? 'report proposed fix to operator' : 'halt — unresolved';
  routingLog.push(`- Next action: ${nextAction}`);
  return {
    finalAgent: 'Claude',
    result: claudeResult,
    routingLog,
    escalationReason,
    escalationOccurred: true,
    claudeInvoked: true,
  };
}

function runRoutingCycle(task) {
  const routingLog = [];
  let result = null;
  let escalationReason = null;
  const codexOutputs = [];
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    routingLog.push(`- Agent chosen: Codex (attempt ${attempt})`);
    result = runCodex(task);
    const codexSummary = result.output !== undefined ? result.output : result.error;
    routingLog.push(`- Codex result: ${result.status}`);
    routingLog.push(`- Codex output summary: ${summarize(codexSummary)}`);

    if (result.status === 'success') {
      return {
        finalAgent: 'Codex',
        result,
        routingLog,
        escalationReason: null,
        escalationOccurred: false,
        claudeInvoked: false,
      };
    }

    codexOutputs.push(result.output !== undefined ? result.output : null);
    lastError = result.error || 'Unknown failure';

    const classification = classifyFailure({ message: lastError }, task.id);
    routingLog.push(`- Failure classification: ${classification.classification} (count ${classification.count})`);

    if (classification.classification === 'simple') {
      routingLog.push('- Routing decision: retry Codex');
      continue;
    }

    escalationReason = 'complex or repeated failure';
    routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
    const claudeResult = runClaude(task, {
      error: lastError,
      classification: classification.classification,
      failureCount: classification.count,
      codexOutputs,
    });
    return buildClaudeReturn(claudeResult, routingLog, escalationReason);
  }

  escalationReason = 'retries exhausted';
  routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
  const claudeResult = runClaude(task, {
    error: lastError,
    classification: 'complex',
    failureCount: codexOutputs.length,
    codexOutputs,
  });
  return buildClaudeReturn(claudeResult, routingLog, escalationReason);
}

function appendLoopLog(entryLines) {
  let existing = '';
  try {
    existing = readFile(loopLogPath);
  } catch {
    existing = '';
  }

  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  const prefix = needsNewline ? '\n' : '';
  const entry = `${prefix}${entryLines.join('\n')}\n`;
  fs.appendFileSync(loopLogPath, entry, 'utf8');
}

function run() {
  const acceptance = readFile(acceptancePath);
  const initialCriteria = extractSectionList(acceptance, '## Initial Acceptance Criteria');

  const queue = buildTaskQueue(initialCriteria);
  const cycleStart = getNextCycleNumber();
  const branch = getBranchName();

  queue.forEach((task, index) => {
    const cycle = cycleStart + index;
    const routing = runRoutingCycle(task);
    const timestamp = new Date().toISOString();

    const entryLines = [
      '',
      `## ${timestamp}`,
      '- Event: Orchestrator cycle',
      `- Cycle: ${cycle}`,
      `- Branch: \`${branch}\``,
      `- Task id: \`${task.id}\``,
      `- Task type: ${task.type}`,
      `- Acceptance criteria parsed: ${initialCriteria.length}`,
      ...routing.routingLog,
      `- Escalation: ${routing.escalationOccurred ? 'yes' : 'no'}`,
      routing.escalationReason ? `- Escalation reason: ${routing.escalationReason}` : '- Escalation reason: none',
      `- Claude invoked: ${routing.claudeInvoked ? 'true' : 'false'}`,
    ];

    appendLoopLog(entryLines);

    console.log('Cycle:', cycle);
    console.log('Task processed:', task.id);
    console.log('Final agent:', routing.finalAgent);
    console.log('Outcome:', routing.result.status);
  });

  console.log('Acceptance criteria parsed:', initialCriteria.length);
  console.log('Task queue length:', queue.length);
  console.log('Loop log appended:', path.relative(repoRoot, loopLogPath));
}

run();
