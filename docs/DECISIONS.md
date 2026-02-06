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
