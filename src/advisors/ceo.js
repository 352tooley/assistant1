function resolvePriority(plans, mode, usageSnapshot) {
  const decision = 'Proceed with deterministic plan while honoring routing policy.';
  let rationale = 'Default to minimal risk path with existing safety constraints.';
  let priority = 2;

  if (mode === 'budget') {
    rationale = 'Budget mode prioritizes Codex usage and suppresses avoidable Claude calls.';
    priority = 1;
  }

  if (mode === 'diagnostic') {
    rationale = 'Diagnostic mode allows deeper analysis while keeping escalation bounded.';
    priority = 3;
  }

  if (usageSnapshot && usageSnapshot.claudeCalls > usageSnapshot.codexCalls) {
    rationale = 'Claude usage exceeds Codex; prefer lower-cost execution path.';
    priority = 1;
  }

  return { decision, rationale, priority };
}

module.exports = {
  resolvePriority,
};
