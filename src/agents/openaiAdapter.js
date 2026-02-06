const { sendOpenAIResponse } = require('../providers/openaiClient');
const { redactSecrets } = require('../redaction');
const registry = require('../providerRegistry');
const { loadProviderStore } = require('../providerManager');

function buildPrompt(task) {
  if (task.type === 'open_ended_idea') {
    return [
      'You are Codex. Ask clarifying questions to plan this task from start to finish.',
      'Return a numbered list of 5-8 questions.',
      `Idea: ${task.input.idea}`,
    ].join('\n');
  }
  if (task.type === 'open_ended_plan') {
    return [
      'You are Codex. Produce a step-by-step plan from start to finish.',
      'Return a concise, numbered plan with assumptions and risks.',
      `Idea: ${task.input.idea}`,
      `Answers: ${task.input.answers}`,
    ].join('\n');
  }
  if (task.type === 'youtube_analysis') {
    const focus = task.input.focus ? `Focus: ${task.input.focus}` : 'Focus: general skill extraction';
    const transcript = task.input.transcript || '';
    return [
      'You are Codex. Learn skills from this YouTube transcript and produce a reproducible procedure.',
      'Respond with JSON ONLY (no prose) shaped exactly as:',
      '{"summary": string, "skills": [string], "procedure": [string], "checklist": [string]}',
      'Rules: keep items concise; max 8 bullets in each list; no markdown; no extra fields.',
      focus,
      `Transcript: ${transcript.slice(0, 12000)}`,
    ].join('\n');
  }
  return `Unsupported task type: ${task.type}`;
}

function parseFirstJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function resolveProviderConfig(providerName, preferredModel) {
  const store = loadProviderStore();
  const provider = store.providers && providerName ? store.providers[providerName] : null;
  if (!provider || provider.type !== 'openai') {
    return { ok: false, reason: 'OpenAI provider not configured.' };
  }
  if (!provider.enabled) {
    return { ok: false, reason: 'OpenAI provider disabled.' };
  }
  const apiKey = provider.auth && provider.auth.apiKey ? provider.auth.apiKey : null;
  if (!apiKey) {
    return { ok: false, reason: 'OpenAI API key missing.' };
  }
  const models = registry.openai.models || [];
  const model = preferredModel && models.includes(preferredModel) ? preferredModel : models[0];
  if (!model) {
    return { ok: false, reason: 'No OpenAI model configured.' };
  }
  return { ok: true, apiKey, model };
}

async function runOpenAIAdapter(payload) {
  const task = payload.task;
  const providerName = payload.providerName || '';
  const preferredModel = payload.preferredModel || '';

  const config = resolveProviderConfig(providerName, preferredModel);
  if (!config.ok) {
    return { status: 'failure', error: config.reason };
  }

  const prompt = buildPrompt(task);
  if (prompt.startsWith('Unsupported')) {
    return { status: 'failure', error: prompt };
  }

  const redactedPrompt = redactSecrets(prompt);
  const response = await sendOpenAIResponse({
    apiKey: config.apiKey,
    model: config.model,
    input: redactedPrompt,
    maxOutputTokens: 800,
    temperature: 0.2,
  });

  if (!response.ok) {
    return { status: 'failure', error: 'OpenAI API error.' };
  }

  let output = response.text;
  if (task.type === 'youtube_analysis') {
    const parsed = parseFirstJson(response.text);
    if (parsed && parsed.summary && parsed.skills && parsed.procedure && parsed.checklist) {
      output = parsed;
    }
  }

  return { status: 'success', output };
}

async function main() {
  try {
    const raw = process.env.OPENAI_ADAPTER_PAYLOAD || '';
    if (!raw) {
      throw new Error('Missing OPENAI_ADAPTER_PAYLOAD.');
    }
    const payload = JSON.parse(raw);
    const result = await runOpenAIAdapter(payload);
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stdout.write(JSON.stringify({ status: 'failure', error: String(err.message || err) }));
  }
}

if (require.main === module) {
  main();
}

module.exports = { runOpenAIAdapter };
