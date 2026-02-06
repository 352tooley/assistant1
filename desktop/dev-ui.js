/**
 * Desktop UI Dev Launcher
 * Purpose: Open the Desktop UI for rapid visual + functional iteration
 * Scope: UI only (no engine execution)
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

process.on('uncaughtException', (err) => {
  console.error('UI launcher crash:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UI launcher rejection:', err);
});

let win;
let isQuitting = false;

function createWindow() {
  win = new BrowserWindow({
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
      console.error('❌ UI window close intercepted; keeping alive.');
      event.preventDefault();
      win.hide();
      setTimeout(() => {
        if (win) {
          win.show();
        }
      }, 250);
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

app.whenReady().then(createWindow);

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
