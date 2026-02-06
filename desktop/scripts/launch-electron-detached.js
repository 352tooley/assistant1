const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

const cwd = path.join(__dirname, '..');
const env = {
  ...process.env,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173',
};

const child = spawn(electron, ['.', '--enable-logging'], {
  cwd,
  env,
  detached: true,
  stdio: 'ignore',
});

child.unref();
console.log('Launched Electron in detached mode (pid:', child.pid + ').');
