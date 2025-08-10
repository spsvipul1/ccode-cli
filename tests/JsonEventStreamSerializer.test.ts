import { describe, it, expect } from 'vitest';
import { JsonEventStreamSerializer } from '../src/output/JsonEventStreamSerializer';

describe('JsonEventStreamSerializer', () => {
  function collect() {
    const lines: string[] = [];
    const write = (l: string) => lines.push(l.trimEnd());
    return { lines, ser: new JsonEventStreamSerializer(write) };
  }

  it('emits token, tool_call, tool_result, notification, hook, error, done', () => {
    const { lines, ser } = collect();
    ser.emitToken('Hello');
    ser.emitToken(' world', true);
    ser.emitToolCall('1', 'bash.run', { cmd: 'echo hi' });
    ser.emitToolResult('1', { ok: true, stdout: 'hi\n', exit_code: 0 });
    ser.emitNotification('info', 'working');
    ser.emitHook('PreToolUse', 0);
    ser.emitError({ message: 'oops', code: 'CLI_USAGE_ERROR' });
    ser.emitDone();

    // Basic shape checks aligned with schema
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed[0]).toHaveProperty('token');
    expect(parsed[1]).toEqual({ token: { text: ' world', is_final: true } });
    expect(parsed[2]).toEqual({ tool_call: { id: '1', name: 'bash.run', args: { cmd: 'echo hi' } } });
    expect(parsed[3]).toEqual({ tool_result: { id: '1', ok: true, stdout: 'hi\n', exit_code: 0 } });
    expect(parsed[4]).toHaveProperty('notification');
    expect(parsed[4].notification).toMatchObject({ level: 'info', message: 'working' });
    expect(parsed[5]).toEqual({ hook: { event: 'PreToolUse', exit_code: 0 } });
    expect(parsed[6]).toEqual({ error: { message: 'oops', code: 'CLI_USAGE_ERROR' } });
    expect(parsed[7]).toEqual({ done: {} });
  });
});