# Desktop Control Center

## Prerequisites
- Node.js 18+ recommended
- npm (bundled with Node)

## Install
```bash
cd desktop
npm install
```

## Run UI (Dev)
```bash
npm run dev
```

## Run Electron App
```bash
npm run electron
```

## Run Smoke Test
```bash
npm run smoke
```

## Logs
- Engine log: `docs/LOOP_LOG.md`

## Common Issues
- IPC preload not loaded: ensure `electron/preload.js` is referenced in `electron/main.js`.
- Vite dev server timing: if Electron opens before Vite is ready, re-run `npm run dev`.

## Safety Note
The desktop UI only runs approved tasks from whitelisted templates. Execution is bounded (max cycles/runtime) and all actions are logged.
