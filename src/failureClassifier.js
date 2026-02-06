const failureCounts = new Map();

function classifyFailure(failure, taskId, currentCount) {
  const previous = failureCounts.get(taskId) || 0;
  const nextCount = typeof currentCount === 'number' ? currentCount : previous + 1;
  failureCounts.set(taskId, nextCount);

  const classification = nextCount >= 2 ? 'complex' : 'simple';

  return {
    classification,
    count: nextCount,
    taskId,
    message: failure && failure.message ? failure.message : 'Unknown failure',
  };
}

module.exports = {
  classifyFailure,
};
