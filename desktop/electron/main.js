process.on('exit', (code) => {
  console.error('❌ Process exit detected with code:', code);
});

process.on('beforeExit', (code) => {
  console.error('❌ Process beforeExit detected with code:', code);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const originalQuit = app.quit.bind(app);
app.quit = () => {
  console.error('❌ app.quit() called — blocking auto-exit');
};
let isQuitting = false;

function resolveOrchestrator() {
  return require(path.join(repoRoot, 'src', 'orchestrator.js'));
}

let mainWindow;

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      backgroundColor: '#0B1020',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const devUrl = process.env.VITE_DEV_SERVER_URL;

    if (devUrl) {
      console.log('Loading Vite dev server:', devUrl);
      mainWindow.loadURL(devUrl);
      mainWindow.webContents.openDevTools();
    } else {
      const indexPath = path.join(__dirname, '../ui/dist/index.html');
      console.log('Loading production file:', indexPath);
      mainWindow.loadFile(indexPath);
    }

    mainWindow.on('closed', () => {
      console.error('❌ BrowserWindow closed');
      mainWindow = null;
      if (!isQuitting) {
        console.error('❌ Window closed unexpectedly; recreating.');
        setTimeout(createWindow, 500);
      }
    });

    mainWindow.on('close', () => {
      console.error('❌ BrowserWindow close event fired');
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Renderer finished load.');
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('❌ Renderer failed to load:', errorCode, errorDescription);
    });

    app.on('render-process-gone', (_event, details) => {
      console.error('❌ Render process gone:', details);
    });

    app.on('child-process-gone', (_event, details) => {
      console.error('❌ Child process gone:', details);
    });

    mainWindow.on('unresponsive', () => {
      console.error('❌ BrowserWindow unresponsive');
    });
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
});

app.on('window-all-closed', () => {
  console.log('window-all-closed: preventing auto-quit');
});

app.on('before-quit', () => {
  isQuitting = true;
  console.error('❌ app before-quit detected');
});

app.on('quit', () => {
  console.error('❌ app quit detected');
});

setInterval(() => {
  // Keep event loop alive intentionally
}, 10000);
