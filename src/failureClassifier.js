const failureCounts = new Map();

function classifyFailure(failure, taskId) {
  const previous = failureCounts.get(taskId) || 0;
  const current = previous + 1;
  failureCounts.set(taskId, current);

  const classification = current >= 2 ? 'complex' : 'simple';

  return {
    classification,
    count: current,
    taskId,
    message: failure && failure.message ? failure.message : 'Unknown failure',
  };
}

module.exports = {
  classifyFailure,
};
