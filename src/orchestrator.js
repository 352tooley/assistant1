const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const acceptancePath = path.join(repoRoot, 'docs', 'ACCEPTANCE.md');
const loopLogPath = path.join(repoRoot, 'docs', 'LOOP_LOG.md');
const headPath = path.join(repoRoot, '.git', 'HEAD');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getBranchName() {
  try {
    const head = readFile(headPath).trim();
    const prefix = 'ref: refs/heads/';
    if (head.startsWith(prefix)) {
      return head.slice(prefix.length);
    }
    return 'detached-head';
  } catch {
    return 'unknown';
  }
}

function extractSectionList(markdown, heading) {
  const lines = markdown.split('\n');
  const results = [];
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === heading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) {
      break;
    }
    if (inSection && line.trim().startsWith('- ')) {
      results.push(line.trim().slice(2));
    }
  }

  return results;
}

function buildTaskQueue(acceptanceItems) {
  const tasks = [
    {
      id: 'dummy-1',
      description: 'Simulate one agent cycle',
      status: 'queued',
      kind: 'dummy',
    },
  ];

  acceptanceItems.forEach((item, index) => {
    tasks.push({
      id: `acc-${index + 1}`,
      description: item,
      status: 'queued',
      kind: 'acceptance',
    });
  });

  return tasks;
}

function processOneTask(queue) {
  if (queue.length === 0) {
    return null;
  }
  const task = queue[0];
  task.status = 'in_progress';
  task.status = 'done';
  task.result = 'simulated-success';
  return task;
}

function appendLoopLog(entryLines) {
  let existing = '';
  try {
    existing = readFile(loopLogPath);
  } catch {
    existing = '';
  }

  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  const prefix = needsNewline ? '\n' : '';
  const entry = `${prefix}${entryLines.join('\n')}\n`;
  fs.appendFileSync(loopLogPath, entry, 'utf8');
}

function run() {
  const acceptance = readFile(acceptancePath);
  const initialCriteria = extractSectionList(acceptance, '## Initial Acceptance Criteria');

  const queue = buildTaskQueue(initialCriteria);
  const processed = processOneTask(queue);

  const timestamp = new Date().toISOString();
  const branch = getBranchName();

  const entryLines = [
    '',
    `## ${timestamp}`,
    '- Event: Orchestrator cycle',
    `- Branch: \`${branch}\``,
    `- Acceptance criteria parsed: ${initialCriteria.length}`,
    processed
      ? `- Task processed: \`${processed.id}\` (${processed.description})`
      : '- Task processed: none',
    processed ? `- Result: ${processed.result}` : '- Result: none',
  ];

  appendLoopLog(entryLines);

  console.log('Acceptance criteria parsed:', initialCriteria.length);
  console.log('Task queue length:', queue.length);
  if (processed) {
    console.log('Processed task:', processed.id);
  }
  console.log('Loop log appended:', path.relative(repoRoot, loopLogPath));
}

run();
