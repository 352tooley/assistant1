const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'providers.local.json');

function loadProviderConfig() {
  if (!fs.existsSync(configPath)) {
    console.warn('⚠️ providers.local.json not found; providers disabled.');
    return { providers: {}, enabled: false };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { providers: parsed, enabled: true };
  } catch (err) {
    console.warn('⚠️ Failed to load providers.local.json; providers disabled:', err.message);
    return { providers: {}, enabled: false };
  }
}

const providerConfig = loadProviderConfig();

module.exports = {
  providerConfig,
  loadProviderConfig,
};
