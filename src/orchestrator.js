const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { runCodex } = require('./agents/codex');
const { runClaude } = require('./agents/claude');
const { classifyFailure } = require('./failureClassifier');
const { validateFixPacket } = require('./fixPacketValidator');
const {
  runtimePath,
  loadState,
  saveState,
  resetState,
  getNextTask,
  markTaskDispatched,
  markTaskComplete,
  markTaskFailed,
  incrementFailure,
  recordHealingAttempt,
  getHealingAttempts,
} = require('./stateManager');

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
      input: { text: 'Cycle Six', mode: 'upper' },
      expectedOutput: 'CYCLE SIX',
    },
    {
      id: 'task-fail',
      type: 'compute_sum',
      input: { values: [1, 2, 3] },
      expectedOutput: 6,
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

function applyFixPacket(packet, state) {
  if (!packet || packet.proposedFix.strategy !== 'fix-task-definition') {
    return { applied: false, reason: 'Unsupported fix strategy.', filesModified: [] };
  }

  if (!packet.proposedFix.filesToChange.includes('src/orchestrator.js')) {
    return { applied: false, reason: 'Target file not included.', filesModified: [] };
  }

  const targetPath = path.join(repoRoot, 'src', 'orchestrator.js');
  const original = readFile(targetPath);

  const marker = "id: 'task-fail'";
  const markerIndex = original.indexOf(marker);
  if (markerIndex === -1) {
    return { applied: false, reason: 'task-fail definition not found.', filesModified: [] };
  }

  const window = original.slice(markerIndex, markerIndex + 300);
  if (window.includes('expectedOutput: 6')) {
    return { applied: false, reason: 'Fix already applied.', filesModified: [] };
  }
  if (!window.includes('expectedOutput: 10')) {
    return { applied: false, reason: 'Expected output marker not found.', filesModified: [] };
  }

  const updatedWindow = window.replace('expectedOutput: 10', 'expectedOutput: 6');
  const updated = original.slice(0, markerIndex) + updatedWindow + original.slice(markerIndex + window.length);
  fs.writeFileSync(targetPath, updated, 'utf8');

  const taskEntry = state.taskQueue.find((entry) => entry.id === 'task-fail');
  if (taskEntry) {
    taskEntry.expectedOutput = 6;
  }

  return { applied: true, reason: 'Fix applied.', filesModified: ['src/orchestrator.js'] };
}

function runRoutingCycle(task, state) {
  const routingLog = [];
  let result = null;
  let escalationReason = null;
  let lastFailure = null;

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
        claudeStatus: null,
        fixPacket: null,
        lastFailure: null,
      };
    }

    lastFailure = result;
    const failureCount = incrementFailure(state, task.id);
    const classification = classifyFailure({ message: result.error || 'Unknown failure' }, task.id, failureCount);
    routingLog.push(`- Failure classification: ${classification.classification} (count ${classification.count})`);

    if (classification.classification === 'simple') {
      routingLog.push('- Routing decision: retry Codex');
      continue;
    }

    escalationReason = 'complex or repeated failure';
    routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
    const claudeResult = runClaude(task, {
      error: result.error || null,
      classification: classification.classification,
      failureCount: classification.count,
      codexOutputs: result.output !== undefined ? [result.output] : [],
    });
    const claudeSummary = claudeResult.output !== undefined ? claudeResult.output : claudeResult.diagnosis || claudeResult.message;
    const claudeStatus = claudeResult.status === 'success' ? 'resolved' : claudeResult.status;
    const fixPacket =
      claudeResult && claudeResult.diagnosis && claudeResult.proposedFix
        ? {
            diagnosis: claudeResult.diagnosis,
            proposedFix: claudeResult.proposedFix,
          }
        : null;

    routingLog.push('- Agent chosen: Claude');
    routingLog.push(`- Claude result: ${claudeResult.status}`);
    routingLog.push(`- Claude output summary: ${summarize(claudeSummary)}`);
    if (fixPacket) {
      routingLog.push(`- Claude fix packet: ${fixPacket.proposedFix.description}`);
    } else {
      routingLog.push('- Claude fix packet: none');
    }

    return {
      finalAgent: 'Claude',
      result: claudeResult,
      routingLog,
      escalationReason,
      escalationOccurred: true,
      claudeStatus,
      fixPacket,
      lastFailure,
    };
  }

  escalationReason = 'retries exhausted';
  routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
  const claudeResult = runClaude(task, {
    error: lastFailure ? lastFailure.error : null,
    classification: 'complex',
    failureCount: state.failureCounts[task.id] || 0,
    codexOutputs: lastFailure && lastFailure.output !== undefined ? [lastFailure.output] : [],
  });
  const claudeSummary = claudeResult.output !== undefined ? claudeResult.output : claudeResult.diagnosis || claudeResult.message;
  const claudeStatus = claudeResult.status === 'success' ? 'resolved' : claudeResult.status;
  const fixPacket =
    claudeResult && claudeResult.diagnosis && claudeResult.proposedFix
      ? {
          diagnosis: claudeResult.diagnosis,
          proposedFix: claudeResult.proposedFix,
        }
      : null;

  routingLog.push('- Agent chosen: Claude');
  routingLog.push(`- Claude result: ${claudeResult.status}`);
  routingLog.push(`- Claude output summary: ${summarize(claudeSummary)}`);
  if (fixPacket) {
    routingLog.push(`- Claude fix packet: ${fixPacket.proposedFix.description}`);
  } else {
    routingLog.push('- Claude fix packet: none');
  }

  return {
    finalAgent: 'Claude',
    result: claudeResult,
    routingLog,
    escalationReason,
    escalationOccurred: true,
    claudeStatus,
    fixPacket,
    lastFailure,
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

function rerunOrchestrator() {
  const result = spawnSync(process.execPath, [__filename], {
    env: { ...process.env, HEALING_RERUN: '1' },
    encoding: 'utf8',
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (output.includes('HEALING_RESULT=resolved')) {
    return { resolved: true, outputSummary: 'resolved' };
  }
  if (output.includes('HEALING_RESULT=unresolved')) {
    return { resolved: false, outputSummary: 'unresolved' };
  }
  return { resolved: false, outputSummary: 'unknown' };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { reset: false, maxTasks: null };

  args.forEach((arg) => {
    if (arg === '--reset') {
      options.reset = true;
    }
    if (arg.startsWith('--max-tasks=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.maxTasks = value;
      }
    }
  });

  return options;
}

function run() {
  const options = parseArgs();
  const healingDisabled = process.env.HEALING_RERUN === '1';
  const acceptance = readFile(acceptancePath);
  const initialCriteria = extractSectionList(acceptance, '## Initial Acceptance Criteria');

  if (options.reset) {
    resetState();
  }

  const queue = buildTaskQueue(initialCriteria);
  const loadResult = loadState(queue, { reset: options.reset });
  const state = loadResult.state;
  const stateStatus = loadResult.status;

  const cycleStart = getNextCycleNumber();
  const branch = getBranchName();

  let cycleIndex = 0;
  let healingAttempted = false;
  let hadEscalation = false;

  if (options.reset) {
    const timestamp = new Date().toISOString();
    appendLoopLog([
      '',
      `## ${timestamp}`,
      '- Event: State reset',
      `- Branch: \`${branch}\``,
      `- State file: ${runtimePath}`,
    ]);
  }

  let nextTask = getNextTask(state);
  while (nextTask) {
    const { resumed } = markTaskDispatched(state, nextTask.id);
    const cycle = cycleStart + cycleIndex;
    const routing = runRoutingCycle(nextTask, state);
    const timestamp = new Date().toISOString();

    let fixStatus = null;
    let fixFiles = [];
    let healingOutcome = null;
    let stateSaveNote = null;

    if (routing.escalationOccurred) {
      hadEscalation = true;
    }

    let healingTriggered = false;

    if (!healingDisabled && !healingAttempted && routing.escalationOccurred && routing.claudeStatus === 'resolved') {
      healingAttempted = true;
      healingTriggered = true;
      const attemptCount = recordHealingAttempt(state, nextTask.id);
      if (routing.fixPacket) {
        const validation = validateFixPacket(routing.fixPacket);
        if (validation.ok) {
          const applied = applyFixPacket(routing.fixPacket, state);
          fixStatus = applied.applied ? 'accepted' : `rejected (${applied.reason})`;
          fixFiles = applied.filesModified;
          if (applied.applied) {
            saveState(state);
            stateSaveNote = 'pre-rerun';
            const rerun = rerunOrchestrator();
            healingOutcome = rerun.resolved ? 'resolved' : `unresolved (${rerun.outputSummary})`;
          } else {
            healingOutcome = 'unresolved (fix not applied)';
          }
        } else {
          fixStatus = `rejected (${validation.reasons.join('; ')})`;
          healingOutcome = 'unresolved (validation failed)';
        }
      } else {
        fixStatus = 'rejected (no fix packet)';
        healingOutcome = 'unresolved (no fix packet)';
      }
      routing.routingLog.push(`- Healing attempts: ${attemptCount}`);
    }

    if (routing.result.status === 'success' && routing.finalAgent === 'Codex') {
      markTaskComplete(state, nextTask.id);
    }

    if (routing.finalAgent === 'Claude' && !healingTriggered) {
      markTaskFailed(state, nextTask.id);
    }

    const entryLines = [
      '',
      `## ${timestamp}`,
      '- Event: Orchestrator cycle',
      `- Cycle: ${cycle}`,
      `- Branch: \`${branch}\``,
      `- Task id: \`${nextTask.id}\``,
      `- Task type: ${nextTask.type}`,
      `- Task resume: ${resumed ? 'yes' : 'no'}`,
      `- State: ${stateStatus}`,
      `- Acceptance criteria parsed: ${initialCriteria.length}`,
      ...routing.routingLog,
      `- Escalation: ${routing.escalationOccurred ? 'yes' : 'no'}`,
      routing.escalationReason ? `- Escalation reason: ${routing.escalationReason}` : '- Escalation reason: none',
      `- Healing attempts count: ${getHealingAttempts(state, nextTask.id)}`,
    ];

    if (fixStatus) {
      entryLines.push(`- Fix packet status: ${fixStatus}`);
      entryLines.push(`- Fix files modified: ${fixFiles.length > 0 ? fixFiles.join(', ') : 'none'}`);
      entryLines.push(`- Healing outcome: ${healingOutcome || 'unresolved'}`);
    }

    if (!stateSaveNote) {
      saveState(state);
      stateSaveNote = 'ok';
    }
    entryLines.push(`- State save: ${stateSaveNote}`);

    appendLoopLog(entryLines);

    console.log('Cycle:', cycle);
    console.log('Task processed:', nextTask.id);
    console.log('Final agent:', routing.finalAgent);
    console.log('Outcome:', routing.result.status);
    console.log('State save:', stateSaveNote);

    if (fixStatus) {
      console.log('Fix packet status:', fixStatus);
      console.log('Healing outcome:', healingOutcome || 'unresolved');
      return;
    }

    cycleIndex += 1;
    if (options.maxTasks && cycleIndex >= options.maxTasks) {
      return;
    }

    nextTask = getNextTask(state);
  }

  if (healingDisabled) {
    const resultLine = hadEscalation ? 'HEALING_RESULT=unresolved' : 'HEALING_RESULT=resolved';
    console.log(resultLine);
  }

  saveState(state);

  console.log('Acceptance criteria parsed:', initialCriteria.length);
  console.log('Task queue length:', state.taskQueue.length);
  console.log('Loop log appended:', path.relative(repoRoot, loopLogPath));
}

run();
