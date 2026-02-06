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
