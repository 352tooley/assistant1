const XAI_URL = 'https://api.x.ai/v1/responses';

async function sendXAIResponse({ apiKey, model, input, maxOutputTokens = 800, temperature = 0.2 }) {
  const res = await fetch(XAI_URL, {
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
}

module.exports = { sendXAIResponse };
