const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const path = require('path');
const { runClaudeAdapter } = require('../src/agents/claudeAdapter');
const { redactSecrets } = require('../src/redaction');

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

test('redactSecrets masks known key patterns', () => {
  const input = {
    token: 'sk-ant-123456',
    bearer: 'Bearer abc.def',
    url: 'https://example.com?token=secret&key=abc',
  };
  const output = redactSecrets(input);
  assert.equal(output.token, 'REDACTED');
  assert.equal(output.bearer, 'Bearer REDACTED');
  assert.match(output.url, /token=REDACTED/);
});

test('claudeAdapter success path parses valid JSON', async () => {
  const originalFetch = global.fetch;
  writeProviderConfig(true);
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.messages[0].content.includes('"trigger"'));
    assert.ok(!body.messages[0].content.includes('sk-ant-REDACT'));
    return {
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              diagnosis: 'Issue identified',
              rootCause: 'Bad expectedOutput',
              confidence: 'high',
              proposedFix: {
                kind: 'fixPacket',
                packet: {
                  reason: 'Fix expectedOutput',
                  changes: [{ path: 'src/orchestrator.js', op: 'replace', content: 'expectedOutput = 6' }],
                },
              },
            }),
          },
        ],
      }),
    };
  };

  const result = await runClaudeAdapter({
    trigger: 'repeated_deterministic_failure',
    failureContext: { error: 'sk-ant-REDACT', classification: 'complex', failureCount: 2 },
    repoContext: null,
    constraints: null,
  });

  assert.equal(result.status, 'success');
  assert.ok(result.proposedFixPacket);
  global.fetch = originalFetch;
  cleanupProviderConfig();
});

test('claudeAdapter handles invalid JSON gracefully', async () => {
  const originalFetch = global.fetch;
  writeProviderConfig(true);
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: 'not-json' }] }),
  });

  const result = await runClaudeAdapter({
    trigger: 'repeated_deterministic_failure',
    failureContext: { error: 'fail', classification: 'complex', failureCount: 2 },
    repoContext: null,
    constraints: null,
  });

  assert.equal(result.status, 'failure');
  global.fetch = originalFetch;
  cleanupProviderConfig();
});

test('claudeAdapter disabled provider returns failure', async () => {
  writeProviderConfig(false);
  const result = await runClaudeAdapter({
    trigger: 'repeated_deterministic_failure',
    failureContext: { error: 'fail', classification: 'complex', failureCount: 2 },
    repoContext: null,
    constraints: null,
  });
  assert.equal(result.status, 'failure');
  cleanupProviderConfig();
});
