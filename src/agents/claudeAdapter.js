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

  const systemPrompt = [
    'You are diagnostic-only.',
    'You must output JSON only. No markdown.',
    'Follow the schema exactly.',
    'Do not include secrets or raw logs.',
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

  const response = await sendAnthropicMessage({
    apiKey: anthropic.apiKey,
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens,
    temperature,
  });

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

  const proposedFixPacket = normalizeFixPacket(parsed, parsed.diagnosis, parsed.rootCause);

  return {
    status: 'success',
    diagnosis: parsed.diagnosis,
    rootCause: parsed.rootCause,
    confidence: parsed.confidence,
    proposedFixPacket,
  };
}

module.exports = {
  runClaudeAdapter,
};
