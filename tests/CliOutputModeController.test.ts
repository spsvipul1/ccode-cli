import { describe, it, expect } from 'vitest';
import { CliOutputModeController } from '../src/output/CliOutputModeController';

describe('CliOutputModeController', () => {
  function mk() {
    const out: string[] = [];
    const err: string[] = [];
    const ctrl = new CliOutputModeController('print', {
      stdout: (l) => out.push(l),
      stderr: (l) => err.push(l)
    });
    return { out, err, ctrl };
  }

  it('print mode writes only final output and serializes errors to stderr', () => {
    const { out, err, ctrl } = mk();
    ctrl.writeFinal('final output');
    ctrl.emitEvent({ token: { text: 'ignored' } });
    ctrl.writeError({ message: 'boom', code: 'CLI_USAGE_ERROR' });
    expect(out.join('')).toBe('final output\n');
    expect(err.join('')).toBe('{"error":{"message":"boom","code":"CLI_USAGE_ERROR"}}\n');
  });

  it('stream-json mode emits NDJSON events', () => {
    const out: string[] = [];
    const err: string[] = [];
    const ctrl = new CliOutputModeController('stream-json', {
      stdout: (l) => out.push(l.trimEnd()),
      stderr: (l) => err.push(l.trimEnd())
    });

    ctrl.emitEvent({ token: { text: 'Hello' } });
    ctrl.emitEvent({ token: { text: ' world', is_final: true } });
    ctrl.emitEvent({ tool_call: { id: '1', name: 'bash.run', args: { cmd: 'echo hi' } } });
    ctrl.emitEvent({ tool_result: { id: '1', ok: true, stdout: 'hi\n', exit_code: 0 } });
    ctrl.emitEvent({ notification: { level: 'info', message: 'ok' } });
    ctrl.emitEvent({ hook: { event: 'PreToolUse', exit_code: 0 } });
    ctrl.writeError({ message: 'oops' });
    ctrl.emitEvent({ done: {} });

    const lines = out.map((l) => JSON.parse(l));
    expect(lines[0]).toHaveProperty('token');
    expect(lines[1]).toHaveProperty('token');
    expect(lines.at(-1)).toEqual({ done: {} });
    expect(err.length).toBe(0);
  });
});