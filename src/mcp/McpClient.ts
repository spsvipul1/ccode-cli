export interface Connection {
  name: string;
  tools: string[];
  status: 'starting'|'running'|'stopped'|'error';
}

export class McpClient {
  private conns = new Map<string, Connection>();

  async connect(name: string, tools: string[]): Promise<void> {
    this.conns.set(name, { name, tools, status: 'running' });
  }

  async disconnect(name: string): Promise<void> {
    const c = this.conns.get(name);
    if (c) c.status = 'stopped';
  }

  async listTools(): Promise<string[]> {
    const t: string[] = [];
    for (const c of this.conns.values()) t.push(...c.tools);
    return Array.from(new Set(t));
  }
}