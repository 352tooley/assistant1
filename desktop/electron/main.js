const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

function resolveOrchestrator() {
  return require(path.join(repoRoot, 'src', 'orchestrator.js'));
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
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
    win.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'ui', 'dist', 'index.html');
    win.loadFile(indexPath);
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
