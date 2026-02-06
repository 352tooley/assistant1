const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { runCodex } = require('./agents/codex');
const { runClaude } = require('./agents/claude');
const { classifyFailure } = require('./failureClassifier');
const { validateFixPacket } = require('./fixPacketValidator');
const { normalizeMode, chooseProvider } = require('./routingPolicy');
const { planTask } = require('./advisors/planner');
const { critiquePlan } = require('./advisors/critic');
const { resolvePriority } = require('./advisors/ceo');
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
  recordRegressionFixAttempt,
  getRegressionFixAttempts,
  recordFailureForCommit,
  recordUsage,
  recordEscalationReason,
  getUsageSnapshot,
  updateLastSuccessfulCommit,
  refreshTaskQueueForCommit,
} = require('./stateManager');

const repoRoot = path.resolve(__dirname, '..');
const acceptancePath = path.join(repoRoot, 'docs', 'ACCEPTANCE.md');
const loopLogPath = path.join(repoRoot, 'docs', 'LOOP_LOG.md');
const headPath = path.join(repoRoot, '.git', 'HEAD');
const stopFlagPath = path.join(repoRoot, 'state', 'STOP');
const runtimeStatusPath = path.join(repoRoot, 'state', 'runtime.json');

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

function getCurrentCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return 'unknown';
  }
  return (result.stdout || '').trim();
}

function getDiffSummary(fromCommit, toCommit) {
  if (!fromCommit || !toCommit || fromCommit === 'unknown' || toCommit === 'unknown') {
    return 'diff unavailable';
  }
  const result = spawnSync('git', ['diff', '--stat', `${fromCommit}..${toCommit}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    return 'diff unavailable';
  }
  const output = (result.stdout || '').trim();
  return output.length > 0 ? output : 'diff empty';
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
      input: { text: 'Cycle Seven', mode: 'upper' },
      expectedOutput: 'CYCLE SEVEN',
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

function estimateTokens(payload) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (!raw) {
    return 0;
  }
  return Math.max(1, Math.ceil(raw.length / 4));
}

function summarizeAdvisorOutput(output) {
  return summarize(output);
}

function formatExpectedOutput(value) {
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  return JSON.stringify(value);
}

function applyFixPacket(packet, state, taskId, correctedOutput) {
  if (!packet || packet.proposedFix.strategy !== 'fix-task-definition') {
    return { applied: false, reason: 'Unsupported fix strategy.', filesModified: [] };
  }

  if (!packet.proposedFix.filesToChange.includes('src/orchestrator.js')) {
    return { applied: false, reason: 'Target file not included.', filesModified: [] };
  }

  if (correctedOutput === undefined) {
    return { applied: false, reason: 'Missing corrected output.', filesModified: [] };
  }

  const targetPath = path.join(repoRoot, 'src', 'orchestrator.js');
  const original = readFile(targetPath);

  const marker = `id: '${taskId}'`;
  const markerIndex = original.indexOf(marker);
  if (markerIndex === -1) {
    return { applied: false, reason: 'Task definition not found.', filesModified: [] };
  }

  const window = original.slice(markerIndex, markerIndex + 400);
  const expectedPattern = /expectedOutput: ([^,]+),/;
  if (!expectedPattern.test(window)) {
    return { applied: false, reason: 'Expected output marker not found.', filesModified: [] };
  }

  const replacementValue = formatExpectedOutput(correctedOutput);
  const updatedWindow = window.replace(expectedPattern, `expectedOutput: ${replacementValue},`);
  const updated = original.slice(0, markerIndex) + updatedWindow + original.slice(markerIndex + window.length);
  fs.writeFileSync(targetPath, updated, 'utf8');

  const taskEntry = state.taskQueue.find((entry) => entry.id === taskId);
  if (taskEntry) {
    taskEntry.expectedOutput = correctedOutput;
  }

  return { applied: true, reason: 'Fix applied.', filesModified: ['src/orchestrator.js'] };
}

function applyForwardFix(packet, state, taskId, correctedOutput) {
  const applied = applyFixPacket(packet, state, taskId, correctedOutput);
  if (!applied.applied) {
    return { ...applied, commitHash: null };
  }

  const add = spawnSync('git', ['add', ...applied.filesModified], { encoding: 'utf8' });
  if (add.status !== 0) {
    return { applied: false, reason: 'git add failed', filesModified: applied.filesModified, commitHash: null };
  }

  const description = packet.proposedFix.description || `update ${taskId} expectedOutput`;
  const short = description.replace(/[^a-zA-Z0-9\s-]/g, '').trim().slice(0, 60);
  const commitMessage = `fix(regression): ${short || 'apply forward fix'}`;
  const commit = spawnSync('git', ['commit', '-m', commitMessage], { encoding: 'utf8' });
  if (commit.status !== 0) {
    return { applied: false, reason: 'git commit failed', filesModified: applied.filesModified, commitHash: null };
  }

  const hash = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  const commitHash = hash.status === 0 ? (hash.stdout || '').trim() : null;

  return { applied: true, reason: 'Fix applied.', filesModified: applied.filesModified, commitHash };
}

function runRoutingCycle(task, state, currentCommit, diffSummary, mode) {
  const routingLog = [];
  let result = null;
  let escalationReason = null;
  let lastFailure = null;
  let regressionDetected = false;
  let regressionInfo = null;
  const codexAttempts = { count: 0 };
  let advisorAdvice = null;
  let advisorDecision = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const providerDecision = chooseProvider({ task, failureInfo: {}, state, mode, phase: 'codex', attemptCounts: { codexAttempts: codexAttempts.count } });
    routingLog.push(`- Provider chosen: ${providerDecision.provider} (attempt ${attempt})`);
    routingLog.push(`- Routing mode: ${providerDecision.mode}`);
    routingLog.push(`- Routing reason: ${providerDecision.reason}`);
    codexAttempts.count += 1;
    recordUsage(state, {
      provider: providerDecision.provider,
      estimatedTokens: estimateTokens(task),
      mode: providerDecision.mode,
      reason: providerDecision.reason,
      taskId: task.id,
    });

    if (providerDecision.provider !== 'codex') {
      return {
        finalAgent: 'Codex',
        result: { status: 'failure', error: 'Routing policy prevented Codex invocation.' },
        routingLog,
        escalationReason: 'routing_policy_blocked',
        escalationOccurred: false,
        claudeStatus: null,
        fixPacket: null,
        lastFailure: null,
        regressionDetected: false,
        regressionInfo: null,
      };
    }

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
        regressionDetected: false,
        regressionInfo: null,
      };
    }

    lastFailure = result;
    const failureCount = incrementFailure(state, task.id);
    const classification = classifyFailure({ message: result.error || 'Unknown failure' }, task.id, failureCount);
    routingLog.push(`- Failure classification: ${classification.classification} (count ${classification.count})`);

    if (
      state.lastSuccessfulCommit &&
      currentCommit !== state.lastSuccessfulCommit &&
      task.lastCompletedCommit === state.lastSuccessfulCommit
    ) {
      regressionDetected = true;
      regressionInfo = {
        lastSuccessfulCommit: state.lastSuccessfulCommit,
        failingCommit: currentCommit,
        failureSignature: result.error || 'Unknown failure',
        diffSummary,
      };
      recordFailureForCommit(state, currentCommit, task.id, regressionInfo.failureSignature);
      routingLog.push('- Regression detected: yes');
      routingLog.push(`- Last successful commit: ${state.lastSuccessfulCommit}`);
      routingLog.push(`- Failing commit: ${currentCommit}`);
    } else {
      routingLog.push('- Regression detected: no');
    }

    if (classification.classification === 'simple') {
      routingLog.push('- Routing decision: retry Codex');
      continue;
    }

    const failureInfo = {
      classification: classification.classification,
      failureCount: classification.count,
      regressionDetected,
    };

    if (classification.classification === 'complex' || regressionDetected) {
      const plan = planTask(task, { regressionDetected, regressionInfo });
      const history = {
        recentFailures: state.failuresPerCommit[currentCommit] || [],
        mode,
      };
      const critique = critiquePlan(plan, history);
      const usageSnapshot = getUsageSnapshot(state);
      const ceoDecision = resolvePriority([plan], mode, usageSnapshot);
      advisorAdvice = { plan, critique, ceoDecision };

      routingLog.push(`- Advisor invoked: planner`); 
      routingLog.push(`- Advisor output: ${summarizeAdvisorOutput(plan)}`);
      routingLog.push(`- Advisor invoked: critic`);
      routingLog.push(`- Advisor output: ${summarizeAdvisorOutput(critique)}`);
      routingLog.push(`- Advisor invoked: ceo`);
      routingLog.push(`- Advisor output: ${summarizeAdvisorOutput(ceoDecision)}`);

      advisorDecision = {
        accepted: false,
        reason: 'advisory_only',
      };
      routingLog.push(`- Advisor decision: ignored (${advisorDecision.reason})`);
    }
    const escalationDecision = chooseProvider({
      task,
      failureInfo,
      state,
      mode,
      phase: 'claude',
      attemptCounts: { codexAttempts: codexAttempts.count },
    });

    routingLog.push(`- Provider chosen: ${escalationDecision.provider}`);
    routingLog.push(`- Routing mode: ${escalationDecision.mode}`);
    routingLog.push(`- Routing reason: ${escalationDecision.reason}`);

    if (escalationDecision.provider !== 'claude') {
      routingLog.push('- Budget mode suppression: Claude eligible but suppressed by policy.');
      recordEscalationReason(state, {
        provider: 'claude',
        reason: escalationDecision.reason,
        taskId: task.id,
        mode: escalationDecision.mode,
      });
      return {
        finalAgent: 'Codex',
        result: { status: 'failure', error: 'Claude suppressed by routing policy.' },
        routingLog,
        escalationReason: 'claude_suppressed',
        escalationOccurred: false,
        claudeStatus: null,
        fixPacket: null,
        lastFailure,
        regressionDetected,
        regressionInfo,
      };
    }

    escalationReason = 'complex or repeated failure';
    routingLog.push(`- Escalation decision: Claude (${escalationReason})`);

    const claudeContext = {
      error: result.error || null,
      classification: classification.classification,
      failureCount: classification.count,
      codexOutputs: result.output !== undefined ? [result.output] : [],
    };

    if (regressionInfo) {
      claudeContext.regression = regressionInfo;
    }

    recordUsage(state, {
      provider: 'claude',
      estimatedTokens: estimateTokens({ task, claudeContext }),
      mode: escalationDecision.mode,
      reason: escalationDecision.reason,
      taskId: task.id,
    });
    const claudeResult = runClaude(task, claudeContext);
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
      regressionDetected,
      regressionInfo,
    };
  }

  escalationReason = 'retries exhausted';
  const failureInfo = {
    classification: 'complex',
    failureCount: state.failureCounts[task.id] || 0,
    regressionDetected: false,
  };
  const escalationDecision = chooseProvider({
    task,
    failureInfo,
    state,
    mode,
    phase: 'claude',
    attemptCounts: { codexAttempts: codexAttempts.count },
  });

  routingLog.push(`- Provider chosen: ${escalationDecision.provider}`);
  routingLog.push(`- Routing mode: ${escalationDecision.mode}`);
  routingLog.push(`- Routing reason: ${escalationDecision.reason}`);

  if (escalationDecision.provider !== 'claude') {
    routingLog.push('- Budget mode suppression: Claude eligible but suppressed by policy.');
    recordEscalationReason(state, {
      provider: 'claude',
      reason: escalationDecision.reason,
      taskId: task.id,
      mode: escalationDecision.mode,
    });
    return {
      finalAgent: 'Codex',
      result: { status: 'failure', error: 'Claude suppressed by routing policy.' },
      routingLog,
      escalationReason: 'claude_suppressed',
      escalationOccurred: false,
      claudeStatus: null,
      fixPacket: null,
      lastFailure,
      regressionDetected: false,
      regressionInfo: null,
    };
  }

  routingLog.push(`- Escalation decision: Claude (${escalationReason})`);
  const claudeContext = {
    error: lastFailure ? lastFailure.error : null,
    classification: 'complex',
    failureCount: state.failureCounts[task.id] || 0,
    codexOutputs: lastFailure && lastFailure.output !== undefined ? [lastFailure.output] : [],
  };
  recordUsage(state, {
    provider: 'claude',
    estimatedTokens: estimateTokens({ task, claudeContext }),
    mode: escalationDecision.mode,
    reason: escalationDecision.reason,
    taskId: task.id,
  });
  const claudeResult = runClaude(task, claudeContext);
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
    regressionDetected: false,
    regressionInfo: null,
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

function logCliEvent({ command, intent, result, details }) {
  const timestamp = new Date().toISOString();
  const lines = [
    '',
    `## ${timestamp}`,
    '- Event: CLI command',
    `- cliCommand: ${command}`,
    `- operatorIntent: ${intent}`,
    `- result: ${result}`,
  ];

  if (details && details.length > 0) {
    details.forEach((detail) => lines.push(`- detail: ${detail}`));
  }

  appendLoopLog(lines);
}

function warnIfMissingFiles() {
  const warnings = [];
  if (!fs.existsSync(path.join(repoRoot, 'docs', 'AGENT_CONTRACT.md'))) {
    warnings.push('Missing docs/AGENT_CONTRACT.md');
  }
  if (!fs.existsSync(path.join(repoRoot, 'docs', 'ACCEPTANCE.md'))) {
    warnings.push('Missing docs/ACCEPTANCE.md');
  }
  if (warnings.length > 0) {
    const timestamp = new Date().toISOString();
    appendLoopLog([
      '',
      `## ${timestamp}`,
      '- Event: Sanity warning',
      ...warnings.map((warning) => `- Warning: ${warning}`),
    ]);
  }
  return warnings;
}

function rerunOrchestrator(mode) {
  const env = { ...process.env, HEALING_RERUN: '1' };
  if (mode) {
    env.RERUN_MODE = mode;
  }
  const result = spawnSync(process.execPath, [__filename], {
    env,
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
  const options = {
    reset: false,
    maxTasks: null,
    mode: normalizeMode(process.env.ROUTING_MODE),
    headless: false,
    pollIntervalMs: 5000,
    maxCycles: 50,
    maxRuntimeMs: 60000,
  };

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
    if (arg.startsWith('--mode=')) {
      options.mode = normalizeMode(arg.split('=')[1]);
    }
    if (arg === '--headless') {
      options.headless = true;
    }
    if (arg.startsWith('--poll-interval-ms=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value >= 1000) {
        options.pollIntervalMs = value;
      }
    }
    if (arg.startsWith('--max-cycles=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.maxCycles = value;
      }
    }
    if (arg.startsWith('--max-runtime-ms=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.maxRuntimeMs = value;
      }
    }
  });

  return options;
}

function sleepMs(durationMs) {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    // Intentional blocking sleep for deterministic headless mode.
  }
}

function pruneCommitMaps(state) {
  const allowed = new Set(state.commitsSinceSuccess || []);
  if (state.lastSuccessfulCommit) {
    allowed.add(state.lastSuccessfulCommit);
  }
  Object.keys(state.failuresPerCommit || {}).forEach((commit) => {
    if (!allowed.has(commit)) {
      delete state.failuresPerCommit[commit];
    }
  });
  Object.keys(state.regressionFixAttempts || {}).forEach((commit) => {
    if (!allowed.has(commit)) {
      delete state.regressionFixAttempts[commit];
    }
  });
}

function runHeadless(options, meta = {}) {
  const startTime = Date.now();
  let cycles = 0;
  let exitReason = null;

  warnIfMissingFiles();

  if (meta.cliCommand) {
    logCliEvent({
      command: meta.cliCommand,
      intent: meta.operatorIntent || 'headless start',
      result: 'started',
      details: [`pollIntervalMs=${options.pollIntervalMs}`, `maxCycles=${options.maxCycles}`, `maxRuntimeMs=${options.maxRuntimeMs}`],
    });
  }

  while (true) {
    if (fs.existsSync(stopFlagPath)) {
      exitReason = 'operatorStop';
    }

    if (Date.now() - startTime >= options.maxRuntimeMs) {
      exitReason = 'maxRuntime';
    }

    if (cycles >= options.maxCycles) {
      exitReason = 'maxCycles';
    }

    if (exitReason) {
      const timestamp = new Date().toISOString();
      appendLoopLog([
        '',
        `## ${timestamp}`,
        '- Event: Headless exit',
        `- Reason: ${exitReason}`,
        `- Headless mode: true`,
        `- Poll interval ms: ${options.pollIntervalMs}`,
        meta.cliCommand ? `- cliCommand: ${meta.cliCommand}` : '- cliCommand: none',
        meta.operatorIntent ? `- operatorIntent: ${meta.operatorIntent}` : '- operatorIntent: none',
      ]);
      return;
    }

    const cycleOptions = {
      ...options,
      reset: options.reset && cycles === 0,
    };
    const cycleResult = runOnce(cycleOptions, { headlessMode: true, cliCommand: meta.cliCommand, operatorIntent: meta.operatorIntent });
    cycles += 1;

    if (cycleResult && cycleResult.status === 'rejected') {
      exitReason = cycleResult.reason || 'rejected';
      continue;
    }
    if (fs.existsSync(stopFlagPath)) {
      exitReason = 'operatorStop';
      continue;
    }

    if (cycleResult && (cycleResult.status === 'idle' || cycleResult.status === 'done')) {
      const sleepStart = new Date().toISOString();
      appendLoopLog([
        '',
        `## ${sleepStart}`,
        '- Event: Headless sleep',
        `- Headless mode: true`,
        `- Poll interval ms: ${options.pollIntervalMs}`,
        `- Sleep start: ${sleepStart}`,
        meta.cliCommand ? `- cliCommand: ${meta.cliCommand}` : '- cliCommand: none',
        meta.operatorIntent ? `- operatorIntent: ${meta.operatorIntent}` : '- operatorIntent: none',
      ]);

      if (cycleResult.state) {
        saveState(cycleResult.state);
      }
      sleepMs(options.pollIntervalMs);

      const wakeTime = new Date().toISOString();
      appendLoopLog([
        '',
        `## ${wakeTime}`,
        '- Event: Headless wake',
        `- Headless mode: true`,
        `- Poll interval ms: ${options.pollIntervalMs}`,
        `- Wake time: ${wakeTime}`,
        meta.cliCommand ? `- cliCommand: ${meta.cliCommand}` : '- cliCommand: none',
        meta.operatorIntent ? `- operatorIntent: ${meta.operatorIntent}` : '- operatorIntent: none',
      ]);
    }
  }
}

function runOnce(options, { headlessMode, cliCommand, operatorIntent }) {
  const healingDisabled = process.env.HEALING_RERUN === '1';
  const mode = normalizeMode(options.mode);
  warnIfMissingFiles();
  const acceptance = readFile(acceptancePath);
  const initialCriteria = extractSectionList(acceptance, '## Initial Acceptance Criteria');

  const currentCommit = getCurrentCommit();

  if (options.reset) {
    resetState();
  }

  const queue = buildTaskQueue(initialCriteria);
  const loadResult = loadState(queue, { reset: options.reset });
  const state = loadResult.state;
  let stateStatus = loadResult.status;

  if (stateStatus === 'corrupt' || !state) {
    const timestamp = new Date().toISOString();
    appendLoopLog([
      '',
      `## ${timestamp}`,
      '- Event: State corrupt',
      `- Headless mode: ${headlessMode ? 'true' : 'false'}`,
      cliCommand ? `- cliCommand: ${cliCommand}` : '- cliCommand: none',
      operatorIntent ? `- operatorIntent: ${operatorIntent}` : '- operatorIntent: none',
      '- Exit reason: state_corrupt',
    ]);
    return { status: 'rejected', reason: 'state_corrupt' };
  }

  if (!state.lastProcessedCommit) {
    state.lastProcessedCommit = currentCommit;
  }

  if (state.lastProcessedCommit !== currentCommit) {
    refreshTaskQueueForCommit(state, queue, currentCommit);
    stateStatus = 'reinitialized';
  }

  if (state.lastSuccessfulCommit && currentCommit !== state.lastSuccessfulCommit) {
    if (!state.commitsSinceSuccess.includes(currentCommit)) {
      state.commitsSinceSuccess.push(currentCommit);
      if (state.commitsSinceSuccess.length > 20) {
        state.commitsSinceSuccess.shift();
      }
    }
  }
  pruneCommitMaps(state);

  const cycleStart = getNextCycleNumber();
  const branch = getBranchName();
  const diffSummary = state.lastSuccessfulCommit ? getDiffSummary(state.lastSuccessfulCommit, currentCommit) : 'diff unavailable';
  state.usage.lastModeUsed = mode;

  let cycleIndex = 0;
  let healingAttempted = false;
  let hadEscalation = false;
  let regressionHandled = false;
  let regressionUnresolved = false;

  if (options.reset) {
    const timestamp = new Date().toISOString();
    appendLoopLog([
      '',
      `## ${timestamp}`,
      '- Event: State reset',
      `- Branch: \`${branch}\``,
      `- State file: ${runtimePath}`,
      cliCommand ? `- cliCommand: ${cliCommand}` : '- cliCommand: none',
      operatorIntent ? `- operatorIntent: ${operatorIntent}` : '- operatorIntent: none',
    ]);
  }

  let nextTask = getNextTask(state);
  if (!nextTask) {
    saveState(state);
    const timestamp = new Date().toISOString();
    appendLoopLog([
      '',
      `## ${timestamp}`,
      '- Event: Idle',
      `- Headless mode: ${headlessMode ? 'true' : 'false'}`,
      `- Poll interval ms: ${options.pollIntervalMs}`,
      '- Exit reason: idle',
      cliCommand ? `- cliCommand: ${cliCommand}` : '- cliCommand: none',
      operatorIntent ? `- operatorIntent: ${operatorIntent}` : '- operatorIntent: none',
    ]);
    return { status: 'idle', state };
  }

  while (nextTask) {
    const { resumed } = markTaskDispatched(state, nextTask.id);
    const cycle = cycleStart + cycleIndex;
    const routing = runRoutingCycle(nextTask, state, currentCommit, diffSummary, mode);
    const timestamp = new Date().toISOString();

    let fixStatus = null;
    let fixFiles = [];
    let healingOutcome = null;
    let stateSaveNote = null;
    let forwardFixCommit = null;

    if (routing.escalationOccurred) {
      hadEscalation = true;
    }

    let healingTriggered = false;

    if (!healingDisabled && !healingAttempted && routing.escalationOccurred && routing.claudeStatus === 'resolved') {
      healingAttempted = true;
      healingTriggered = true;
      const attemptCount = recordHealingAttempt(state, nextTask.id);

      if (routing.regressionDetected && routing.regressionInfo) {
        const failingCommit = routing.regressionInfo.failingCommit;
        const regressionAttempts = getRegressionFixAttempts(state, failingCommit);
        if (regressionAttempts >= 1) {
          fixStatus = 'rejected (regression fix already attempted)';
          healingOutcome = 'unresolved (regression fix already attempted)';
          regressionUnresolved = true;
        } else if (routing.fixPacket) {
          const validation = validateFixPacket(routing.fixPacket);
          if (validation.ok) {
            recordRegressionFixAttempt(state, failingCommit);
            const correctedOutput = routing.lastFailure ? routing.lastFailure.output : undefined;
            const applied = applyForwardFix(routing.fixPacket, state, nextTask.id, correctedOutput);
            fixStatus = applied.applied ? 'accepted' : `rejected (${applied.reason})`;
            fixFiles = applied.filesModified;
            forwardFixCommit = applied.commitHash;
            if (applied.applied) {
              saveState(state);
              stateSaveNote = 'pre-rerun';
              const rerun = rerunOrchestrator('regression');
              healingOutcome = rerun.resolved ? 'resolved' : `unresolved (${rerun.outputSummary})`;
              if (rerun.resolved && forwardFixCommit) {
                updateLastSuccessfulCommit(state, forwardFixCommit);
                regressionHandled = true;
              } else {
                regressionUnresolved = true;
              }
            } else {
              healingOutcome = 'unresolved (fix not applied)';
              regressionUnresolved = true;
            }
          } else {
            fixStatus = `rejected (${validation.reasons.join('; ')})`;
            healingOutcome = 'unresolved (validation failed)';
            regressionUnresolved = true;
          }
        } else {
          fixStatus = 'rejected (no fix packet)';
          healingOutcome = 'unresolved (no fix packet)';
          regressionUnresolved = true;
        }
      } else if (routing.fixPacket) {
        const validation = validateFixPacket(routing.fixPacket);
        if (validation.ok) {
          const correctedOutput = routing.lastFailure ? routing.lastFailure.output : undefined;
          const applied = applyFixPacket(routing.fixPacket, state, nextTask.id, correctedOutput);
          fixStatus = applied.applied ? 'accepted' : `rejected (${applied.reason})`;
          fixFiles = applied.filesModified;
          if (applied.applied) {
            saveState(state);
            stateSaveNote = 'pre-rerun';
            const rerun = rerunOrchestrator('healing');
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
      markTaskComplete(state, nextTask.id, currentCommit);
    }

    if (routing.result.status !== 'success' && routing.finalAgent === 'Codex' && !healingTriggered) {
      markTaskFailed(state, nextTask.id);
    }

    if (routing.finalAgent === 'Claude' && !healingTriggered) {
      markTaskFailed(state, nextTask.id);
    }

    const usageSnapshot = getUsageSnapshot(state);
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
      `- Routing mode: ${mode}`,
      `- Headless mode: ${headlessMode ? 'true' : 'false'}`,
      `- Poll interval ms: ${options.pollIntervalMs}`,
      cliCommand ? `- cliCommand: ${cliCommand}` : '- cliCommand: none',
      operatorIntent ? `- operatorIntent: ${operatorIntent}` : '- operatorIntent: none',
      `- Acceptance criteria parsed: ${initialCriteria.length}`,
      ...routing.routingLog,
      `- Escalation: ${routing.escalationOccurred ? 'yes' : 'no'}`,
      routing.escalationReason ? `- Escalation reason: ${routing.escalationReason}` : '- Escalation reason: none',
      `- Healing attempts count: ${getHealingAttempts(state, nextTask.id)}`,
      `- Usage snapshot: codexCalls=${usageSnapshot.codexCalls}, claudeCalls=${usageSnapshot.claudeCalls}`,
    ];

    if (routing.regressionDetected && routing.regressionInfo) {
      entryLines.push(`- Regression detected: yes`);
      entryLines.push(`- Last successful commit: ${routing.regressionInfo.lastSuccessfulCommit}`);
      entryLines.push(`- Failing commit: ${routing.regressionInfo.failingCommit}`);
      entryLines.push(`- Claude diagnosis: ${routing.fixPacket ? routing.fixPacket.diagnosis : 'none'}`);
      entryLines.push(`- Forward-fix commit: ${forwardFixCommit || 'none'}`);
    } else {
      entryLines.push('- Regression detected: no');
    }

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
      return { status: 'healed', state };
    }

    cycleIndex += 1;
    if (options.maxTasks && cycleIndex >= options.maxTasks) {
      return { status: 'maxTasks', state };
    }

    nextTask = getNextTask(state);
  }

  if (healingDisabled) {
    const resultLine = hadEscalation ? 'HEALING_RESULT=unresolved' : 'HEALING_RESULT=resolved';
    console.log(resultLine);
  }

  if (!regressionUnresolved && !hadEscalation && state.taskQueue.every((task) => task.status === 'completed')) {
    updateLastSuccessfulCommit(state, currentCommit);
  }

  saveState(state);

  console.log('Acceptance criteria parsed:', initialCriteria.length);
  console.log('Task queue length:', state.taskQueue.length);
  console.log('Loop log appended:', path.relative(repoRoot, loopLogPath));

  return { status: 'done', state };
}

function run() {
  const options = parseArgs();
  warnIfMissingFiles();
  if (options.headless) {
    return runHeadless(options);
  }

  return runOnce(options, { headlessMode: false });
}

if (require.main === module) {
  run();
}

function getStatusSnapshot(modeOverride) {
  const mode = normalizeMode(modeOverride);
  let state = null;
  if (fs.existsSync(runtimeStatusPath)) {
    try {
      state = JSON.parse(readFile(runtimeStatusPath));
    } catch {
      state = null;
    }
  }

  const taskQueue = state && Array.isArray(state.taskQueue) ? state.taskQueue : [];
  const pending = taskQueue.filter((task) => task.status === 'pending').length;
  const completed = taskQueue.filter((task) => task.status === 'completed').length;
  const failed = taskQueue.filter((task) => task.status === 'failed').length;
  const headlessStatus = pending > 0 ? 'running' : 'idle';

  const usage = state && state.usage ? state.usage : { codexCalls: 0, claudeCalls: 0 };

  return {
    pending,
    completed,
    failed,
    lastRunTimestamp: state ? state.lastRunTimestamp : null,
    lastSuccessfulCommit: state ? state.lastSuccessfulCommit : null,
    usage,
    mode,
    headlessStatus,
    stopFlag: fs.existsSync(stopFlagPath),
  };
}

function resetOnly(meta = {}) {
  resetState();
  logCliEvent({
    command: meta.cliCommand || 'reset',
    intent: meta.operatorIntent || 'reset',
    result: 'success',
    details: [`stateFile=${runtimePath}`],
  });
}

module.exports = {
  runOnce,
  runHeadless,
  getStatusSnapshot,
  resetOnly,
  logCliEvent,
};
