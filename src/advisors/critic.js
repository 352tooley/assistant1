function critiquePlan(input, history) {
  const concerns = [];
  const regressionsToWatch = [];
  let confidence = 'medium';

  if (!input) {
    concerns.push('No plan or fix packet provided for review.');
    confidence = 'low';
  }

  if (input && input.strategy && String(input.strategy).includes('fix')) {
    regressionsToWatch.push('Verify fix does not alter unrelated task definitions.');
  }

  if (history && history.recentFailures && history.recentFailures.length > 0) {
    concerns.push('Recent failures detected; verify forward-fix does not regress prior successes.');
  }

  if (history && history.mode === 'budget') {
    concerns.push('Budget mode: prefer Codex retries before Claude escalation.');
  }

  if (concerns.length >= 2) {
    confidence = 'low';
  }

  if (concerns.length === 0) {
    confidence = 'high';
  }

  return { concerns, regressionsToWatch, confidence };
}

module.exports = {
  critiquePlan,
};
