const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  addProvider,
  assignRoles,
  assignProjects,
  enableProvider,
  disableProvider,
  validateProviderForRun,
} = require('../src/providerManager');

const providersPath = path.join(process.cwd(), 'providers', 'providers.local.json');

function resetStore() {
  const dir = path.dirname(providersPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(providersPath, JSON.stringify({ providers: {} }, null, 2), 'utf8');
}

test('add provider with api key and enable', () => {
  resetStore();
  const result = addProvider({ name: 'myClaude', type: 'anthropic', authMethod: 'apiKey', apiKey: 'sk-ant-test' });
  assert.equal(result.ok, true);
  const enabled = enableProvider('myClaude');
  assert.equal(enabled.ok, true);
});

test('assign invalid role fails', () => {
  resetStore();
  addProvider({ name: 'myOpenAI', type: 'openai', authMethod: 'apiKey', apiKey: 'sk-test' });
  const result = assignRoles('myOpenAI', ['invalid-role']);
  assert.equal(result.ok, false);
});

test('validate provider for run enforces role assignment', () => {
  resetStore();
  addProvider({ name: 'myOpenAI', type: 'openai', authMethod: 'apiKey', apiKey: 'sk-test' });
  assignRoles('myOpenAI', ['coder']);
  const ok = validateProviderForRun({ preferredProvider: 'myOpenAI', preferredRole: 'coder' });
  assert.equal(ok.ok, true);
  const bad = validateProviderForRun({ preferredProvider: 'myOpenAI', preferredRole: 'planner' });
  assert.equal(bad.ok, false);
});

test('disabled provider is rejected', () => {
  resetStore();
  addProvider({ name: 'myOpenAI', type: 'openai', authMethod: 'apiKey', apiKey: 'sk-test' });
  disableProvider('myOpenAI');
  const result = validateProviderForRun({ preferredProvider: 'myOpenAI', preferredRole: '' });
  assert.equal(result.ok, false);
});

test('missing auth blocks provider', () => {
  resetStore();
  addProvider({ name: 'noAuth', type: 'openai', authMethod: 'apiKey' });
  const result = validateProviderForRun({ preferredProvider: 'noAuth', preferredRole: '' });
  assert.equal(result.ok, false);
});

test('assign projects accepts list', () => {
  resetStore();
  addProvider({ name: 'myOpenAI', type: 'openai', authMethod: 'apiKey', apiKey: 'sk-test' });
  const result = assignProjects('myOpenAI', ['project-a', 'project-b']);
  assert.equal(result.ok, true);
});

test('unsupported model is rejected', () => {
  resetStore();
  addProvider({ name: 'myClaude', type: 'anthropic', authMethod: 'apiKey', apiKey: 'sk-test' });
  assignRoles('myClaude', ['reviewer']);
  const result = validateProviderForRun({ preferredProvider: 'myClaude', preferredRole: 'reviewer', preferredModel: 'unknown-model' });
  assert.equal(result.ok, false);
});
