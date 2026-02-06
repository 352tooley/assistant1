# Architecture Decisions

## 2026-02-06: Multi-Agent Deterministic Orchestration

- Decision: Use a two-agent model where Codex implements and Claude Code diagnoses.
- Rationale: Separates execution from verification to reduce errors.
- Decision: Orchestrate deterministically with explicit gates and logs.
- Rationale: Ensures reproducibility and auditability.
- Decision: Treat this repository as the single source of truth for behavior and state.
- Rationale: Prevents drift between instructions and implementation.
