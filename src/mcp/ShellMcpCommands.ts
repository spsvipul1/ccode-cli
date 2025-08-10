import { McpConfigRepository, type McpServerDefinition } from "./ConfigCrud.js";
import { McpClient } from "./McpClient.js";

export class ShellMcp {
  constructor(private repo = new McpConfigRepository(), private client = new McpClient()) {}

  async add(scope: 'user'|'project', name: string, command: string, args: string[] = []) {
    const def: McpServerDefinition = { name, command, args, enabled: true };
    await this.repo.add(scope, def);
    await this.client.connect(name, ['echo', 'ping']);
    return { ok: true };
  }

  async remove(scope: 'user'|'project', name: string) {
    const ok = await this.repo.remove(scope, name);
    return { ok };
  }

  async list(scope: 'user'|'project') {
    const list = (await this.repo.list(scope)).map((d) => ({ name: d.name, command: d.command, enabled: d.enabled !== false }));
    return { ok: true, stdout: JSON.stringify(list, null, 2) + '\n' };
  }

  async get(scope: 'user'|'project', name: string) {
    const def = await this.repo.get(scope, name);
    if (!def) return { ok: false, stderr: 'not found' };
    return { ok: true, stdout: JSON.stringify(def, null, 2) + '\n' };
  }

  async reconnect(name: string) {
    // Attempt to find the definition in any scope
    const def = (await this.repo.list('user')).find(d => d.name===name)
      ?? (await this.repo.list('project')).find(d => d.name===name);
    if (!def) return { ok: false, stderr: `server not found: ${name}` };
    try {
      await this.client.disconnect(name).catch(()=>{});
      await this.client.connect(name, ['echo','ping']);
      return { ok: true, stdout: `reconnected ${name}\n` };
    } catch (e: any) {
      return { ok: false, stderr: e?.message ?? String(e) };
    }
  }
}