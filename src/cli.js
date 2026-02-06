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

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || 'status';
  const options = { mode: null, headless: false, maxCycles: null, maxRuntimeMs: null, pollIntervalMs: null };

  args.slice(1).forEach((arg) => {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    }
    if (arg.startsWith('--max-cycles=')) {
      options.maxCycles = Number(arg.split('=')[1]);
    }
    if (arg.startsWith('--max-runtime-ms=')) {
      options.maxRuntimeMs = Number(arg.split('=')[1]);
    }
    if (arg.startsWith('--poll-interval-ms=')) {
      options.pollIntervalMs = Number(arg.split('=')[1]);
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

function main() {
  const { command, options } = parseArgs(process.argv);

  if (command === 'status') {
    const status = getStatusSnapshot(options.mode);
    printStatus(status);
    logCliEvent({
      command: 'status',
      intent: 'status',
      result: 'success',
      details: [`pending=${status.pending}`, `completed=${status.completed}`],
    });
    return;
  }

  if (command === 'run-once') {
    const result = runOnce(
      {
        reset: false,
        maxTasks: 1,
        mode: options.mode,
        pollIntervalMs: options.pollIntervalMs || 5000,
      },
      { headlessMode: false, cliCommand: 'run-once', operatorIntent: 'run-once' }
    );
    logCliEvent({ command: 'run-once', intent: 'run-once', result: result.status || 'success' });
    return;
  }

  if (command === 'headless') {
    const subcommand = process.argv[3] || 'start';
    if (subcommand === 'stop') {
      ensureStopFlag();
      logCliEvent({ command: 'headless stop', intent: 'stop', result: 'success' });
      console.log('Stop flag created.');
      return;
    }

    const headlessOptions = {
      reset: false,
      headless: true,
      mode: options.mode,
      pollIntervalMs: options.pollIntervalMs || 5000,
      maxCycles: Number.isFinite(options.maxCycles) ? options.maxCycles : 10,
      maxRuntimeMs: Number.isFinite(options.maxRuntimeMs) ? options.maxRuntimeMs : 60000,
    };

    runHeadless(headlessOptions, { cliCommand: 'headless start', operatorIntent: 'headless start' });
    return;
  }

  if (command === 'reset') {
    resetOnly({ cliCommand: 'reset', operatorIntent: 'reset' });
    console.log('State reset.');
    return;
  }

  logCliEvent({ command, intent: 'unknown', result: 'rejected', details: ['Unknown command'] });
  console.log('Unknown command. Supported: status, run-once, headless start|stop, reset');
}

main();
