function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Task shape:
 * { id: string, type: string, input: any, expectedOutput?: any }
 */
function validateTask(task) {
  if (!isObject(task)) {
    return 'Task must be an object.';
  }
  if (!task.id || typeof task.id !== 'string') {
    return 'Task id must be a non-empty string.';
  }
  if (!task.type || typeof task.type !== 'string') {
    return 'Task type must be a non-empty string.';
  }
  if (!Object.prototype.hasOwnProperty.call(task, 'input')) {
    return 'Task input is required.';
  }
  return null;
}

function runCodex(task) {
  const validationError = validateTask(task);
  if (validationError) {
    return {
      status: 'failure',
      error: validationError,
    };
  }

  let output;

  if (task.type === 'text_transform') {
    const input = task.input;
    if (!isObject(input) || typeof input.text !== 'string' || typeof input.mode !== 'string') {
      return {
        status: 'failure',
        error: 'text_transform requires input { text: string, mode: string }.',
      };
    }
    if (input.mode === 'upper') {
      output = input.text.toUpperCase();
    } else if (input.mode === 'lower') {
      output = input.text.toLowerCase();
    } else {
      return {
        status: 'failure',
        error: 'text_transform mode must be "upper" or "lower".',
      };
    }
  } else if (task.type === 'compute_sum') {
    const input = task.input;
    if (!isObject(input) || !Array.isArray(input.values)) {
      return {
        status: 'failure',
        error: 'compute_sum requires input { values: number[] }.',
      };
    }
    if (!input.values.every((value) => typeof value === 'number')) {
      return {
        status: 'failure',
        error: 'compute_sum values must be numbers.',
      };
    }
    output = input.values.reduce((total, value) => total + value, 0);
  } else {
    return {
      status: 'failure',
      error: `Unsupported task type: ${task.type}`,
    };
  }

  if (Object.prototype.hasOwnProperty.call(task, 'expectedOutput')) {
    const expected = task.expectedOutput;
    if (output !== expected) {
      return {
        status: 'failure',
        error: `Output mismatch. Expected ${JSON.stringify(expected)} but got ${JSON.stringify(output)}.`,
        output,
      };
    }
  }

  return {
    status: 'success',
    output,
  };
}

module.exports = {
  runCodex,
};
