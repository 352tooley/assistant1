const { claude: claudeEngagement } = require('./agentEngagement');

const MODES = new Set(['standard', 'budget', 'diagnostic']);

function normalizeMode(mode) {
  if (!mode) {
    return 'standard';
  }
  const value = String(mode).toLowerCase();
  return MODES.has(value) ? value : 'standard';
}

function deriveClaudeTrigger(failureInfo) {
  if (failureInfo.regressionDetected) {
    return 'cross_commit_regression';
  }
  if (failureInfo.classification === 'complex') {
    return 'repeated_deterministic_failure';
  }
  return null;
}

function shouldEscalateToClaude({ failureInfo, attemptCounts, mode }) {
  const normalizedMode = normalizeMode(mode);
  const classification = failureInfo.classification || 'simple';
  const regressionDetected = failureInfo.regressionDetected === true;
  const failureCount = failureInfo.failureCount || 0;
  const codexAttempts = attemptCounts.codexAttempts || 0;
  const trigger = deriveClaudeTrigger(failureInfo);

  if (regressionDetected) {
    return { yes: true, reason: 'regression_detected', trigger };
  }

  if (classification !== 'complex') {
    return { yes: false, reason: 'classification_simple', trigger };
  }

  if (!trigger || !claudeEngagement.escalationTriggers.includes(trigger)) {
    return { yes: false, reason: 'trigger_not_allowed', trigger };
  }

  if (normalizedMode === 'budget') {
    return {
      yes: false,
      reason: `budget_suppression_failure_count_${failureCount}_attempts_${codexAttempts}`,
      trigger,
    };
  }

  return { yes: true, reason: 'complex_failure', trigger };
}

function chooseProvider({ task, failureInfo, state, mode, phase, attemptCounts }) {
  const normalizedMode = normalizeMode(mode);

  if (phase === 'codex') {
    return { provider: 'codex', reason: 'default_codex', mode: normalizedMode };
  }

  if (phase === 'claude') {
    const decision = shouldEscalateToClaude({ failureInfo, attemptCounts, mode: normalizedMode });
    if (decision.yes) {
      return { provider: 'claude', reason: decision.reason, mode: normalizedMode, trigger: decision.trigger };
    }
    return { provider: 'codex', reason: decision.reason, mode: normalizedMode, trigger: decision.trigger };
  }

  return { provider: 'codex', reason: 'fallback_codex', mode: normalizedMode };
}

module.exports = {
  normalizeMode,
  chooseProvider,
  shouldEscalateToClaude,
};
