const fs = require('fs');
const path = require('path');
const registry = require('./providerRegistry');

const providersPath = path.join(process.cwd(), 'providers', 'providers.local.json');

function loadProviderStore() {
  if (!fs.existsSync(providersPath)) {
    return { providers: {} };
  }
  try {
    const raw = fs.readFileSync(providersPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && parsed.providers ? parsed : { providers: {} };
  } catch {
    return { providers: {} };
  }
}

function saveProviderStore(store) {
  const dir = path.dirname(providersPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(providersPath, JSON.stringify(store, null, 2), 'utf8');
}

function ensureArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function hasAuth(provider) {
  if (!provider || !provider.authMethod) {
    return false;
  }
  if (provider.authMethod === 'apiKey') {
    return Boolean(provider.auth && provider.auth.apiKey);
  }
  if (provider.authMethod === 'oauth') {
    return Boolean(provider.auth && provider.auth.oauth && provider.auth.oauth.token);
  }
  return false;
}

function sanitizeProvider(name, provider) {
  const type = provider.type;
  const meta = registry[type] || {};
  return {
    name,
    type,
    label: meta.label || type,
    enabled: Boolean(provider.enabled),
    authMethod: provider.authMethod || null,
    authStatus: {
      apiKey: Boolean(provider.auth && provider.auth.apiKey),
      oauth: Boolean(provider.auth && provider.auth.oauth && provider.auth.oauth.token),
    },
    roles: Array.isArray(provider.roles) ? provider.roles : [],
    projects: Array.isArray(provider.projects) ? provider.projects : [],
    allowedRoles: meta.roles || [],
    allowedAuth: meta.auth || [],
    models: meta.models || [],
  };
}

function getAvailableProviders() {
  const store = loadProviderStore();
  const providers = Object.entries(store.providers || {}).map(([name, provider]) =>
    sanitizeProvider(name, provider)
  );
  return { registry, providers };
}

function addProvider({ name, type, authMethod, apiKey }) {
  if (!name || !type) {
    return { ok: false, reason: 'name and type are required.' };
  }
  if (!registry[type]) {
    return { ok: false, reason: 'Unknown provider type.' };
  }
  const store = loadProviderStore();
  if (store.providers[name]) {
    return { ok: false, reason: 'Provider name already exists.' };
  }
  if (authMethod && !registry[type].auth.includes(authMethod)) {
    return { ok: false, reason: 'Auth method not allowed for provider type.' };
  }
  const provider = {
    type,
    authMethod: authMethod || registry[type].auth[0] || 'apiKey',
    auth: {},
    roles: [],
    projects: [],
    enabled: false,
  };
  if (provider.authMethod === 'apiKey' && apiKey) {
    provider.auth.apiKey = apiKey;
    provider.enabled = true;
  }
  if (provider.authMethod === 'oauth') {
    provider.auth.oauth = { status: 'required' };
  }
  store.providers[name] = provider;
  saveProviderStore(store);
  return { ok: true, provider: sanitizeProvider(name, provider) };
}

function enableProvider(name) {
  const store = loadProviderStore();
  const provider = store.providers[name];
  if (!provider) {
    return { ok: false, reason: 'Provider not found.' };
  }
  if (!hasAuth(provider)) {
    return { ok: false, reason: 'Missing auth for provider.' };
  }
  provider.enabled = true;
  saveProviderStore(store);
  return { ok: true, provider: sanitizeProvider(name, provider) };
}

function disableProvider(name) {
  const store = loadProviderStore();
  const provider = store.providers[name];
  if (!provider) {
    return { ok: false, reason: 'Provider not found.' };
  }
  provider.enabled = false;
  saveProviderStore(store);
  return { ok: true, provider: sanitizeProvider(name, provider) };
}

function assignRoles(name, roles) {
  const store = loadProviderStore();
  const provider = store.providers[name];
  if (!provider) {
    return { ok: false, reason: 'Provider not found.' };
  }
  const allowed = registry[provider.type] ? registry[provider.type].roles : [];
  const nextRoles = ensureArray(roles);
  const invalid = nextRoles.filter((role) => !allowed.includes(role));
  if (invalid.length > 0) {
    return { ok: false, reason: 'One or more roles not allowed.' };
  }
  provider.roles = nextRoles;
  saveProviderStore(store);
  return { ok: true, provider: sanitizeProvider(name, provider) };
}

function assignProjects(name, projects) {
  const store = loadProviderStore();
  const provider = store.providers[name];
  if (!provider) {
    return { ok: false, reason: 'Provider not found.' };
  }
  provider.projects = ensureArray(projects);
  saveProviderStore(store);
  return { ok: true, provider: sanitizeProvider(name, provider) };
}

function validateProviderForRun({ preferredProvider, preferredRole, preferredModel }) {
  if (!preferredProvider) {
    return { ok: true };
  }
  const store = loadProviderStore();
  const provider = store.providers[preferredProvider];
  if (!provider) {
    return { ok: false, reason: 'Preferred provider not found.' };
  }
  if (!provider.enabled) {
    return { ok: false, reason: 'Preferred provider is disabled.' };
  }
  if (!hasAuth(provider)) {
    return { ok: false, reason: 'Preferred provider missing auth.' };
  }
  if (preferredRole) {
    const allowed = registry[provider.type] ? registry[provider.type].roles : [];
    if (!allowed.includes(preferredRole)) {
      return { ok: false, reason: 'Preferred role not allowed for provider type.' };
    }
    if (!provider.roles.includes(preferredRole)) {
      return { ok: false, reason: 'Preferred role not assigned to provider.' };
    }
  }
  if (preferredModel) {
    const models = registry[provider.type] ? registry[provider.type].models : [];
    if (models.length > 0 && !models.includes(preferredModel)) {
      return { ok: false, reason: 'Preferred model not supported by provider.' };
    }
  }
  return { ok: true, provider: { name: preferredProvider, type: provider.type } };
}

module.exports = {
  getAvailableProviders,
  addProvider,
  enableProvider,
  disableProvider,
  assignRoles,
  assignProjects,
  validateProviderForRun,
};
