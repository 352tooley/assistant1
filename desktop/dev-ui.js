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

// Register stub IPC handlers so the renderer does not flood stderr with
// "No handler registered" errors on every poll cycle.
function registerDevIpc() {
  ipcMain.handle('get-status', async () => ({
    pending: 0,
    completed: 0,
    failed: 0,
    lastRunTimestamp: null,
    mode: 'standard',
    usage: { codexCalls: 0, claudeCalls: 0 },
    headlessStatus: 'idle',
    stopFlag: false,
  }));

  ipcMain.handle('get-live-run-status', async () => null);

  ipcMain.handle('get-agents', async () => [
    { id: 'codex', name: 'Codex', role: 'Implementer', status: 'active' },
    { id: 'claude', name: 'Claude', role: 'Diagnostician', status: 'standby' },
    { id: 'planner', name: 'Planner', role: 'Advisor', status: 'advisory' },
  ]);

  ipcMain.handle('get-audit-summary', async () => ({
    total: 0, success: 0, failure: 0, rejected: 0, escalations: 0, healings: 0,
  }));

  ipcMain.handle('get-audit-runs', async () => []);
  ipcMain.handle('get-audit-run', async () => null);

  ipcMain.handle('build-task-preview', async () => ({
    template: null, confidence: 0, extractedInputs: {}, missingInputs: [],
  }));

  ipcMain.handle('execute-approved-task', async () => ({
    status: 'rejected', message: 'Engine not available in dev-ui mode.',
  }));
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
