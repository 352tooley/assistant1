function planTask(task, context) {
  const steps = [];
  const assumptions = [];
  const risks = [];

  if (!task || !task.type) {
    steps.push('Validate task structure before execution.');
    risks.push('Task missing required fields may cause deterministic failure.');
    return { steps, assumptions, risks };
  }

  if (task.type === 'compute_sum') {
    steps.push('Validate input values array.');
    steps.push('Compute sum deterministically.');
    steps.push('Compare output to expectedOutput if provided.');
    assumptions.push('Values are numeric and finite.');
    risks.push('Incorrect expectedOutput will trigger repeatable failure.');
  } else if (task.type === 'text_transform') {
    steps.push('Validate input text and mode.');
    steps.push('Apply deterministic transformation.');
    steps.push('Compare output to expectedOutput if provided.');
    assumptions.push('Mode is lower or upper.');
    risks.push('Unexpected mode will fail validation.');
  } else {
    steps.push('Validate task type support.');
    risks.push('Unsupported task type results in deterministic failure.');
  }

  if (context && context.regressionDetected) {
    steps.push('Review regression context and commit diffs.');
    risks.push('Regression may require forward-fix commit.');
  }

  return { steps, assumptions, risks };
}

module.exports = {
  planTask,
};
