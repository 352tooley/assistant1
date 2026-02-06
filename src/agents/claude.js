/**
 * Claude Code diagnostic agent.
 * Invoked only on escalation for complex or repeated failures.
 * Performs analysis and returns structured diagnostic output.
 * Does NOT auto-apply fixes — output is advisory only.
 */

const { spawnSync } = require('child_process');
const path = require('path');

function analyzeComputeSum(task, codexOutputs, findings) {
  const input = task.input;
  if (!input || !Array.isArray(input.values)) {
    findings.push('Task input is missing or has invalid "values" array.');
    return false;
  }

  const correctSum = input.values.reduce((a, b) => a + b, 0);
  findings.push(
    `Input values: [${input.values.join(', ')}]. Correct sum: ${correctSum}.`
  );

  if (task.expectedOutput !== undefined && task.expectedOutput !== correctSum) {
    findings.push(
      `Expected output (${task.expectedOutput}) does not match correct sum (${correctSum}). ` +
        'The expectedOutput in the task definition is wrong, not the Codex computation.'
    );
    return true;
  }

  if (codexOutputs && codexOutputs.length > 0) {
    const last = codexOutputs[codexOutputs.length - 1];
    if (last !== correctSum) {
      findings.push(
        `Codex returned ${last} instead of ${correctSum}. Codex sum logic may be incorrect.`
      );
      return true;
    }
  }

  findings.push(`Error reported: ${task._error || 'none'}.`);
  return false;
}

function analyzeTextTransform(task, codexOutputs, findings) {
  const input = task.input;
  if (!input || typeof input.text !== 'string') {
    findings.push('Task input is missing or has invalid "text" field.');
    return false;
  }

  const expected =
    input.mode === 'upper' ? input.text.toUpperCase() : input.text.toLowerCase();
  findings.push(
    `Input text: "${input.text}", mode: "${input.mode}". Correct output: "${expected}".`
  );

  if (task.expectedOutput !== undefined && task.expectedOutput !== expected) {
    findings.push(
      `Task expectedOutput ("${task.expectedOutput}") does not match correct transformation ("${expected}"). Task definition has incorrect expectedOutput.`
    );
    return true;
  }

  findings.push(`Error reported: ${task._error || 'none'}.`);
  return false;
}

function buildDiagnosis(task, context) {
  const { error, codexOutputs } = context;
  const findings = [];
  let resolvable = false;

  if (!task || !task.type) {
    findings.push('Task is missing required type field.');
    return { summary: findings.join(' '), resolvable: false };
  }

  // Store error on task object for helper access
  task._error = error;

  if (task.type === 'compute_sum') {
    resolvable = analyzeComputeSum(task, codexOutputs, findings);
  } else if (task.type === 'text_transform') {
    resolvable = analyzeTextTransform(task, codexOutputs, findings);
  } else {
    findings.push(
      `Unknown task type "${task.type}". Codex may lack a handler for this type.`
    );
  }

  // Detect deterministic repeated failure
  if (codexOutputs && codexOutputs.length > 1) {
    const allSame = codexOutputs.every(
      (o) => JSON.stringify(o) === JSON.stringify(codexOutputs[0])
    );
    if (allSame) {
      findings.push(
        'Codex produced identical output on every attempt — deterministic bug, not transient.'
      );
    }
  }

  delete task._error;
  return { summary: findings.join(' '), resolvable };
}

function buildProposedFix(diagnosis) {
  if (!diagnosis.resolvable) {
    return {
      description: 'Unable to determine a targeted fix. Manual review required.',
      filesToChange: [],
      strategy: 'manual-review',
    };
  }

  if (
    diagnosis.summary.includes('expectedOutput in the task definition is wrong') ||
    diagnosis.summary.includes('Task definition has incorrect expectedOutput')
  ) {
    return {
      description:
        'Correct the expectedOutput value in the task definition to match the actual correct result.',
      filesToChange: ['src/orchestrator.js'],
      strategy: 'fix-task-definition',
    };
  }

  if (diagnosis.summary.includes('Codex sum logic may be incorrect')) {
    return {
      description:
        'Fix the computation logic in the Codex agent for the failing task type.',
      filesToChange: ['src/agents/codex.js'],
      strategy: 'fix-agent-logic',
    };
  }

  return {
    description: 'Review the task configuration and agent logic for the identified issue.',
    filesToChange: [],
    strategy: 'review-required',
  };
}

function runClaude(task, context) {
  const ctx = context || {
    error: null,
    classification: 'complex',
    failureCount: 0,
    codexOutputs: [],
  };

  if (ctx && ctx.trigger) {
    const payload = {
      trigger: ctx.trigger,
      failureContext: {
        error: ctx.error,
        classification: ctx.classification,
        failureCount: ctx.failureCount,
        codexOutputs: ctx.codexOutputs,
      },
      repoContext: ctx.recentCommits || ctx.repoContext || null,
      constraints: ctx.constraints || null,
    };

    const runner = `
      const { runClaudeAdapter } = require('${path.join(__dirname, 'claudeAdapter.js').replace(/\\/g, '\\\\')}');
      (async () => {
        const input = JSON.parse(process.env.CLAUDE_ADAPTER_PAYLOAD || '{}');
        const result = await runClaudeAdapter(input);
        process.stdout.write(JSON.stringify(result));
      })().catch((err) => {
        process.stdout.write(JSON.stringify({ status: 'failure', diagnosis: String(err) }));
      });
    `;

    const child = spawnSync(process.execPath, ['-e', runner], {
      env: { ...process.env, CLAUDE_ADAPTER_PAYLOAD: JSON.stringify(payload) },
      encoding: 'utf8',
    });

    if (child.status === 0 && child.stdout) {
      try {
        const adapterResult = JSON.parse(child.stdout);
        if (adapterResult && adapterResult.status === 'success') {
          const diagnosisText = adapterResult.proposedFixPacket
            ? adapterResult.proposedFixPacket.diagnosis
            : adapterResult.diagnosis;
          return {
            status: adapterResult.proposedFixPacket ? 'resolved' : 'unresolved',
            diagnosis: diagnosisText,
            proposedFix: adapterResult.proposedFixPacket ? adapterResult.proposedFixPacket.proposedFix : null,
            rootCause: adapterResult.rootCause,
            confidence: adapterResult.confidence,
          };
        }
      } catch {
        // Fall back to local diagnostic.
      }
    }
  }

  const diagnosis = buildDiagnosis(task, ctx);
  const proposedFix = buildProposedFix(diagnosis);

  let summary = diagnosis.summary;
  if (ctx.regression) {
    const regression = ctx.regression;
    summary = `${summary} Regression context: lastSuccessfulCommit=${regression.lastSuccessfulCommit}, failingCommit=${regression.failingCommit}. Diff summary: ${regression.diffSummary}.`;
  }

  return {
    status: diagnosis.resolvable ? 'resolved' : 'unresolved',
    diagnosis: summary,
    proposedFix,
  };
}

module.exports = {
  runClaude,
};
