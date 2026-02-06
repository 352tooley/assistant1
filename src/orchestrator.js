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

function buildTaskQueue(acceptanceItems) {
  const tasks = [
    {
      id: 'dummy-fail',
      description: 'Simulate one agent cycle with escalation',
      status: 'queued',
      kind: 'dummy',
      forceFailure: true,
    },
  ];

  acceptanceItems.forEach((item, index) => {
    tasks.push({
      id: `acc-${index + 1}`,
      description: item,
      status: 'queued',
      kind: 'acceptance',
    });
  });

  return tasks;
}

function runRoutingCycle(task) {
  const routingLog = [];
  let result = null;
  let agent = 'Codex';
  let escalationReason = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    routingLog.push(`- Agent chosen: Codex (attempt ${attempt})`);
    result = runCodex(task);
    routingLog.push(`- Outcome: ${result.status}`);

    if (result.status === 'success') {
      return {
        finalAgent: 'Codex',
        result,
        routingLog,
      };
    }

    const classification = classifyFailure(result, task.id);
    routingLog.push(`- Failure classification: ${classification.classification} (count ${classification.count})`);

    if (classification.classification === 'simple') {
      routingLog.push('- Routing decision: retry Codex');
      continue;
    }

    escalationReason = 'complex or repeated failure';
    routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
    agent = 'Claude';
    result = runClaude(task);
    routingLog.push(`- Agent chosen: Claude`);
    routingLog.push(`- Outcome: ${result.status}`);
    return {
      finalAgent: agent,
      result,
      routingLog,
      escalationReason,
    };
  }

  escalationReason = 'retries exhausted';
  routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
  result = runClaude(task);
  routingLog.push(`- Agent chosen: Claude`);
  routingLog.push(`- Outcome: ${result.status}`);

  return {
    finalAgent: 'Claude',
    result,
    routingLog,
    escalationReason,
  };
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
  const task = queue[0];
  const cycle = getNextCycleNumber();
  const routing = runRoutingCycle(task);

  const timestamp = new Date().toISOString();
  const branch = getBranchName();

  const entryLines = [
    '',
    `## ${timestamp}`,
    '- Event: Orchestrator cycle',
    `- Cycle: ${cycle}`,
    `- Branch: \`${branch}\``,
    `- Task id: \`${task.id}\``,
    `- Acceptance criteria parsed: ${initialCriteria.length}`,
    ...routing.routingLog,
    routing.escalationReason ? `- Escalation reason: ${routing.escalationReason}` : '- Escalation reason: none',
  ];

  appendLoopLog(entryLines);

  console.log('Acceptance criteria parsed:', initialCriteria.length);
  console.log('Task queue length:', queue.length);
  console.log('Cycle:', cycle);
  console.log('Task processed:', task.id);
  console.log('Final agent:', routing.finalAgent);
  console.log('Outcome:', routing.result.status);
  console.log('Loop log appended:', path.relative(repoRoot, loopLogPath));
}

run();
