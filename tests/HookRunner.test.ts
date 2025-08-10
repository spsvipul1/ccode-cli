import { describe, it, expect } from 'vitest';
import { HookRegistry, HookRunner } from '../src/hooks/HookRunner';

describe('HookRunner', () => {
  it('stops on first non-zero and returns its output', async () => {
    const reg = new HookRegistry();
    const runner = new HookRunner(reg);

    reg.register('PreToolUse', async () => ({ exitCode: 0 }));
    reg.register('PreToolUse', async () => ({ exitCode: 2, stderr: 'blocked' }));
    reg.register('PreToolUse', async () => ({ exitCode: 0 }));

    const res = await runner.run('PreToolUse', { toolId: 'bash.run' });
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toBe('blocked');
  });
});