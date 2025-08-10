import { DefaultToolManager } from "../tools/ToolManager.js";
import { BashTool } from "../tools/bash.js";
import { FsReadTool, FsWriteTool } from "../tools/fs.js";
import { FileEditTool, FileMultiEditTool } from "../tools/edit.js";
import { WebFetchTool } from "../tools/web.js";
import { NotebookEditTool } from "../tools/notebook.js";

const mgr = new DefaultToolManager();
await mgr.registerTool(BashTool);
await mgr.registerTool(FsReadTool);
await mgr.registerTool(FsWriteTool);
await mgr.registerTool(WebFetchTool);
await mgr.registerTool(FileEditTool);
await mgr.registerTool(FileMultiEditTool);
await mgr.registerTool(NotebookEditTool);

export type Parsed = { kind: 'tool'; toolId: string; args: any } | { kind: 'echo'; text: string };

export function parseCommand(line: string): Parsed {
  const idx = line.indexOf(':');
  const verb = idx >= 0 ? line.slice(0, idx).trim() : '';
  const argsStr = idx >= 0 ? line.slice(idx + 1).trim() : line.trim();
  switch (verb) {
    case 'bash':
      return { kind: 'tool', toolId: 'bash.run', args: { cmd: argsStr } };
    case 'fs.read':
      return { kind: 'tool', toolId: 'fs.read', args: { path: argsStr } };
    case 'fs.write': {
      const [p, ...c] = argsStr.split(/\s+/);
      return { kind: 'tool', toolId: 'fs.write', args: { path: p, content: c.join(' ') } };
    }
    case 'notebook.edit': {
      // usage: notebook.edit: path JSON
      const sp = argsStr.indexOf(' ');
      const file = sp>0 ? argsStr.slice(0, sp) : argsStr;
      const json = sp>0 ? argsStr.slice(sp+1) : '{}';
      const a = JSON.parse(json);
      return { kind: 'tool', toolId: 'notebook.edit', args: { notebook_path: file, ...a } };
    }
    case 'web.fetch':
      return { kind: 'tool', toolId: 'web.fetch', args: { url: argsStr } };
    case 'edit': {
      // usage: edit: file_path|old|new|replace_all
      const parts = argsStr.split('|');
      return { kind: 'tool', toolId: 'edit', args: { file_path: parts[0], old_string: parts[1] ?? '', new_string: parts[2] ?? '', replace_all: parts[3] === 'true' } };
    }
    case 'multiedit': {
      // usage: multiedit: file_path JSON_edits
      const sp = argsStr.indexOf(' ');
      const file = sp>0 ? argsStr.slice(0, sp) : argsStr;
      const json = sp>0 ? argsStr.slice(sp+1) : '[]';
      return { kind: 'tool', toolId: 'multiedit', args: { file_path: file, edits: JSON.parse(json) } };
    }
    case 'say':
      return { kind: 'echo', text: argsStr };
    default:
      return { kind: 'echo', text: argsStr };
  }
}

export async function runCommand(line: string, opts: { cwd: string; env: NodeJS.ProcessEnv }) {
  const parsed = parseCommand(line);
  if (parsed.kind === 'echo') {
    const text = parsed.text;
    return { ok: true, stdout: text + (text.endsWith('\n') ? '' : '\n'), exitCode: 0 };
  }
  return await mgr.executeTool(parsed.toolId, parsed.args, { cwd: opts.cwd, env: opts.env, permissions: new Set(['*']) } as any);
}