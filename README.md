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

## Desktop Control Center (Experimental)

The desktop UI is a visual control surface for status, preview, and approved execution.

### How to run
```bash
cd desktop
npm install
npm run dev
```

### What it does
- Displays engine status via IPC (read-only).
- Shows static agent roster and activity.
- Generates a task preview from natural language.
- Runs approved tasks immediately using the orchestrator (bounded and logged).

### What it does NOT do
- Execute freeform prompts.
- Modify engine state outside the orchestrator.
- Bypass orchestrator safeguards or routing policy.

### Approved execution
Clicking Approve creates a validated task request from a template and runs a single bounded orchestration cycle. Limits are enforced (max cycles/runtime, Claude allowance). Results and decisions are logged to `docs/LOOP_LOG.md`.

## Task Templates

Templates define approved task shapes and input requirements. Natural language is matched to a whitelisted template before a preview is generated. This keeps previews deterministic and prevents free-form tasks.

Free prompts are not allowed because they can bypass guardrails and introduce non-deterministic behavior. If input does not match a template, it is not a task.

## Anthropic Claude Adapter

Claude remains escalation-only and advisory. To enable the Anthropic API adapter:

1. Copy `providers.example.json` to `providers.local.json`.
2. Set `"anthropic.enabled": true` and add your `apiKey`.
3. Keep keys out of git and rotate regularly.

The adapter never executes code and never logs secrets. Fix proposals still go through existing validators.
