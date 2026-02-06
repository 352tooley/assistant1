let contextBridge = null;
let ipcRenderer = null;

try {
  const electron = require('electron');
  contextBridge = electron.contextBridge;
  ipcRenderer = electron.ipcRenderer;
} catch (err) {
  console.error('❌ preload failed to load electron:', err);
}

const safeInvoke = (channel, payload, fallback) => {
  if (!ipcRenderer) {
    return Promise.resolve(fallback);
  }
  return ipcRenderer.invoke(channel, payload).catch((err) => {
    console.error(`❌ IPC invoke failed (${channel}):`, err);
    return fallback;
  });
};

const api = {
  getStatus: () => safeInvoke('get-status', undefined, null),
  getAgents: () => safeInvoke('get-agents', undefined, []),
  buildTaskPreview: (naturalLanguage) => safeInvoke('build-task-preview', naturalLanguage, null),
  executeApprovedTask: (taskRequest) =>
    safeInvoke('execute-approved-task', taskRequest, { status: 'rejected', message: 'IPC unavailable.' }),
  runDryRun: (config) =>
    safeInvoke('run-dry-run', config, { status: 'rejected', message: 'IPC unavailable.' }),
  checkClaudeAvailability: () =>
    safeInvoke('check-claude-availability', undefined, { ok: false, reason: 'ipc_unavailable' }),
  listAvailableProviders: () =>
    safeInvoke('list-available-providers', undefined, { registry: {}, providers: [] }),
  addProvider: (payload) => safeInvoke('add-provider', payload, { ok: false, reason: 'ipc_unavailable' }),
  enableProvider: (name) => safeInvoke('enable-provider', name, { ok: false, reason: 'ipc_unavailable' }),
  disableProvider: (name) => safeInvoke('disable-provider', name, { ok: false, reason: 'ipc_unavailable' }),
  assignRoles: (payload) => safeInvoke('assign-roles', payload, { ok: false, reason: 'ipc_unavailable' }),
  assignProjects: (payload) => safeInvoke('assign-projects', payload, { ok: false, reason: 'ipc_unavailable' }),
  getLiveRunStatus: () => safeInvoke('get-live-run-status', undefined, null),
  getAuditSummary: () => safeInvoke('get-audit-summary', undefined, null),
  getAuditRuns: (filters) => safeInvoke('get-audit-runs', filters, []),
  getAuditRun: (runId) => safeInvoke('get-audit-run', runId, null),
};

if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
  contextBridge.exposeInMainWorld('assistant1', api);
} else {
  globalThis.assistant1 = api;
}
