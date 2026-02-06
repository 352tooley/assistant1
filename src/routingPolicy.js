const MODES = new Set(['standard', 'budget', 'diagnostic']);

function normalizeMode(mode) {
  if (!mode) {
    return 'standard';
  }
  const value = String(mode).toLowerCase();
  return MODES.has(value) ? value : 'standard';
}

function shouldEscalateToClaude({ failureInfo, attemptCounts, mode }) {
  const normalizedMode = normalizeMode(mode);
  const classification = failureInfo.classification || 'simple';
  const regressionDetected = failureInfo.regressionDetected === true;
  const failureCount = failureInfo.failureCount || 0;
  const codexAttempts = attemptCounts.codexAttempts || 0;

  if (regressionDetected) {
    return { yes: true, reason: 'regression_detected' };
  }

  if (classification !== 'complex') {
    return { yes: false, reason: 'classification_simple' };
  }

  if (normalizedMode === 'budget') {
    return {
      yes: false,
      reason: `budget_suppression_failure_count_${failureCount}_attempts_${codexAttempts}`,
    };
  }

  return { yes: true, reason: 'complex_failure' };
}

function chooseProvider({ task, failureInfo, state, mode, phase, attemptCounts }) {
  const normalizedMode = normalizeMode(mode);

  if (phase === 'codex') {
    return { provider: 'codex', reason: 'default_codex', mode: normalizedMode };
  }

  if (phase === 'claude') {
    const decision = shouldEscalateToClaude({ failureInfo, attemptCounts, mode: normalizedMode });
    if (decision.yes) {
      return { provider: 'claude', reason: decision.reason, mode: normalizedMode };
    }
    return { provider: 'codex', reason: decision.reason, mode: normalizedMode };
  }

  return { provider: 'codex', reason: 'fallback_codex', mode: normalizedMode };
}

module.exports = {
  normalizeMode,
  chooseProvider,
  shouldEscalateToClaude,
};
