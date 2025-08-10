export type McpTool = {
  name: string;
  invoke: (args: unknown) => Promise<unknown> | unknown;
};

export class McpServer {
  public status: 'starting'|'running'|'stopped'|'error' = 'stopped';
  private toolMap = new Map<string, McpTool>();

  constructor(public readonly name: string, tools: McpTool[] = []) {
    for (const t of tools) this.toolMap.set(t.name, t);
  }

  async start(): Promise<void> {
    this.status = 'starting';
    // simulate startup
    await Promise.resolve();
    this.status = 'running';
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
  }

  tools(): string[] {
    return Array.from(this.toolMap.keys());
  }

  async invoke(tool: string, args: unknown): Promise<unknown> {
    const t = this.toolMap.get(tool);
    if (!t) throw new Error(`Unknown tool: ${tool}`);
    return await t.invoke(args);
  }

  // for tests: force error state
  __fail() { this.status = 'error'; }
}