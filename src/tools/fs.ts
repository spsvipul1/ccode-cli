import type { Tool, ExecutionContext, ToolResult } from "../interfaces";
import { promises as fsp } from 'node:fs';
import { resolve, sep } from 'node:path';

function resolveSafe(cwd: string, p: string) {
  const abs = resolve(cwd, p);
  const normCwd = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!abs.startsWith(normCwd)) throw new Error('Path escapes project');
  return abs;
}

export const FsReadTool: Tool = {
  name: 'fs.read',
  validate(args: unknown) {
    if (!args || typeof (args as any).path !== 'string') return { valid: false, errors: ['path is required'] };
    return { valid: true };
  },
  async execute(args: { path: string; encoding?: BufferEncoding }, context: ExecutionContext): Promise<ToolResult> {
    try {
      const file = resolveSafe(context.cwd, args.path);
      const data = await fsp.readFile(file, { encoding: args.encoding ?? 'utf8' });
      return { ok: true, stdout: String(data) };
    } catch (e: any) {
      return { ok: false, stderr: e?.message ?? String(e), exitCode: 1 };
    }
  }
};

export const FsWriteTool: Tool = {
  name: 'fs.write',
  validate(args: unknown) {
    if (!args || typeof (args as any).path !== 'string' || typeof (args as any).content !== 'string') return { valid: false, errors: ['path and content are required'] };
    return { valid: true };
  },
  async execute(args: { path: string; content: string; encoding?: BufferEncoding }, context: ExecutionContext): Promise<ToolResult> {
    try {
      const file = resolveSafe(context.cwd, args.path);
      await fsp.writeFile(file, args.content, { encoding: args.encoding ?? 'utf8' });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, stderr: e?.message ?? String(e), exitCode: 1 };
    }
  }
};