import { statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { ConfigStore } from '../core/ConfigStore.js';

function resolveSafe(cwd: string, p: string) {
  const abs = resolve(cwd, p);
  const normCwd = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!abs.startsWith(normCwd)) throw new Error('Path escapes project');
  return abs;
}

export async function addDir(cwd: string, path: string, remember: boolean) {
  if (!path) throw new Error('path required');
  const abs = resolveSafe(cwd, path);
  let st: any;
  try { st = statSync(abs); } catch { throw new Error(`Path not found: ${abs}`); }
  if (!st.isDirectory()) throw new Error(`${abs} is not a directory`);

  const store = new ConfigStore();
  const scope = remember ? 'user' : 'project';
  const current = JSON.parse(await store.get(scope, 'permissions.additionalDirectories')) || [];
  if (Array.isArray(current) && current.includes(abs)) return `Already in working directories: ${abs}`;
  const next = Array.isArray(current) ? Array.from(new Set([...current, abs])) : [abs];
  await store.set(scope, 'permissions.additionalDirectories', next);
  return `Added ${abs} to working directories (${scope})`;
}
