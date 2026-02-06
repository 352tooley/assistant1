CRITICAL: Desktop Electron Instance Map — Read Before Touching Any Electron File   
                                                                                                                                                                                                                                                                              
  This project has TWO separate Electron entry points. They are NOT interchangeable. Every IPC handler, lifecycle fix, or crash fix MUST be applied to the CORRECT file. Getting this wrong has caused repeated crashes.                                                      

  The Two Entry Points

  1. desktop/dev-ui.js — DEV UI LAUNCHER (this is what npm run ui runs)

  - Command: VITE_DEV_SERVER_URL=http://localhost:5173 electron ./dev-ui.js
  - npm script: npm run ui
  - Purpose: UI-only iteration. No engine, no orchestrator, no task execution.
  - IPC handlers: All stubs returning safe defaults (zeros, empty arrays, nulls, { ok: false })
  - When the user says "desktop ui" or "dev ui" or "the electron window" during UI work, they mean THIS file.
  - This file does NOT import orchestrator.js, auditReader.js, templateResolver.js, or claudeAdapter.js
  - All 10 IPC channels must have stub handlers here: get-status, get-live-run-status, get-agents, get-audit-summary, get-audit-runs, get-audit-run, build-task-preview, execute-approved-task, run-dry-run, check-claude-availability

  2. desktop/electron/main.js — PRODUCTION ELECTRON (this is what npm run electron and npm run start run)

  - Command: VITE_DEV_SERVER_URL=http://localhost:5173 electron . (resolves via "main": "electron/main.js" in package.json)
  - npm scripts: npm run electron, npm run start
  - Purpose: Full engine integration. IPC handlers call real orchestrator, auditReader, templateResolver, claudeAdapter.
  - IPC handlers: Live — they require() real modules from src/ and return real data.
  - When the user says "production electron" or "full app" or is debugging engine/task/audit issues, they mean THIS file.

  3. desktop/electron/preload.js — SHARED by both entry points

  - Exposes window.assistant1 API to the renderer via contextBridge
  - Defines ALL IPC channels the renderer can call
  - If you add a new IPC channel here, you MUST add a stub handler in dev-ui.js AND a real handler in electron/main.js

  Decision Rules
  ┌────────────────────────────────────────────┬─────────────────────────────────────────────┐
  │                 User says                  │               File to modify                │
  ├────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ "desktop ui crashes/closes"                │ desktop/dev-ui.js                           │
  ├────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ "dev ui" or "npm run ui"                   │ desktop/dev-ui.js                           │
  ├────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ "electron keeps crashing" (during UI work) │ desktop/dev-ui.js                           │
  ├────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ "production app crashes"                   │ desktop/electron/main.js                    │
  ├────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ "npm run electron" or "npm run start"      │ desktop/electron/main.js                    │
  ├────────────────────────────────────────────┼─────────────────────────────────────────────┤
  │ "add new IPC channel"                      │ ALL THREE: preload.js + main.js + dev-ui.js │
  └────────────────────────────────────────────┴─────────────────────────────────────────────┘
  Rules

  1. NEVER add a channel to preload.js without adding handlers to BOTH main.js and dev-ui.js
  2. NEVER assume electron/main.js is the entry point when the user is doing UI work — it's dev-ui.js
  3. ALWAYS check preload.js for the full list of IPC channels before claiming coverage is complete
  4. If Electron shows "No handler registered for X" errors, the fix goes in whichever entry point is being run — check the launch command
  5. Both files must independently handle all Electron lifecycle events: close, closed, window-all-closed, before-quit, render-process-gone
