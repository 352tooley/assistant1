module.exports = {
  claude: {
    enabled: false,
    escalationTriggers: [
      'renderer_black_screen',
      'electron_lifecycle_exit',
      'cross_commit_regression',
      'repeated_deterministic_failure',
    ],
    allowedActions: [
      'diagnose',
      'propose_fix',
      'classify_root_cause',
    ],
    forbiddenActions: [
      'execute_code',
      'apply_fix_directly',
      'modify_runtime_state',
    ],
    requiredInputs: [
      'error_context',
      'recent_commits',
      'runtime_state_snapshot',
    ],
    outputSchema: {
      diagnosis: 'string',
      rootCause: 'string',
      confidence: 'low|medium|high',
      proposedFix: {
        files: ['string'],
        description: 'string',
        risk: 'low|medium|high',
      },
    },
  },
};
