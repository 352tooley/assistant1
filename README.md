# assistant1

assistant1 is an autonomous multi-agent engineering assistant that coordinates implementation and diagnosis to deliver deterministic, auditable changes. It is built and operated by AI agents under explicit contracts and acceptance criteria.

## What It Is
- A deterministic orchestration system for Codex execution with Claude diagnostic escalation.
- A bounded, auditable loop with persistent state, safe headless mode, and an operator CLI.

## What It Is Not
- A general-purpose autonomous agent with unrestricted actions.
- A networked service, daemon, or background worker.
- A system that rewrites history or self-modifies without guardrails.

## How To Run

### One-off
```bash
node src/cli.js run-once
```

### Headless (Always-On)
```bash
node src/cli.js headless start --max-cycles=10 --max-runtime-ms=60000 --poll-interval-ms=5000
```

### Reset Runtime State
```bash
node src/cli.js reset
```

### Status (Read-Only)
```bash
node src/cli.js status
```

## Safety Guarantees
- Orchestrator owns routing and execution decisions.
- Claude is escalation-only and advisory.
- Advisors are non-binding.
- One healing attempt per issue.
- Forward-fix only; history remains immutable.
- Headless mode enforces max cycles and runtime.

## Untracked Files
State is intentionally untracked to preserve operator control:
- `state/runtime.json`
- `state/STOP`

## Stopping Safely
Create the stop flag file to request headless shutdown:
```bash
touch state/STOP
```

## Logs
- Primary log: `docs/LOOP_LOG.md`
- Decisions: `docs/DECISIONS.md`
- System limits: `docs/SYSTEM_LIMITS.md`
