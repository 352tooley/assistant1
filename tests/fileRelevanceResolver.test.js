const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveRelevantFiles } = require('../src/fileRelevanceResolver');

test('file relevance resolver is deterministic', () => {
  const input = {
    trigger: 'repeated_deterministic_failure',
    failureContext: { error: 'expectedOutput mismatch', classification: 'complex' },
    lastActions: null,
    recentCommits: null,
  };
  const first = resolveRelevantFiles(input);
  const second = resolveRelevantFiles(input);
  assert.deepEqual(first, second);
  assert.ok(first.allowedFiles.length <= first.maxFiles);
});

test('expectedOutput mismatch maps to orchestrator', () => {
  const result = resolveRelevantFiles({
    trigger: 'repeated_deterministic_failure',
    failureContext: { error: 'expectedOutput mismatch', classification: 'complex' },
  });
  const paths = result.allowedFiles.map((entry) => entry.path);
  assert.ok(paths.includes('src/orchestrator.js'));
});
