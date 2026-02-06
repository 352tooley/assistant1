# Architecture Decisions

## 2026-02-06: Multi-Agent Deterministic Orchestration

- Decision: Use a two-agent model where Codex implements and Claude Code diagnoses.
- Rationale: Separates execution from verification to reduce errors.
- Decision: Orchestrate deterministically with explicit gates and logs.
- Rationale: Ensures reproducibility and auditability.
- Decision: Treat this repository as the single source of truth for behavior and state.
- Rationale: Prevents drift between instructions and implementation.

## 2026-02-06: Bootstrap Acceptance Lock

- Decision: Mark bootstrap acceptance items as done after push.
- Rationale: Establishes a stable baseline for subsequent work.
- Decision: Prohibit edits to bootstrap files unless acceptance requires it.
- Rationale: Prevents drift of foundational documents.
- Decision: Any required change to bootstrap files must be logged here.
- Rationale: Maintains auditable change control.

## 2026-02-06: Minimal Orchestrator Loop

- Decision: Implement a synchronous Node.js orchestrator in `src/` to parse acceptance criteria, maintain a task queue, and simulate one agent cycle.
- Rationale: Provides a deterministic local loop without external calls.
- Decision: Orchestrator appends a cycle entry to `docs/LOOP_LOG.md` at runtime.
- Rationale: Satisfies loop logging requirement while keeping edits controlled.

## 2026-02-06: Agent Routing and Escalation

- Decision: Model Codex and Claude as distinct synchronous agent stubs with deterministic routing.
- Rationale: Enables clear control flow without integrating external APIs.
- Decision: Classify first failures as simple and repeated failures as complex to trigger escalation.
- Rationale: Keeps escalation deterministic and easy to verify.
- Decision: Claude remains a stub that always succeeds while real integrations are deferred.
- Rationale: Separates routing logic from future model integration work.

## 2026-02-06: Codex Real Execution Integration

- Decision: Integrate Codex execution first with deterministic task types (text transform and sum computation).
- Rationale: Validates real task handling while keeping scope minimal.
- Decision: Keep Claude stubbed while routing and escalation mature.
- Rationale: Avoids external dependencies until orchestration behavior is stable.
- Decision: Preserve deterministic, synchronous execution without network calls.
- Rationale: Ensures repeatable results and predictable debugging.

## 2026-02-06: Controlled Fix Packets

- Decision: Treat Claude fix packets as advisory input, never authoritative.
- Rationale: Preserves Codex control and prevents unverified changes.
- Decision: Validate fix packets against allowed scope and strategies before applying.
- Rationale: Enforces acceptance constraints and prevents scope expansion.
- Decision: Allow only one healing attempt per escalation, then stop.
- Rationale: Avoids infinite loops and preserves deterministic termination.

## 2026-02-06: Claude Real Escalation Diagnostics (Cycle 4)

- Decision: Claude is invoked only on escalation (complex or repeated failures). It never self-directs.
- Rationale: Preserves deterministic routing where Codex is always the default executor. Claude cannot decide when it runs.
- Decision: Claude does not auto-apply fixes. It returns advisory diagnostics only.
- Rationale: Keeps the orchestrator as the sole authority. Fixes require explicit operator approval before execution.
- Decision: Codex remains the only default executor for all tasks.
- Rationale: Single-executor model avoids ambiguous ownership and keeps the system predictable.
- Decision: Claude diagnostic output is structured (status, diagnosis, proposedFix) and logged.
- Rationale: Enables auditability and ensures the orchestrator can consume and log Claude output deterministically.
