import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { McpServerConfig } from './McpServerManager.js';

export type Scope = 'user' | 'project' | 'local';

export interface EnhancedMcpServerDefinition extends McpServerConfig {
  // Inherit all properties from McpServerConfig
}

function userConfigPath() {
  return join(homedir(), '.cli-code', 'config.mcp.enhanced.json');
}

function projectConfigPath() {
  return join(process.cwd(), '.cli-code', 'config.mcp.enhanced.json');
}

function localConfigPath() {
  return join(process.cwd(), 'config.mcp.local.json');
}

async function readJsonSafe(p: string): Promise<any> {
  try { 
    const s = await fsp.readFile(p, 'utf8'); 
    return JSON.parse(s); 
  } catch { 
    return {}; 
  }
}

async function writeJson(p: string, data: any) {
  await fsp.mkdir(join(p, '..'), { recursive: true } as any).catch(() => {});
  await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

export class EnhancedMcpConfigRepository {
  private user: Record<string, EnhancedMcpServerDefinition> = {};
  private project: Record<string, EnhancedMcpServerDefinition> = {};
  private local: Record<string, EnhancedMcpServerDefinition> = {};
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    
    this.user = (await readJsonSafe(userConfigPath())) ?? {};
    this.project = (await readJsonSafe(projectConfigPath())) ?? {};
    this.local = (await readJsonSafe(localConfigPath())) ?? {};
    
    // Migrate from old format if needed
    await this.migrateFromOldConfig();
    
    this.loaded = true;
  }

  private async migrateFromOldConfig(): Promise<void> {
    try {
      // Try to read old config format
      const oldUserPath = join(homedir(), '.cli-code', 'config.mcp.json');
      const oldProjectPath = join(process.cwd(), '.cli-code', 'config.mcp.json');
      
      const oldUser = await readJsonSafe(oldUserPath);
      const oldProject = await readJsonSafe(oldProjectPath);
      
      // Migrate user configs
      for (const [name, oldDef] of Object.entries(oldUser)) {
        if (!this.user[name]) {
          this.user[name] = this.migrateDefinition(oldDef as any);
        }
      }
      
      // Migrate project configs
      for (const [name, oldDef] of Object.entries(oldProject)) {
        if (!this.project[name]) {
          this.project[name] = this.migrateDefinition(oldDef as any);
        }
      }
      
      // Save migrated configs
      if (Object.keys(oldUser).length > 0) {
        await this.persist('user');
      }
      if (Object.keys(oldProject).length > 0) {
        await this.persist('project');
      }
      
    } catch (error) {
      // Migration failed - that's okay, we'll start fresh
    }
  }

  private migrateDefinition(oldDef: any): EnhancedMcpServerDefinition {
    return {
      name: oldDef.name,
      description: oldDef.description || `Migrated server: ${oldDef.name}`,
      transport: {
        type: oldDef.transport === 'tcp' ? 'http' : 'stdio',
        command: oldDef.command,
        args: oldDef.args,
        env: oldDef.env,
        url: oldDef.transport === 'tcp' ? `http://${oldDef.host || 'localhost'}:${oldDef.port || 3000}` : undefined
      },
      scope: 'user',
      enabled: oldDef.enabled ?? true,
      autoReconnect: true,
      timeout: 30000
    };
  }

  async list(scope?: Scope): Promise<EnhancedMcpServerDefinition[]> {
    await this.ensureLoaded();
    
    if (scope) {
      return Object.values(this.getScope(scope));
    }
    
    // Return all servers from all scopes
    const all: EnhancedMcpServerDefinition[] = [];
    all.push(...Object.values(this.user));
    all.push(...Object.values(this.project));
    all.push(...Object.values(this.local));
    
    return all;
  }

  async get(scope: Scope, name: string): Promise<EnhancedMcpServerDefinition | null> {
    await this.ensureLoaded();
    return this.getScope(scope)[name] ?? null;
  }

  async add(scope: Scope, def: EnhancedMcpServerDefinition): Promise<void> {
    await this.ensureLoaded();
    this.validate(def);
    
    const map = this.getScope(scope);
    map[def.name] = { 
      ...def, 
      scope,
      enabled: def.enabled ?? true,
      autoReconnect: def.autoReconnect ?? true,
      timeout: def.timeout ?? 30000
    };
    
    await this.persist(scope);
  }

  async update(scope: Scope, name: string, updates: Partial<EnhancedMcpServerDefinition>): Promise<boolean> {
    await this.ensureLoaded();
    
    const map = this.getScope(scope);
    const existing = map[name];
    
    if (!existing) {
      return false;
    }
    
    map[name] = { ...existing, ...updates, name: existing.name, scope };
    this.validate(map[name]);
    
    await this.persist(scope);
    return true;
  }

  async remove(scope: Scope, name: string): Promise<boolean> {
    await this.ensureLoaded();
    
    const map = this.getScope(scope);
    if (map[name]) { 
      delete map[name]; 
      await this.persist(scope); 
      return true; 
    }
    
    return false;
  }

  async getByName(name: string): Promise<{ server: EnhancedMcpServerDefinition; scope: Scope } | null> {
    await this.ensureLoaded();
    
    // Check local first, then project, then user
    if (this.local[name]) {
      return { server: this.local[name], scope: 'local' };
    }
    if (this.project[name]) {
      return { server: this.project[name], scope: 'project' };
    }
    if (this.user[name]) {
      return { server: this.user[name], scope: 'user' };
    }
    
    return null;
  }

  async getEnabled(scope?: Scope): Promise<EnhancedMcpServerDefinition[]> {
    const servers = await this.list(scope);
    return servers.filter(server => server.enabled);
  }

  async enable(scope: Scope, name: string): Promise<boolean> {
    return await this.update(scope, name, { enabled: true });
  }

  async disable(scope: Scope, name: string): Promise<boolean> {
    return await this.update(scope, name, { enabled: false });
  }

  private getScope(scope: Scope): Record<string, EnhancedMcpServerDefinition> {
    switch (scope) {
      case 'user': return this.user;
      case 'project': return this.project;
      case 'local': return this.local;
      default: throw new Error(`Invalid scope: ${scope}`);
    }
  }

  private async persist(scope: Scope) {
    switch (scope) {
      case 'user':
        await writeJson(userConfigPath(), this.user);
        break;
      case 'project':
        await writeJson(projectConfigPath(), this.project);
        break;
      case 'local':
        await writeJson(localConfigPath(), this.local);
        break;
    }
  }

  // For testing: reset the repository state
  reset() {
    this.user = {};
    this.project = {};
    this.local = {};
    this.loaded = false;
  }

  private validate(def: EnhancedMcpServerDefinition): void {
    const errors: string[] = [];
    
    if (!def || typeof def !== 'object') {
      errors.push('definition must be object');
    }
    
    if (!def.name || typeof def.name !== 'string') {
      errors.push('name is required');
    }
    
    if (!def.transport || typeof def.transport !== 'object') {
      errors.push('transport configuration is required');
    } else {
      const validTypes = ['stdio', 'sse', 'http', 'sse-ide', 'ws-ide'];
      if (!validTypes.includes(def.transport.type)) {
        errors.push(`invalid transport type: ${def.transport.type}`);
      }
      
      if (def.transport.type === 'stdio' && !def.transport.command) {
        errors.push('command is required for stdio transport');
      }
      
      if (['sse', 'http', 'sse-ide', 'ws-ide'].includes(def.transport.type) && !def.transport.url) {
        errors.push('url is required for network transports');
      }
    }
    
    if (!def.scope || !['user', 'project', 'local'].includes(def.scope)) {
      errors.push('invalid scope');
    }
    
    if (def.timeout != null && (!Number.isInteger(def.timeout) || def.timeout < 1000)) {
      errors.push('timeout must be at least 1000ms');
    }
    
    if (errors.length) {
      throw new Error(errors.join('; '));
    }
  }

  async export(scope?: Scope): Promise<Record<string, EnhancedMcpServerDefinition>> {
    await this.ensureLoaded();
    
    if (scope) {
      return { ...this.getScope(scope) };
    }
    
    return {
      ...this.user,
      ...this.project,
      ...this.local
    };
  }

  async import(scope: Scope, servers: Record<string, EnhancedMcpServerDefinition>): Promise<void> {
    await this.ensureLoaded();
    
    const map = this.getScope(scope);
    
    for (const [name, def] of Object.entries(servers)) {
      const serverDef = { ...def, name, scope };
      this.validate(serverDef);
      map[name] = serverDef;
    }
    
    await this.persist(scope);
  }

  async clear(scope: Scope): Promise<void> {
    await this.ensureLoaded();
    
    const map = this.getScope(scope);
    for (const key of Object.keys(map)) {
      delete map[key];
    }
    
    await this.persist(scope);
  }
}
