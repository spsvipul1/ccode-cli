import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitInit, gitAddAll, gitCommit, gitDiff } from '../src/commands/git';

describe('git helpers', () => {
  it('creates a commit and shows diff', async () => {
    const base = mkdtempSync(join(tmpdir(), 'cli-'));
    try {
      await gitInit(base);
      writeFileSync(join(base, 'a.txt'), 'hello');
      await gitAddAll(base);
      await gitCommit(base, 'initial');
      writeFileSync(join(base, 'a.txt'), 'hello\nworld');
      const diff = await gitDiff(base);
      expect(diff).toMatch(/\+world/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});