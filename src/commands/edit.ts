import { promises as fsp } from 'node:fs';
import { resolve } from 'node:path';

export async function computeDiff(original: string, next: string): Promise<string> {
  if (original === next) return 'No changes';
  const nextLines = next.split(/\r?\n/).filter(l => l.length);
  let out = `--- original\n+++ next\n@@\n`;
  for (const l of nextLines) out += `+${l}\n`;
  return out;
}

export async function editFile(cwd: string, filePath: string, instructions: string, inPlace: boolean): Promise<{ ok: boolean; diff?: string; backupPath?: string }> {
  const p = resolve(cwd, filePath);
  const orig = await fsp.readFile(p, 'utf8');
  const next = orig.includes(instructions) ? orig : `${orig}\n${instructions}`;
  if (!inPlace) {
    const diff = await computeDiff(orig, next);
    return { ok: true, diff };
  }
  const backup = p + '.bak';
  await fsp.writeFile(backup, orig, 'utf8');
  await fsp.writeFile(p, next, 'utf8');
  return { ok: true, backupPath: backup };
}