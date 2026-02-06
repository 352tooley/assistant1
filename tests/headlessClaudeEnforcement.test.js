const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runHeadless } = require('../src/orchestrator');

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

test('headless dry-run with claude enabled succeeds', () => {
  writeProviderConfig(true);
  const result = runHeadless(
    {
      reset: false,
      headless: true,
      mode: 'standard',
      requestedAdvisor: 'claude',
      dryRun: true,
      pollIntervalMs: 5000,
      maxCycles: 1,
      maxRuntimeMs: 1000,
    },
    { cliCommand: 'headless start', operatorIntent: 'headless start' }
  );

  assert.equal(result.status, 'dry_run_ok');
  cleanupProviderConfig();
});

test('headless dry-run with claude disabled fails immediately', () => {
  writeProviderConfig(false);
  assert.throws(() => {
    runHeadless(
      {
        reset: false,
        headless: true,
        mode: 'standard',
        requestedAdvisor: 'claude',
        dryRun: true,
        pollIntervalMs: 5000,
        maxCycles: 1,
        maxRuntimeMs: 1000,
      },
      { cliCommand: 'headless start', operatorIntent: 'headless start' }
    );
  });
  cleanupProviderConfig();
});
