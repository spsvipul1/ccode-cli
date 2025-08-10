import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type Scope = 'user' | 'project';

export interface McpServerDefinition {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string,string>;
  cwd?: string;
  transport?: 'stdio' | 'tcp' | 'unix';
  host?: string;
  port?: number;
  path?: string;
  enabled?: boolean;
}

function userConfigPath() {
  return join(homedir(), '.cli-code', 'config.mcp.json');
}
function projectConfigPath() {
  return join(process.cwd(), '.cli-code', 'config.mcp.json');
}

async function readJsonSafe(p: string): Promise<any> {
  try { const s = await fsp.readFile(p, 'utf8'); return JSON.parse(s); } catch { return {}; }
}
async function writeJson(p: string, data: any) {
  await fsp.mkdir(join(p, '..'), { recursive: true } as any).catch(() => {});
  await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

export class McpConfigRepository {
  private user: Record<string, McpServerDefinition> = {};
  private project: Record<string, McpServerDefinition> = {};
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    this.user = (await readJsonSafe(userConfigPath())) ?? {};
    this.project = (await readJsonSafe(projectConfigPath())) ?? {};
    this.loaded = true;
  }

  async list(scope: Scope): Promise<McpServerDefinition[]> {
    await this.ensureLoaded();
    return Object.values(this.getScope(scope));
  }

  async get(scope: Scope, name: string): Promise<McpServerDefinition | null> {
    await this.ensureLoaded();
    return this.getScope(scope)[name] ?? null;
  }

  async add(scope: Scope, def: McpServerDefinition): Promise<void> {
    await this.ensureLoaded();
    this.validate(def);
    const map = this.getScope(scope);
    map[def.name] = { ...def, enabled: def.enabled ?? true };
    await this.persist(scope);
  }

  async remove(scope: Scope, name: string): Promise<boolean> {
    await this.ensureLoaded();
    const map = this.getScope(scope);
    if (map[name]) { delete map[name]; await this.persist(scope); return true; }
    return false;
  }

  private getScope(scope: Scope): Record<string, McpServerDefinition> {
    return scope === 'user' ? this.user : this.project;
  }

  private async persist(scope: Scope) {
    if (scope === 'user') await writeJson(userConfigPath(), this.user);
    else await writeJson(projectConfigPath(), this.project);
  }

  private validate(def: McpServerDefinition): void {
    const errors: string[] = [];
    if (!def || typeof def !== 'object') errors.push('def must be object');
    if (!def.name || typeof def.name !== 'string') errors.push('name is required');
    if (!def.command || typeof def.command !== 'string') errors.push('command is required');
    if (def.transport && !['stdio','tcp','unix'].includes(def.transport)) errors.push('invalid transport');
    if (def.port != null && (!Number.isInteger(def.port) || def.port < 0)) errors.push('invalid port');
    if (errors.length) throw new Error(errors.join('; '));
  }
}