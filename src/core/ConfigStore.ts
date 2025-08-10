import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { promises as fsp } from 'node:fs';

export type Scope = 'user' | 'project';

const USER_PATH = join(homedir(), '.cli-code', 'config.json');
const PROJECT_PATH = join(process.cwd(), '.cli-code', 'config.json');

async function readJsonSafe(p: string): Promise<any> {
  try { const s = await fsp.readFile(p, 'utf8'); return JSON.parse(s); } catch { return {}; }
}
async function writeJson(p: string, data: any) {
  await fsp.mkdir(dirname(p), { recursive: true } as any).catch(() => {});
  await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

function getPath(obj: any, path: string) {
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}
function setPath(obj: any, path: string, value: any) {
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (let i=0; i<parts.length-1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length-1]] = value;
}

export class ConfigStore {
  async list(scope: Scope): Promise<string> {
    const obj = await readJsonSafe(scope === 'user' ? USER_PATH : PROJECT_PATH);
    return JSON.stringify(obj, null, 2) + '\n';
  }
  async get(scope: Scope, path: string): Promise<string> {
    const obj = await readJsonSafe(scope === 'user' ? USER_PATH : PROJECT_PATH);
    const v = getPath(obj, path);
    return (v === undefined ? '' : JSON.stringify(v, null, 2)) + '\n';
  }
  async set(scope: Scope, path: string, value: any): Promise<void> {
    const p = scope === 'user' ? USER_PATH : PROJECT_PATH;
    const obj = await readJsonSafe(p);
    setPath(obj, path, value);
    await writeJson(p, obj);
  }
}