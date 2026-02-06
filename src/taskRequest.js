const DEFAULT_MODE = 'standard';

function buildTaskRequest({ templateId, inputs, requestedAgentRole, requestedAdvisor, preferredProvider, preferredRole, preferredModel, mode, limits, allowsClaude }) {
  return {
    templateId: String(templateId || ''),
    inputs: inputs || {},
    requestedAgentRole: String(requestedAgentRole || ''),
    requestedAdvisor: requestedAdvisor || 'auto',
    preferredProvider: preferredProvider || '',
    preferredRole: preferredRole || '',
    preferredModel: preferredModel || '',
    mode: mode || DEFAULT_MODE,
    limits: {
      maxCycles: limits && Number.isFinite(limits.maxCycles) ? limits.maxCycles : 1,
      maxRuntimeMs: limits && Number.isFinite(limits.maxRuntimeMs) ? limits.maxRuntimeMs : null,
    },
    allowsClaude: Boolean(allowsClaude),
  };
}

function buildTaskRunResult({ status, message, outputSummary, logHint }) {
  return {
    status,
    message,
    outputSummary,
    logHint,
  };
}

module.exports = {
  buildTaskRequest,
  buildTaskRunResult,
  DEFAULT_MODE,
};
