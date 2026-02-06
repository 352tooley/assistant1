const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assistant1', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  getAgents: () => ipcRenderer.invoke('get-agents'),
  buildTaskPreview: (naturalLanguage) => ipcRenderer.invoke('build-task-preview', naturalLanguage),
});
