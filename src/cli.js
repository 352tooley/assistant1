const fs = require('fs');
const path = require('path');
const {
  runOnce,
  runHeadless,
  getStatusSnapshot,
  resetOnly,
  logCliEvent,
} = require('./orchestrator');

const repoRoot = path.resolve(__dirname, '..');
const stopFlagPath = path.join(repoRoot, 'state', 'STOP');
const runtimePath = path.join(repoRoot, 'state', 'runtime.json');
const agentContractPath = path.join(repoRoot, 'docs', 'AGENT_CONTRACT.md');
const acceptancePath = path.join(repoRoot, 'docs', 'ACCEPTANCE.md');

function showHelp() {
  console.log('assistant1 CLI');
  console.log('Usage:');
  console.log('  node src/cli.js status');
  console.log('  node src/cli.js run-once [--advisor=claude|auto|none]');
  console.log('  node src/cli.js headless start [--max-cycles=N] [--max-runtime-ms=N] [--poll-interval-ms=N] [--mode=standard|budget|diagnostic]');
  console.log('  node src/cli.js headless stop');
  console.log('  node src/cli.js reset');
  console.log('  node src/cli.js --help');
  console.log('Notes:');
  console.log('- status is read-only');
  console.log('- reset clears runtime state');
  console.log('- headless start requires explicit limits; defaults will be used if omitted');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    return { command: 'help', options: {} };
  }
  const command = args[0] || 'status';
  const options = {
    mode: null,
    maxCycles: null,
    maxRuntimeMs: null,
    pollIntervalMs: null,
    maxCyclesProvided: false,
    maxRuntimeProvided: false,
    advisor: 'auto',
  };

  args.slice(1).forEach((arg) => {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    }
    if (arg.startsWith('--max-cycles=')) {
      options.maxCycles = Number(arg.split('=')[1]);
      options.maxCyclesProvided = true;
    }
    if (arg.startsWith('--max-runtime-ms=')) {
      options.maxRuntimeMs = Number(arg.split('=')[1]);
      options.maxRuntimeProvided = true;
    }
    if (arg.startsWith('--poll-interval-ms=')) {
      options.pollIntervalMs = Number(arg.split('=')[1]);
    }
    if (arg.startsWith('--advisor=')) {
      options.advisor = arg.split('=')[1];
    }
  });

  return { command, options };
}

function printStatus(status) {
  console.log('Status');
  console.log('pending:', status.pending);
  console.log('completed:', status.completed);
  console.log('failed:', status.failed);
  console.log('lastRunTimestamp:', status.lastRunTimestamp || 'none');
  console.log('lastSuccessfulCommit:', status.lastSuccessfulCommit || 'none');
  console.log('routingMode:', status.mode);
  console.log('usage.codexCalls:', status.usage.codexCalls || 0);
  console.log('usage.claudeCalls:', status.usage.claudeCalls || 0);
  console.log('headlessStatus:', status.headlessStatus);
  console.log('stopFlag:', status.stopFlag ? 'present' : 'absent');
}

function ensureStopFlag() {
  fs.writeFileSync(stopFlagPath, 'stop\n', 'utf8');
}

function checkSanity() {
  const warnings = [];
  if (!fs.existsSync(agentContractPath)) {
    warnings.push('Missing docs/AGENT_CONTRACT.md');
  }
  if (!fs.existsSync(acceptancePath)) {
    warnings.push('Missing docs/ACCEPTANCE.md');
  }
  if (warnings.length > 0) {
    warnings.forEach((warning) => console.error(`Warning: ${warning}`));
  }
  return warnings;
}

function checkStateCorruption() {
  if (!fs.existsSync(runtimePath)) {
    return null;
  }
  try {
    JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    return null;
  } catch {
    return 'State file is corrupted.';
  }
}

function main() {
  const { command, options } = parseArgs(process.argv);

  if (command === 'help') {
    showHelp();
    return process.exit(0);
  }

  const warnings = checkSanity();
  const corruptionError = checkStateCorruption();
  if (corruptionError) {
    console.error(`Error: ${corruptionError}`);
    logCliEvent({ command, intent: command, result: 'rejected', details: ['state_corrupt'] });
    return process.exit(2);
  }

  if (!['auto', 'none', 'claude'].includes(options.advisor)) {
    console.error('Error: --advisor must be claude, auto, or none.');
    showHelp();
    return process.exit(1);
  }

  if (command === 'status') {
    const status = getStatusSnapshot(options.mode);
    printStatus(status);
    logCliEvent({
      command: 'status',
      intent: 'status',
      result: 'success',
      details: [`pending=${status.pending}`, `completed=${status.completed}`],
    });
    return process.exit(0);
  }

  if (command === 'run-once') {
    try {
      const result = runOnce(
        {
          reset: false,
          maxTasks: 1,
          mode: options.mode,
          pollIntervalMs: options.pollIntervalMs || 5000,
          requestedAdvisor: options.advisor,
        },
        { headlessMode: false, cliCommand: 'run-once', operatorIntent: 'run-once' }
      );
      logCliEvent({ command: 'run-once', intent: 'run-once', result: result.status || 'success' });
      return process.exit(0);
    } catch (error) {
      if (options.advisor === 'claude') {
        console.error(
          'ERROR: Claude assistance was explicitly requested, but no Claude adapter is available.'
        );
        console.error('Provide an Anthropic API key in providers.local.json.');
        logCliEvent({ command: 'run-once', intent: 'run-once', result: 'claude_unavailable' });
        return process.exit(2);
      }
      throw error;
    }
  }

  if (command === 'headless') {
    const subcommand = process.argv[3] || 'start';
    if (subcommand === 'stop') {
      ensureStopFlag();
      logCliEvent({ command: 'headless stop', intent: 'stop', result: 'success' });
      console.log('Stop flag created.');
      return process.exit(0);
    }

    if (!options.maxCyclesProvided || !options.maxRuntimeProvided) {
      const warning = 'Warning: headless start without explicit limits; defaults will be used.';
      console.error(warning);
      logCliEvent({ command: 'headless start', intent: 'headless start', result: 'warning', details: [warning] });
    }

    const headlessOptions = {
      reset: false,
      headless: true,
      mode: options.mode,
      requestedAdvisor: options.advisor,
      pollIntervalMs: options.pollIntervalMs || 5000,
      maxCycles: Number.isFinite(options.maxCycles) ? options.maxCycles : 10,
      maxRuntimeMs: Number.isFinite(options.maxRuntimeMs) ? options.maxRuntimeMs : 60000,
    };

    try {
      runHeadless(headlessOptions, { cliCommand: 'headless start', operatorIntent: 'headless start' });
      return process.exit(0);
    } catch (error) {
      if (options.advisor === 'claude') {
        console.error(
          'ERROR: Claude assistance was explicitly requested, but no Claude adapter is available.'
        );
        console.error('Provide an Anthropic API key in providers.local.json.');
        logCliEvent({ command: 'headless start', intent: 'headless start', result: 'claude_unavailable' });
        return process.exit(2);
      }
      throw error;
    }
  }

  if (command === 'reset') {
    console.error('Warning: reset clears runtime state.');
    resetOnly({ cliCommand: 'reset', operatorIntent: 'reset' });
    console.log('State reset.');
    return process.exit(0);
  }

  console.error('Error: Unknown command. Supported: status, run-once, headless start|stop, reset');
  logCliEvent({ command, intent: 'unknown', result: 'rejected', details: ['unknown_command'] });
  return process.exit(1);
}

main();
