import { describe, it, expect } from 'vitest';
import { DefaultToolManager } from '../src/tools/ToolManager';
import { BashTool } from '../src/tools/bash';

const ctx = {
  cwd: process.cwd(),
  env: process.env,
  permissions: new Set(['bash.run']),
  backgroundOutputCaps: { maxBytes: 64, maxLines: 10 }
};

describe('BashTool', () => {
  it('executes a simple command', async () => {
    const mgr = new DefaultToolManager();
    await mgr.registerTool(BashTool);
    const res = await mgr.executeTool('bash.run', { cmd: 'echo hello' }, ctx as any);
    expect(res.ok).toBe(true);
    expect(res.stdout?.trim()).toBe('hello');
  });

  it('truncates background output', async () => {
    const mgr = new DefaultToolManager();
    await mgr.registerTool(BashTool);
    const res = await mgr.executeTool('bash.run', { cmd: 'yes x | head -n 1000', background: true }, ctx as any);
    expect(res.ok).toBe(true);
    expect(res.stdout).toContain('...[truncated]');
  });
});