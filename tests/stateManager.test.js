const { test } = require('node:test');
const assert = require('node:assert');
const { loadState } = require('../src/stateManager');

test('loadState handles missing tasks parameter', () => {
  // This should not throw TypeError anymore
  const result = loadState();
  
  assert.ok(result, 'loadState should return a result');
  assert.ok(result.state, 'loadState should return a state object');
  assert.ok(result.status, 'loadState should return a status');
  assert.ok(Array.isArray(result.state.taskQueue), 'taskQueue should be an array');
  assert.strictEqual(result.state.taskQueue.length, 0, 'taskQueue should be empty when no tasks provided');
});

test('loadState accepts empty array', () => {
  const result = loadState([]);
  
  assert.ok(result.state, 'loadState should return a state object');
  assert.ok(Array.isArray(result.state.taskQueue), 'taskQueue should be an array');
  assert.strictEqual(result.state.taskQueue.length, 0, 'taskQueue should be empty');
});

test('loadState processes tasks when provided', () => {
  const tasks = [
    { id: 'task1', name: 'Test Task 1' },
    { id: 'task2', name: 'Test Task 2' }
  ];
  const result = loadState(tasks, { reset: true });
  
  assert.ok(result.state, 'loadState should return a state object');
  assert.ok(Array.isArray(result.state.taskQueue), 'taskQueue should be an array');
  assert.strictEqual(result.state.taskQueue.length, 2, 'taskQueue should have 2 tasks');
  assert.strictEqual(result.state.taskQueue[0].id, 'task1', 'First task should be task1');
  assert.strictEqual(result.state.taskQueue[0].status, 'pending', 'Tasks should have pending status');
});
