const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MS = 15000;

async function sendOpenAIResponse({ apiKey, model, input, maxOutputTokens = 800, temperature = 0.2, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: maxOutputTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, error: { status: res.status, message: await res.text() } };
    }

    const json = await res.json();
    if (typeof json.output_text === 'string' && json.output_text.trim().length > 0) {
      return { ok: true, text: json.output_text.trim(), usage: json.usage || null };
    }

    const output = Array.isArray(json.output) ? json.output : [];
    const textChunks = [];
    output.forEach((item) => {
      if (item && Array.isArray(item.content)) {
        item.content.forEach((content) => {
          if (content && content.type === 'output_text' && typeof content.text === 'string') {
            textChunks.push(content.text);
          }
        });
      }
    });

    return { ok: true, text: textChunks.join('\n').trim(), usage: json.usage || null };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return { ok: false, error: { status: 408, message: 'OpenAI request timed out' } };
    }
    return { ok: false, error: { status: 500, message: String(error.message || error) } };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendOpenAIResponse };
