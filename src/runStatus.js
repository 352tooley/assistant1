function createRunStatus({ runId, status, phase, message, progress }) {
  const timestamp = new Date().toISOString();
  return {
    runId,
    status,
    phase,
    message,
    startedAt: timestamp,
    updatedAt: timestamp,
    progress: progress || null,
  };
}

function updateRunStatus(current, updates) {
  if (!current) {
    return null;
  }
  return {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  createRunStatus,
  updateRunStatus,
};
