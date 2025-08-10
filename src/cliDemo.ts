#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import readline from 'node:readline';
import { CliOutputModeController } from './output/CliOutputModeController.js';
import { JsonEventStreamSerializer } from './output/JsonEventStreamSerializer.js';
import { App } from './ui/App.js';
import { runCommand } from './ui/commandRunner.js';

function parseArgs(argv: string[]) {
  return {
    streamJson: argv.includes('--stream-json'),
    print: argv.includes('--print'),
    shell: argv.includes('--shell')
  };
}

async function runShell() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => rl.prompt();
  rl.setPrompt('> ');
  console.log('Shell mode. Try commands like:');
  console.log("  bash: echo hi");
  console.log("  fs.read: package.json");
  console.log("  web.fetch: https://example.com");
  prompt();
  rl.on('line', async (line) => {
    const res = await runCommand(line.trim(), { cwd: process.cwd(), env: process.env });
    if (res.ok) {
      if (res.stdout) process.stdout.write(res.stdout + (res.stdout.endsWith('\n') ? '' : '\n'));
      console.log(`INFO: ok (exit ${res.exitCode ?? 0})`);
    } else {
      if (res.stderr) process.stderr.write(res.stderr + (res.stderr.endsWith('\n') ? '' : '\n'));
      console.log(`ERROR: failed (exit ${res.exitCode ?? 1})`);
    }
    prompt();
  });
  await new Promise<void>((resolve) => rl.on('close', () => resolve()));
}

async function run() {
  const { streamJson, print, shell } = parseArgs(process.argv.slice(2));

  if (streamJson) {
    const ser = new JsonEventStreamSerializer((l: string) => process.stdout.write(l));
    ser.emitToken('Hello');
    ser.emitToken(' world', true);
    ser.emitNotification('info', 'demo stream');
    ser.emitDone();
    return;
  }

  if (print) {
    const ctrl = new CliOutputModeController('print', {
      stdout: (l: string) => process.stdout.write(l),
      stderr: (l: string) => process.stderr.write(l)
    });
    ctrl.writeFinal('Hello world');
    return;
  }

  if (shell || !process.stdin.isTTY) {
    await runShell();
    return;
  }

  // Default: interactive Ink App with input (requires TTY)
  render(React.createElement(App));
}

run().catch((e) => {
  const ctrl = new CliOutputModeController('print', {
    stdout: (l: string) => process.stdout.write(l),
    stderr: (l: string) => process.stderr.write(l)
  });
  ctrl.writeError({ message: e?.message ?? String(e), code: 'INTERNAL_ERROR' });
  process.exit(1);
});