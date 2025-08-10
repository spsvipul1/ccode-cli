import { describe, it, expect } from 'vitest';
import { makeBashTool } from '../src/tools/bash';
import { DefaultToolManager } from '../src/tools/ToolManager';

function failingSandboxExecutor(cmd: string) {
  let failedOnce = false;
  return async (_: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }) => {
    if (cmd.includes('restricted') && !failedOnce) {
      failedOnce = true;
      return { code: 1, signal: null, stdout: '', stderr: 'permission denied by sandbox', errorCode: 'EPERM' };
    }
    return { code: 0, signal: null, stdout: 'ok', stderr: '' };
  };
}

describe('bash sandbox policy', () => {
  it('emits downgrade notification and succeeds after retry', async () => {
    const notifications: string[] = [];
    const tool = makeBashTool(failingSandboxExecutor('restricted'));
    const mgr = new DefaultToolManager();
    await mgr.registerTool(tool);
    const ctx = { cwd: process.cwd(), env: process.env, permissions: new Set(['bash.run']), sandboxPreferred: true, onNotification: (n: any) => notifications.push(n.message) } as any;
    const res = await mgr.executeTool('bash.run', { cmd: 'restricted' }, ctx);
    expect(notifications.join(' ')).toMatch(/retrying without sandbox/i);
    expect(res.ok).toBe(true);
  });

  it('never sandbox for long-lived/test patterns', async () => {
    const notifications: string[] = [];
    const tool = makeBashTool(failingSandboxExecutor('npm test'));
    const mgr = new DefaultToolManager();
    await mgr.registerTool(tool);
    const ctx = { cwd: process.cwd(), env: process.env, permissions: new Set(['bash.run']), sandboxPreferred: true, onNotification: (n: any) => notifications.push(n.message) } as any;
    const res = await mgr.executeTool('bash.run', { cmd: 'npm test' }, ctx);
    expect(res.ok).toBe(true);
    expect(notifications.length).toBe(0);
  });
});