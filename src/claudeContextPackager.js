const { resolveRelevantFiles } = require('./fileRelevanceResolver');

function buildClaudeScope({ trigger, failureContext, lastActions, recentCommits }) {
  const scope = resolveRelevantFiles({
    trigger,
    failureContext,
    lastActions,
    recentCommits,
  });

  return {
    allowedFiles: scope.allowedFiles,
    forbiddenPatterns: scope.forbiddenPatterns,
    maxFiles: scope.maxFiles,
  };
}

function packageClaudeContext({ trigger, failureContext, lastActions, recentCommits, constraints }) {
  const scope = buildClaudeScope({ trigger, failureContext, lastActions, recentCommits });
  return {
    trigger,
    failureContext,
    lastActions,
    recentCommits,
    constraints: {
      ...(constraints || {}),
      scope,
    },
  };
}

module.exports = {
  buildClaudeScope,
  packageClaudeContext,
};
