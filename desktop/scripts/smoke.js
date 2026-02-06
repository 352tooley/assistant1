const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const { resolveTemplate } = require(path.join(repoRoot, 'src', 'templateResolver.js'));
const { runApprovedTask } = require(path.join(repoRoot, 'src', 'orchestrator.js'));

function log(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  log(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  log(`PASS: ${message}`);
  process.exit(0);
}

function runSmoke() {
  const start = Date.now();
  const args = process.argv.slice(2);
  if (args.includes('--ipc')) {
    log('INFO: IPC smoke not implemented; running engine-tier smoke only.');
  }

  const naturalLanguage = 'Build a basic website site named "Acme" with theme minimal.';
  const preview = resolveTemplate(naturalLanguage);

  if (!preview || !preview.template || !preview.template.id) {
    fail('Preview did not return a template.');
  }
  if (!Number.isFinite(preview.confidence) || preview.confidence <= 0) {
    fail('Preview confidence is missing or zero.');
  }

  const inputs = { ...preview.extractedInputs };
  if (!inputs.siteName) {
    inputs.siteName = 'Acme';
  }
  if (!inputs.theme) {
    inputs.theme = 'minimal';
  }

  const request = {
    templateId: preview.template.id,
    inputs,
    requestedAgentRole: preview.template.agentRole,
    mode: 'standard',
    limits: { maxCycles: 1, maxRuntimeMs: 120000 },
    allowsClaude: preview.template.allowsClaude ? true : false,
  };

  const result = runApprovedTask(request, { cliCommand: 'desktop:smoke', operatorIntent: 'smoke' });
  if (!result || !result.status) {
    fail('Approved task returned no status.');
  }
  if (result.status === 'rejected' && !result.message) {
    fail('Rejected task did not include a reason.');
  }

  const elapsed = Date.now() - start;
  if (elapsed > 120000) {
    fail('Smoke test exceeded runtime limit.');
  }

  pass(`Preview + approve path validated (${result.status}).`);
}

runSmoke();
