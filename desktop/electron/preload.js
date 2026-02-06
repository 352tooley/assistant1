const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assistant1', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  getAgents: () => ipcRenderer.invoke('get-agents'),
  buildTaskPreview: (naturalLanguage) => ipcRenderer.invoke('build-task-preview', naturalLanguage),
  executeApprovedTask: (taskRequest) => ipcRenderer.invoke('execute-approved-task', taskRequest),
  getLiveRunStatus: () => ipcRenderer.invoke('get-live-run-status'),
  getAuditSummary: () => ipcRenderer.invoke('get-audit-summary'),
  getAuditRuns: (filters) => ipcRenderer.invoke('get-audit-runs', filters),
  getAuditRun: (runId) => ipcRenderer.invoke('get-audit-run', runId),
});
