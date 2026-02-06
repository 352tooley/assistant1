const { loadProviderConfig } = require('../providerConfig');
const { sendAnthropicMessage } = require('../providers/anthropicClient');
const { redactSecrets } = require('../redaction');
const { claude: claudeEngagement } = require('../agentEngagement');

function findJsonPayload(text) {
  if (!text) {
    return null;
  }
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function normalizeFixPacket(output, diagnosis, rootCause) {
  const proposed = output.proposedFix || {};
  if (proposed.kind !== 'fixPacket' || !proposed.packet || !Array.isArray(proposed.packet.changes)) {
    return null;
  }
  const files = proposed.packet.changes
    .map((change) => change.path)
    .filter((path) => typeof path === 'string' && path.trim() !== '');
  const uniqueFiles = Array.from(new Set(files));
  if (!uniqueFiles.includes('src/orchestrator.js')) {
    return null;
  }
  return {
    diagnosis: `${diagnosis} Root cause: ${rootCause}`,
    proposedFix: {
      description: proposed.packet.reason || 'Apply deterministic fix from Claude.',
      filesToChange: uniqueFiles,
      strategy: 'fix-task-definition',
    },
  };
}

function matchesForbidden(pathValue, forbiddenPatterns) {
  if (!pathValue) {
    return false;
  }
  return forbiddenPatterns.some((pattern) => {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return pathValue.startsWith(prefix);
    }
    return pathValue === pattern;
  });
}

function validateScope(changes, scope) {
  if (!scope || !Array.isArray(scope.allowedFiles)) {
    return { ok: false, reason: 'Missing scope.' };
  }
  const allowed = new Set(scope.allowedFiles.map((entry) => entry.path));
  const forbiddenPatterns = Array.isArray(scope.forbiddenPatterns) ? scope.forbiddenPatterns : [];
  const uniqueFiles = Array.from(new Set(changes.map((change) => change.path)));

  if (uniqueFiles.length > scope.maxFiles) {
    return { ok: false, reason: 'Exceeded maxFiles in scope.' };
  }

  for (const pathValue of uniqueFiles) {
    if (!allowed.has(pathValue)) {
      return { ok: false, reason: `Out of scope: ${pathValue}` };
    }
    if (matchesForbidden(pathValue, forbiddenPatterns)) {
      return { ok: false, reason: `Forbidden path: ${pathValue}` };
    }
  }

  return { ok: true };
}

function validateSchema(output) {
  if (!output || typeof output !== 'object') {
    return 'Output is not an object.';
  }
  if (typeof output.diagnosis !== 'string' || typeof output.rootCause !== 'string') {
    return 'diagnosis and rootCause must be strings.';
  }
  if (!['low', 'medium', 'high'].includes(output.confidence)) {
    return 'confidence must be low|medium|high.';
  }
  if (!output.proposedFix || typeof output.proposedFix !== 'object') {
    return 'proposedFix is required.';
  }
  if (!['fixPacket', 'noFix'].includes(output.proposedFix.kind)) {
    return 'proposedFix.kind must be fixPacket or noFix.';
  }
  return null;
}

async function runClaudeAdapter({ trigger, failureContext, repoContext, constraints }) {
  const config = loadProviderConfig();
  const anthropic = config.providers && config.providers.anthropic ? config.providers.anthropic : null;
  const engagementEnabled = claudeEngagement.enabled || (anthropic && anthropic.enabled === true);

  if (!engagementEnabled) {
    return { status: 'failure', diagnosis: 'Claude engagement disabled.', proposedFixPacket: null };
  }
  if (!claudeEngagement.escalationTriggers.includes(trigger)) {
    return { status: 'failure', diagnosis: 'Trigger not allowed for Claude.', proposedFixPacket: null };
  }
  if (!anthropic || !anthropic.apiKey) {
    return { status: 'failure', diagnosis: 'Anthropic provider not configured.', proposedFixPacket: null };
  }

  const model = anthropic.model || 'claude-3-5-sonnet-20241022';
  const maxTokens = anthropic.maxTokens || 800;
  const temperature = anthropic.temperature ?? 0.2;

  const scope = constraints && constraints.scope ? constraints.scope : null;
  const scopeLines = scope
    ? scope.allowedFiles.map((entry) => `- ${entry.path}: ${entry.reason}`)
    : ['- none'];

  const systemPrompt = [
    'You are diagnostic-only.',
    'You must output JSON only. No markdown.',
    'Follow the schema exactly.',
    'Do not include secrets or raw logs.',
    'You may only propose fixes touching the files listed in scope.allowedFiles.',
    'Any proposal outside this scope will be rejected automatically.',
    `Scope allowed files:\n${scopeLines.join('\n')}`,
  ].join(' ');

  const payload = redactSecrets({
    trigger,
    failureContext,
    repoContext,
    constraints,
  });

  const userMessage = `Analyze the failure and respond with JSON matching this schema:
{
  "diagnosis": "string",
  "rootCause": "string",
  "confidence": "low|medium|high",
  "proposedFix": {
    "kind": "fixPacket|noFix",
    "packet": {
      "reason": "string",
      "changes": [
        { "path": "string", "op": "replace|create|delete", "content": "string" }
      ]
    }
  }
}
Context:\n${JSON.stringify(payload)}`;

  let response;
  if (process.env.CLAUDE_ADAPTER_MOCK_RESPONSE) {
    response = {
      ok: true,
      contentText: process.env.CLAUDE_ADAPTER_MOCK_RESPONSE,
      usage: null,
    };
  } else {
    response = await sendAnthropicMessage({
      apiKey: anthropic.apiKey,
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens,
      temperature,
    });
  }

  if (!response.ok) {
    return { status: 'failure', diagnosis: 'Anthropic API error.', proposedFixPacket: null };
  }

  const jsonText = findJsonPayload(response.contentText);
  if (!jsonText) {
    return { status: 'failure', diagnosis: 'Invalid Claude output.', proposedFixPacket: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { status: 'failure', diagnosis: 'Invalid Claude output.', proposedFixPacket: null };
  }

  const schemaError = validateSchema(parsed);
  if (schemaError) {
    return { status: 'failure', diagnosis: 'Invalid Claude output.', proposedFixPacket: null };
  }

  if (parsed.proposedFix && parsed.proposedFix.kind === 'fixPacket') {
    const scopeCheck = validateScope(parsed.proposedFix.packet.changes || [], scope);
    if (!scopeCheck.ok) {
      return { status: 'failure', diagnosis: 'Out-of-scope fix', proposedFixPacket: null, error: 'claude_fix_rejected_out_of_scope' };
    }
  }

  const proposedFixPacket = normalizeFixPacket(parsed, parsed.diagnosis, parsed.rootCause);

  return {
    status: 'success',
    diagnosis: parsed.diagnosis,
    rootCause: parsed.rootCause,
    confidence: parsed.confidence,
    proposedFixPacket,
  };
}

function isClaudeCallable(trigger) {
  const config = loadProviderConfig();
  const anthropic = config.providers && config.providers.anthropic ? config.providers.anthropic : null;
  const engagementEnabled = claudeEngagement.enabled || (anthropic && anthropic.enabled === true);
  if (!engagementEnabled) {
    return { ok: false, reason: 'engagement_disabled' };
  }
  if (trigger && !claudeEngagement.escalationTriggers.includes(trigger)) {
    return { ok: false, reason: 'trigger_not_allowed' };
  }
  if (!anthropic || !anthropic.apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }
  return { ok: true };
}

module.exports = {
  runClaudeAdapter,
  isClaudeCallable,
};
