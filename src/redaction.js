function redactString(value) {
  let text = value;
  text = text.replace(/sk-ant-[\w-]+/gi, 'REDACTED');
  text = text.replace(/sk-[\w-]+/gi, 'REDACTED');
  text = text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer REDACTED');
  text = text.replace(/(token|key|api_key)=([^&\s]+)/gi, '$1=REDACTED');
  return text;
}

function redactSecrets(input) {
  if (typeof input === 'string') {
    return redactString(input);
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item));
  }
  if (input && typeof input === 'object') {
    const clone = {};
    Object.keys(input).forEach((key) => {
      clone[key] = redactSecrets(input[key]);
    });
    return clone;
  }
  return input;
}

module.exports = {
  redactSecrets,
};
