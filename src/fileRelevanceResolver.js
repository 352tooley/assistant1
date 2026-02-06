function resolveRelevantFiles({ trigger, failureContext, lastActions, recentCommits }) {
  const allowedFiles = [];
  const maxFiles = 5;
  const forbiddenPatterns = ['node_modules/**', 'desktop/**', 'tests/**'];

  const error = failureContext && typeof failureContext.error === 'string' ? failureContext.error : '';
  const classification = failureContext && failureContext.classification ? failureContext.classification : '';

  if (trigger === 'cross_commit_regression') {
    allowedFiles.push({
      path: 'src/orchestrator.js',
      reason: 'Regression handling and task definitions live here.',
    });
  }

  if (trigger === 'repeated_deterministic_failure' || classification === 'complex') {
    allowedFiles.push({
      path: 'src/orchestrator.js',
      reason: 'Task execution and expectedOutput validation occurs here.',
    });
    allowedFiles.push({
      path: 'src/agents/codex.js',
      reason: 'Codex execution logic may affect deterministic failures.',
    });
  }

  if (error.includes('expectedOutput')) {
    allowedFiles.push({
      path: 'src/orchestrator.js',
      reason: 'Expected output values are defined here.',
    });
  }

  const unique = [];
  const seen = new Set();
  allowedFiles.forEach((entry) => {
    if (!seen.has(entry.path)) {
      unique.push(entry);
      seen.add(entry.path);
    }
  });

  return {
    allowedFiles: unique.slice(0, maxFiles),
    forbiddenPatterns,
    maxFiles,
    trigger,
    lastActions: lastActions || null,
    recentCommits: recentCommits || null,
  };
}

module.exports = {
  resolveRelevantFiles,
};
