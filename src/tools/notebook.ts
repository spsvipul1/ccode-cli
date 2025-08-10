import type { Tool, ExecutionContext, ToolResult } from "../interfaces";
import { promises as fsp } from 'node:fs';
import { resolve, sep } from 'node:path';

function resolveSafe(cwd: string, p: string) {
  const abs = resolve(cwd, p);
  const normCwd = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!abs.startsWith(normCwd)) throw new Error('Path escapes project');
  return abs;
}

type Mode = 'replace'|'insert'|'delete';

export const NotebookEditTool: Tool = {
  name: 'notebook.edit',
  validate(args: unknown) {
    const a = args as any;
    if (!a || typeof a.notebook_path !== 'string' || typeof a.edit_mode !== 'string') return { valid: false, errors: ['notebook_path and edit_mode required'] };
    return { valid: true };
  },
  async execute(args: { notebook_path: string; cell_id?: string; new_source?: string; cell_type?: 'code'|'markdown'; edit_mode: Mode }, context: ExecutionContext): Promise<ToolResult> {
    try {
      const p = resolveSafe(context.cwd, args.notebook_path);
      const txt = await fsp.readFile(p, 'utf8');
      const nb = JSON.parse(txt);
      if (!Array.isArray(nb.cells)) return { ok: false, stderr: 'Invalid notebook: missing cells', exitCode: 5 };
      const idx = ((): number => {
        if (args.cell_id) {
          const byId = nb.cells.findIndex((c: any) => c.id === args.cell_id);
          return byId >= 0 ? byId : -1;
        }
        return 0;
      })();
      const mode = args.edit_mode as Mode;
      if (mode === 'delete') {
        if (idx < 0) return { ok: false, stderr: 'Cell not found', exitCode: 5 };
        nb.cells.splice(idx, 1);
      } else if (mode === 'insert') {
        const ct = args.cell_type ?? 'code';
        const id = args.cell_id ?? Math.random().toString(36).slice(2);
        const cell = ct === 'markdown' ? { cell_type:'markdown', id, source: args.new_source ?? '', metadata:{} } : { cell_type:'code', id, source: args.new_source ?? '', metadata:{}, execution_count: null, outputs: [] };
        const insertAt = idx >= 0 ? idx+1 : nb.cells.length;
        nb.cells.splice(insertAt, 0, cell);
      } else {
        if (idx < 0) return { ok: false, stderr: 'Cell not found', exitCode: 5 };
        nb.cells[idx].source = args.new_source ?? '';
        if (args.cell_type && args.cell_type !== nb.cells[idx].cell_type) nb.cells[idx].cell_type = args.cell_type;
        if (nb.cells[idx].cell_type === 'code') { nb.cells[idx].execution_count = null; nb.cells[idx].outputs = []; }
      }
      await fsp.writeFile(p, JSON.stringify(nb, null, 1), 'utf8');
      return { ok: true, stdout: `notebook updated: ${args.notebook_path}\n` };
    } catch (e: any) {
      return { ok: false, stderr: e?.message ?? String(e), exitCode: 1 };
    }
  }
};
