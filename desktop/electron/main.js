process.on('uncaughtException', (err) => {
  console.error('❌ Electron main uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Electron main unhandled rejection:', err);
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

function resolveOrchestrator() {
  return require(path.join(repoRoot, 'src', 'orchestrator.js'));
}

function createWindow() {
  try {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('Electron preload path:', preloadPath);
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      backgroundColor: '#0b0c0e',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const devUrl = process.env.UI_DEV_SERVER_URL;
    if (devUrl) {
      console.log('Electron dev URL:', devUrl);
      win.loadURL(devUrl);
    } else {
      const indexPath = path.join(__dirname, '..', 'ui', 'dist', 'index.html');
      console.log('Electron index path:', indexPath);
      win.loadFile(indexPath);
    }
  } catch (err) {
    console.error('❌ Failed to create BrowserWindow:', err);
  }
}

function registerIpc() {
  ipcMain.handle('get-status', async () => {
    try {
      const { getStatusSnapshot } = resolveOrchestrator();
      return getStatusSnapshot();
    } catch (error) {
      return { error: String(error) };
    }
  });

  ipcMain.handle('get-live-run-status', async () => {
    try {
      const { getCurrentRunStatus } = resolveOrchestrator();
      return getCurrentRunStatus();
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('get-audit-summary', async () => {
    try {
      const { getAuditSummary } = require(path.join(repoRoot, 'src', 'auditReader.js'));
      return getAuditSummary();
    } catch (error) {
      return { error: String(error) };
    }
  });

  ipcMain.handle('get-audit-runs', async (_event, filters) => {
    try {
      const { getAuditRuns } = require(path.join(repoRoot, 'src', 'auditReader.js'));
      return getAuditRuns(filters || {});
    } catch (error) {
      return { error: String(error) };
    }
  });

  ipcMain.handle('get-audit-run', async (_event, runId) => {
    try {
      const { getAuditRun } = require(path.join(repoRoot, 'src', 'auditReader.js'));
      return getAuditRun(runId);
    } catch (error) {
      return { error: String(error) };
    }
  });

  ipcMain.handle('get-agents', async () => {
    return [
      { id: 'codex', name: 'Codex', role: 'Implementer', status: 'active' },
      { id: 'claude', name: 'Claude', role: 'Diagnostician', status: 'standby' },
      { id: 'planner', name: 'Planner', role: 'Advisor', status: 'advisory' },
    ];
  });

  ipcMain.handle('build-task-preview', async (_event, naturalLanguage) => {
    try {
      const { resolveTemplate } = require(path.join(repoRoot, 'src', 'templateResolver.js'));
      const result = resolveTemplate(naturalLanguage || '');
      return {
        template: result.template,
        confidence: result.confidence,
        extractedInputs: result.extractedInputs,
        missingInputs: result.missingInputs,
      };
    } catch (error) {
      return { error: String(error) };
    }
  });

  ipcMain.handle('execute-approved-task', async (_event, taskRequest) => {
    try {
      const { runApprovedTask } = resolveOrchestrator();
      return runApprovedTask(taskRequest, { cliCommand: 'desktop:approve', operatorIntent: 'approveAndRun' });
    } catch (error) {
      return { status: 'rejected', message: String(error) };
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
