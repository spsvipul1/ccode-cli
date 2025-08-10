import type { Tool, ToolManager, ExecutionContext, ToolResult } from "../interfaces";

export class DefaultToolManager implements ToolManager {
  private tools = new Map<string, Tool>();

  async registerTool(tool: Tool): Promise<void> {
    this.tools.set(tool.name, tool);
  }

  async unregisterTool(name: string): Promise<void> {
    this.tools.delete(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | null {
    return this.tools.get(name) ?? null;
  }

  async executeTool(name: string, args: unknown, context: ExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, stderr: `Unknown tool: ${name}`, exitCode: 3 };
    if (tool.validate) {
      const v = tool.validate(args);
      if (!v.valid) return { ok: false, stderr: (v.errors ?? []).join('; '), exitCode: 5 };
    }
    return await tool.execute(args, context);
  }
}