const ANTHROPIC_VERSION = '2023-06-01';

async function sendAnthropicMessage({ apiKey, model, system, messages, maxTokens, temperature }) {
  if (!apiKey || !model) {
    return { ok: false, error: { status: 0, message: 'Missing API key or model.' } };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        error: { status: response.status, message: text || 'Anthropic API error.' },
      };
    }

    const data = await response.json();
    const contentText = Array.isArray(data.content)
      ? data.content
          .filter((block) => block && block.type === 'text')
          .map((block) => block.text)
          .join('\n')
      : '';
    return { ok: true, contentText, usage: data.usage || null };
  } catch (err) {
    return { ok: false, error: { status: 0, message: String(err.message || err) } };
  }
}

module.exports = {
  ANTHROPIC_VERSION,
  sendAnthropicMessage,
};
