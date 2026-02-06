# System Limits

## Safety Limits
- Healing attempts: one per issue.
- Forward-fix only; no history rewriting.
- Claude escalation is advisory and escalation-only.
- Advisors are non-binding.

## Headless Limits
- Max cycles and max runtime are enforced in headless mode.
- Polling is blocking and deterministic.
- Operator stop flag: `state/STOP`.

## Routing Modes
- `standard`: default behavior with explicit reasons.
- `budget`: suppresses eligible Claude calls when safe.
- `diagnostic`: allows deeper analysis but still bounded.

## What The System Will Never Do
- Start background daemons or servers.
- Modify `main` branch directly.
- Rebase or rewrite history.
- Execute unbounded loops.
- Bypass acceptance or routing controls.

## Known Non-Goals
- Automated CI integration.
- External interfaces beyond the CLI.
- Async or concurrent execution.
- Autonomous feature expansion.
