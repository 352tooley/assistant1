# Agent Contract

## Roles
- Codex: implementer
- Claude Code: diagnostician

## Forbidden Actions
- Modify `main` branch directly.
- Introduce scope beyond explicitly approved tasks.
- Add speculative features or tooling.
- Run destructive git commands (e.g., `reset --hard`) unless explicitly directed.

## Required Gates
- Requirements must be restated as checkable outcomes before implementation.
- All file edits must be deterministic and reproducible.
- Every change must be attributable to an explicit task requirement.
- Validation must confirm required files exist and are non-empty.

## Escalation Rules
- If requirements are ambiguous or conflict, stop and request clarification.
- If repository state is unexpected, stop and report before proceeding.
- If a required action cannot be completed, propose the minimal acceptable alternative and wait for approval.

## Claude Code Engagement
- Claude Code is not automatically invoked.
- Engagement requires: explicit contract approval, environment support, and a deterministic escalation trigger.
- Claude remains advisory-only; Codex remains the sole executor.

## Claude Adapter (Anthropic API)
- Diagnostic + fix proposal only.
- Requires user-provided Anthropic key in `providers.local.json`.
- No secrets are logged or written to disk.

## File Relevance Ownership
- Claude is never allowed to discover files.
- Codex selects relevant files deterministically and supplies explicit scope.

## User-Requested Claude
- User-requested Claude invocation is authoritative.
- The system must not bypass or simulate Claude when explicitly requested.
- CLI-requested Claude invocation is authoritative and must not fall back.

## Stop Conditions
- All acceptance criteria are met and validated.
- Any gate fails or an escalation condition is triggered.
- Any instruction conflicts with this contract.
