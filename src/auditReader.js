const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const auditFilePath = path.join(repoRoot, 'audit', 'auditIndex.json');

function loadAuditIndex() {
  if (!fs.existsSync(auditFilePath)) {
    return { version: 1, runs: [] };
  }
  const raw = fs.readFileSync(auditFilePath, 'utf8');
  return JSON.parse(raw);
}

function saveAuditIndex(index) {
  const dir = path.dirname(auditFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(auditFilePath, JSON.stringify(index, null, 2), 'utf8');
}

function appendAuditEntry(entry) {
  const index = loadAuditIndex();
  index.runs.push(entry);
  saveAuditIndex(index);
}

function getAuditRuns(filters = {}) {
  const index = loadAuditIndex();
  let runs = index.runs || [];
  if (filters.status) {
    runs = runs.filter((run) => run.status === filters.status);
  }
  if (filters.templateId) {
    runs = runs.filter((run) => run.templateId === filters.templateId);
  }
  if (filters.agentRole) {
    runs = runs.filter((run) => run.agentRole === filters.agentRole);
  }
  if (filters.mode) {
    runs = runs.filter((run) => run.mode === filters.mode);
  }
  return runs;
}

function getAuditSummary() {
  const index = loadAuditIndex();
  const runs = index.runs || [];
  const counts = {
    total: runs.length,
    success: 0,
    failure: 0,
    rejected: 0,
    escalations: 0,
    healings: 0,
  };
  runs.forEach((run) => {
    if (run.status === 'success') counts.success += 1;
    if (run.status === 'failure') counts.failure += 1;
    if (run.status === 'rejected') counts.rejected += 1;
    if (run.decisions && run.decisions.some((d) => d.type === 'escalation')) {
      counts.escalations += 1;
    }
    if (run.decisions && run.decisions.some((d) => d.type === 'healing')) {
      counts.healings += 1;
    }
  });
  return counts;
}

function getAuditRun(runId) {
  const index = loadAuditIndex();
  return (index.runs || []).find((run) => run.runId === runId) || null;
}

module.exports = {
  loadAuditIndex,
  getAuditRuns,
  getAuditSummary,
  getAuditRun,
  appendAuditEntry,
};
