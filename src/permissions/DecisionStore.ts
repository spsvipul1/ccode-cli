import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { promises as fsp } from 'node:fs';

const STORE_PATH = join(homedir(), '.cli-code', 'permissions.json');

export type Decision = 'allow' | 'deny';

export class DecisionStore {
  private map = new Map<string, Decision>();
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      const s = await fsp.readFile(STORE_PATH, 'utf8');
      const obj = JSON.parse(s) as Record<string, Decision>;
      for (const [k, v] of Object.entries(obj)) this.map.set(k, v);
    } catch {}
    this.loaded = true;
  }

  async get(toolId: string): Promise<Decision | undefined> {
    await this.ensureLoaded();
    return this.map.get(toolId);
  }

  async set(toolId: string, decision: Decision): Promise<void> {
    await this.ensureLoaded();
    this.map.set(toolId, decision);
    const obj: Record<string, Decision> = {};
    for (const [k, v] of this.map.entries()) obj[k] = v;
    await fsp.mkdir(dirname(STORE_PATH), { recursive: true } as any).catch(() => {});
    await fsp.writeFile(STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  }

  async asUserScope(): Promise<{ allow?: string[]; deny?: string[]; defaultMode?: 'prompt'|'allow'|'deny' }> {
    await this.ensureLoaded();
    const allow: string[] = [];
    const deny: string[] = [];
    for (const [k, v] of this.map.entries()) (v === 'allow' ? allow : deny).push(k);
    return { allow, deny, defaultMode: 'prompt' };
  }
}