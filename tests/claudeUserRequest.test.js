const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runApprovedTask } = require('../src/orchestrator');

const providerPath = path.join(process.cwd(), 'providers.local.json');

function writeProviderConfig(enabled) {
  const config = {
    anthropic: {
      enabled,
      apiKey: 'sk-ant-test-key',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 200,
      temperature: 0,
    },
  };
  fs.writeFileSync(providerPath, JSON.stringify(config), 'utf8');
}

function cleanupProviderConfig() {
  if (fs.existsSync(providerPath)) {
    fs.unlinkSync(providerPath);
  }
}

test('user requested claude invokes adapter when enabled', () => {
  writeProviderConfig(true);
  process.env.CLAUDE_ADAPTER_MOCK_RESPONSE = JSON.stringify({
    diagnosis: 'Mocked diagnosis',
    rootCause: 'Mocked root',
    confidence: 'high',
    proposedFix: {
      kind: 'noFix',
      packet: null,
    },
  });

  const result = runApprovedTask({
    templateId: 'web_build_basic',
    inputs: { siteName: 'Acme' },
    requestedAgentRole: 'DevOps',
    requestedAdvisor: 'claude',
    mode: 'standard',
    limits: { maxCycles: 1, maxRuntimeMs: 120000 },
    allowsClaude: false,
  });

  assert.equal(result.status, 'failure');
  delete process.env.CLAUDE_ADAPTER_MOCK_RESPONSE;
  cleanupProviderConfig();
});

test('user requested claude fails when adapter unavailable', () => {
  writeProviderConfig(false);
  assert.throws(() => {
    runApprovedTask({
      templateId: 'web_build_basic',
      inputs: { siteName: 'Acme' },
      requestedAgentRole: 'DevOps',
      requestedAdvisor: 'claude',
      mode: 'standard',
      limits: { maxCycles: 1, maxRuntimeMs: 120000 },
      allowsClaude: false,
    });
  });
  cleanupProviderConfig();
});

test('auto mode still executes codex path', () => {
  writeProviderConfig(false);
  const result = runApprovedTask({
    templateId: 'web_build_basic',
    inputs: { siteName: 'Acme' },
    requestedAgentRole: 'DevOps',
    requestedAdvisor: 'auto',
    mode: 'standard',
    limits: { maxCycles: 1, maxRuntimeMs: 120000 },
    allowsClaude: false,
  });
  assert.equal(result.status, 'success');
  cleanupProviderConfig();
});
