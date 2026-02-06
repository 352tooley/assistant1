# Context Bundle (assistant1)

## Purpose
assistant1 is a deterministic, audited, autonomous multi-agent engineering assistant. Codex executes changes; Claude (when enabled) diagnoses only. The orchestrator owns routing and execution decisions.

## Current State
- Branch: agent/codex/bootstrap
- Desktop UI: Electron + React (dev-ui vs production entrypoints).
- Orchestrator enforces: routing, validation, dry-run, headless parity, provider/role checks.
- State and logs: untracked runtime state; loop log and audit index are authoritative.

## Non-Negotiable Invariants
- Do not commit to main.
- No execution authority moves into UI.
- Claude is advisory-only; Codex executes.
- Validation gates must be enforced before execution.

## Entry Points
- CLI: `src/cli.js`
- Orchestrator: `src/orchestrator.js`
- Desktop dev UI: `desktop/dev-ui.js`
- Desktop production: `desktop/electron/main.js`
- Preload bridge: `desktop/electron/preload.js`

## Critical References
- Agent contract: `docs/AGENT_CONTRACT.md`
- Electron entrypoints: `docs/electron_instances.md`
- System limits: `docs/SYSTEM_LIMITS.md`
- Acceptance criteria: `docs/ACCEPTANCE.md`
- Decisions: `docs/DECISIONS.md`
- Loop log: `docs/LOOP_LOG.md`

## Provider System
- Registry: `src/providerRegistry.js`
- Manager: `src/providerManager.js`
- Local provider config: `providers/providers.local.json` (gitignored)

## Task Flow (High-Level)
1. UI/CLI declares intent
2. Orchestrator validates (task, advisor, provider/role)
3. Execution runs (bounded)
4. Logs + audit index appended

## Logs and State
- Loop log: `docs/LOOP_LOG.md`
- Audit index: `audit/auditIndex.json`
- Runtime state (untracked): `state/runtime.json`
- Stop flag: `state/STOP`

## Directory Map (Core)
- `src/` engine + orchestration
- `desktop/` Electron + UI
- `docs/` governance + logs
- `tests/` node:test suites

## Recent Work (Update Manually)
- Provider registry + manager added
- Desktop UI: run configuration, dry-run, provider awareness
- Claude enforcement: headless + dry-run parity

