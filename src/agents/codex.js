function runCodex(task) {
  const shouldFail = task && (task.forceFailure === true || String(task.id).includes('fail'));

  if (shouldFail) {
    return {
      status: 'failure',
      message: `Codex failed to complete task ${task.id}`,
    };
  }

  return {
    status: 'success',
    message: `Codex completed task ${task.id}`,
  };
}

module.exports = {
  runCodex,
};
