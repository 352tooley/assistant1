const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const runtimePath = path.join(repoRoot, 'state', 'runtime.json');

function sortObjectKeys(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

function createDefaultState(tasks) {
  return {
    version: 1,
    lastRunTimestamp: null,
    taskQueue: tasks.map((task) => ({
      ...task,
      status: 'pending',
      dispatched: false,
      dispatchCount: 0,
    })),
    failureCounts: {},
    healingAttempts: {},
  };
}

function loadState(tasks, options = {}) {
  const reset = options.reset === true;
  if (reset || !fs.existsSync(runtimePath)) {
    return {
      state: createDefaultState(tasks),
      status: 'initialized',
    };
  }

  const raw = fs.readFileSync(runtimePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.taskQueue)) {
      return {
        state: createDefaultState(tasks),
        status: 'initialized',
      };
    }
    parsed.failureCounts = parsed.failureCounts || {};
    parsed.healingAttempts = parsed.healingAttempts || {};
    parsed.lastRunTimestamp = parsed.lastRunTimestamp || null;
    parsed.version = parsed.version || 1;
    return { state: parsed, status: 'loaded' };
  } catch {
    return {
      state: createDefaultState(tasks),
      status: 'initialized',
    };
  }
}

function saveState(state) {
  const payload = {
    version: state.version || 1,
    lastRunTimestamp: new Date().toISOString(),
    taskQueue: state.taskQueue,
    failureCounts: sortObjectKeys(state.failureCounts || {}),
    healingAttempts: sortObjectKeys(state.healingAttempts || {}),
  };
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(runtimePath, serialized, 'utf8');
}

function resetState() {
  if (fs.existsSync(runtimePath)) {
    fs.unlinkSync(runtimePath);
  }
}

function getNextTask(state) {
  return state.taskQueue.find((task) => task.status === 'pending') || null;
}

function markTaskDispatched(state, taskId) {
  const task = state.taskQueue.find((entry) => entry.id === taskId);
  if (!task) {
    return { resumed: false, task: null };
  }
  const resumed = task.dispatched === true;
  task.dispatched = true;
  task.dispatchCount = (task.dispatchCount || 0) + 1;
  return { resumed, task };
}

function markTaskComplete(state, taskId) {
  const task = state.taskQueue.find((entry) => entry.id === taskId);
  if (task) {
    task.status = 'completed';
  }
}

function markTaskFailed(state, taskId) {
  const task = state.taskQueue.find((entry) => entry.id === taskId);
  if (task) {
    task.status = 'failed';
  }
}

function incrementFailure(state, taskId) {
  const current = state.failureCounts[taskId] || 0;
  const next = current + 1;
  state.failureCounts[taskId] = next;
  return next;
}

function recordHealingAttempt(state, taskId) {
  const current = state.healingAttempts[taskId] || 0;
  const next = current + 1;
  state.healingAttempts[taskId] = next;
  return next;
}

function getHealingAttempts(state, taskId) {
  return state.healingAttempts[taskId] || 0;
}

function shouldEscalate(state, taskId) {
  return (state.failureCounts[taskId] || 0) >= 2;
}

module.exports = {
  runtimePath,
  loadState,
  saveState,
  resetState,
  getNextTask,
  markTaskDispatched,
  markTaskComplete,
  markTaskFailed,
  incrementFailure,
  recordHealingAttempt,
  getHealingAttempts,
  shouldEscalate,
};
