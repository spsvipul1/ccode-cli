import { describe, it, expect } from 'vitest';
import { DefaultToolManager } from '../src/tools/ToolManager';
import { FsReadTool, FsWriteTool } from '../src/tools/fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('fs tools', () => {
  it('writes and reads a file safely', async () => {
    const base = mkdtempSync(join(tmpdir(), 'cli-'));
    try {
      const mgr = new DefaultToolManager();
      await mgr.registerTool(FsWriteTool);
      await mgr.registerTool(FsReadTool);
      const ctx = { cwd: base, env: process.env, permissions: new Set(['fs.*']) } as any;

      const w = await mgr.executeTool('fs.write', { path: 'a.txt', content: 'hello' }, ctx);
      expect(w.ok).toBe(true);
      const r = await mgr.executeTool('fs.read', { path: 'a.txt' }, ctx);
      expect(r.stdout).toBe('hello');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('rejects path traversal', async () => {
    const base = mkdtempSync(join(tmpdir(), 'cli-'));
    try {
      const mgr = new DefaultToolManager();
      await mgr.registerTool(FsReadTool);
      const ctx = { cwd: base, env: process.env, permissions: new Set(['fs.*']) } as any;
      const r = await mgr.executeTool('fs.read', { path: '../etc/passwd' }, ctx);
      expect(r.ok).toBe(false);
      expect(r.stderr).toMatch(/escapes project/i);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});