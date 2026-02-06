/**
 * Desktop UI Dev Launcher
 * Purpose: Open the Desktop UI for rapid visual + functional iteration
 * Scope: UI only (no engine execution)
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

process.on('uncaughtException', (err) => {
  console.error('UI launcher crash:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UI launcher rejection:', err);
});

let win;
let isQuitting = false;

const repoRoot = path.resolve(__dirname, '..');

function resolveOrchestrator() {
  return require(path.join(repoRoot, 'src', 'orchestrator.js'));
}

// ---------------------------------------------------------------------------
// Register live IPC handlers (same as electron/main.js — real engine calls)
// ---------------------------------------------------------------------------
function registerDevIpc() {
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

  ipcMain.handle('get-agents', async () => [
    { id: 'codex', name: 'Codex', role: 'Implementer', status: 'active' },
    { id: 'claude', name: 'Claude', role: 'Diagnostician', status: 'standby' },
    { id: 'planner', name: 'Planner', role: 'Advisor', status: 'advisory' },
  ]);

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

  ipcMain.handle('run-dry-run', async (_event, config) => {
    try {
      const { runOnce, runHeadless } = resolveOrchestrator();
      const options = {
        reset: false,
        maxTasks: 1,
        mode: config && config.mode ? config.mode : 'standard',
        requestedAdvisor: config && config.requestedAdvisor ? config.requestedAdvisor : 'auto',
        preferredProvider: config && config.preferredProvider ? config.preferredProvider : '',
        preferredRole: config && config.preferredRole ? config.preferredRole : '',
        dryRun: true,
        pollIntervalMs: 5000,
        maxCycles: 1,
        maxRuntimeMs: 1000,
      };
      if (config && config.headless) {
        return runHeadless({ ...options, headless: true }, { cliCommand: 'desktop:dry-run', operatorIntent: 'dry-run' });
      }
      return runOnce(options, { headlessMode: false, cliCommand: 'desktop:dry-run', operatorIntent: 'dry-run' });
    } catch (error) {
      return { status: 'rejected', message: String(error) };
    }
  });

  ipcMain.handle('check-claude-availability', async () => {
    try {
      const { isClaudeCallable } = require(path.join(repoRoot, 'src', 'agents', 'claudeAdapter.js'));
      return isClaudeCallable('user_requested_cli');
    } catch (error) {
      return { ok: false, reason: 'error' };
    }
  });

  ipcMain.handle('list-available-providers', async () => {
    try {
      const { getAvailableProviders } = require(path.join(repoRoot, 'src', 'providerManager.js'));
      return getAvailableProviders();
    } catch (error) {
      return { registry: {}, providers: [] };
    }
  });

  ipcMain.handle('add-provider', async (_event, payload) => {
    try {
      const { addProvider } = require(path.join(repoRoot, 'src', 'providerManager.js'));
      return addProvider(payload || {});
    } catch (error) {
      return { ok: false, reason: 'error' };
    }
  });

  ipcMain.handle('enable-provider', async (_event, name) => {
    try {
      const { enableProvider } = require(path.join(repoRoot, 'src', 'providerManager.js'));
      return enableProvider(name);
    } catch (error) {
      return { ok: false, reason: 'error' };
    }
  });

  ipcMain.handle('disable-provider', async (_event, name) => {
    try {
      const { disableProvider } = require(path.join(repoRoot, 'src', 'providerManager.js'));
      return disableProvider(name);
    } catch (error) {
      return { ok: false, reason: 'error' };
    }
  });

  ipcMain.handle('assign-roles', async (_event, payload) => {
    try {
      const { assignRoles } = require(path.join(repoRoot, 'src', 'providerManager.js'));
      return assignRoles(payload && payload.name, payload && payload.roles);
    } catch (error) {
      return { ok: false, reason: 'error' };
    }
  });

  ipcMain.handle('assign-projects', async (_event, payload) => {
    try {
      const { assignProjects } = require(path.join(repoRoot, 'src', 'providerManager.js'));
      return assignProjects(payload && payload.name, payload && payload.projects);
    } catch (error) {
      return { ok: false, reason: 'error' };
    }
  });

  ipcMain.handle('request-stop', async () => {
    try {
      const fs = require('fs');
      const stopPath = path.join(repoRoot, 'state', 'STOP');
      fs.mkdirSync(path.join(repoRoot, 'state'), { recursive: true });
      fs.writeFileSync(stopPath, 'stop-requested-from-desktop');
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  });
}

// App-level crash handler — registered once outside createWindow.
app.on('render-process-gone', (_event, webContents, details) => {
  console.error('❌ Render process gone:', details);
  if (win && !win.isDestroyed() && win.webContents === webContents) {
    console.error('❌ Reloading renderer after crash.');
    win.webContents.reload();
  }
});

function createWindow() {
  win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    backgroundColor: '#0B1020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'electron/preload.js'),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  console.log('Launching Desktop UI at:', devUrl);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadURL(devUrl);
  win.webContents.openDevTools();

  win.webContents.on('did-finish-load', () => {
    console.log('UI renderer finished load.');
  });

  win.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error('❌ UI renderer failed to load:', code, desc);
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      console.error('❌ UI window close blocked — use Cmd+Q / Ctrl+Q to quit.');
    }
  });

  win.on('closed', () => {
    console.error('❌ UI window closed.');
    win = null;
    if (!isQuitting) {
      console.error('❌ UI window closed unexpectedly; recreating.');
      setTimeout(createWindow, 500);
    }
  });
}

app.whenReady().then(() => {
  registerDevIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  // DO NOT auto-quit — dev mode
  console.log('All windows closed (dev-ui stays alive)');
});

app.on('before-quit', () => {
  isQuitting = true;
  console.error('❌ UI launcher before-quit detected');
});

setInterval(() => {
  // Keep event loop alive intentionally
}, 10000);
