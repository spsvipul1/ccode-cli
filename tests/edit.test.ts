import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';
import { editFile } from '../src/commands/edit';

describe('edit command', () => {
  it('dry-run diff', async () => {
    const base = mkdtempSync(join(tmpdir(), 'cli-'));
    try {
      const p = join(base, 'a.txt');
      await fsp.writeFile(p, 'line1', 'utf8');
      const res = await editFile(base, 'a.txt', 'new line', false);
      expect(res.ok).toBe(true);
      expect(res.diff).toContain('--- original');
      expect(res.diff).toContain('+line1\n+new line');
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  it('in-place with backup', async () => {
    const base = mkdtempSync(join(tmpdir(), 'cli-'));
    try {
      const p = join(base, 'a.txt');
      await fsp.writeFile(p, 'line1', 'utf8');
      const res = await editFile(base, 'a.txt', 'new line', true);
      expect(res.ok).toBe(true);
      expect(res.backupPath).toBeDefined();
      const content = await fsp.readFile(p, 'utf8');
      expect(content).toContain('line1');
      expect(content).toContain('new line');
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});