import type { Tool, ExecutionContext, ToolResult } from "../interfaces";
import { promises as fsp } from 'node:fs';
import { resolve, sep } from 'node:path';

function resolveSafe(cwd: string, p: string) {
  const abs = resolve(cwd, p);
  const normCwd = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!abs.startsWith(normCwd)) throw new Error('Path escapes project');
  return abs;
}

function computeSnippet(original: string, oldStr: string, newStr: string, contextLines = 4) {
  const idx = original.indexOf(oldStr);
  if (idx < 0) return { snippet: original.slice(0, Math.min(original.length, 400)), startLine: 1 };
  const start = Math.max(0, original.lastIndexOf('\n', idx));
  const end = original.indexOf('\n', idx + oldStr.length);
  const startLine = original.slice(0, start).split(/\r?\n/).length;
  const before = original.slice(0, idx).split(/\r?\n/);
  const after = original.slice(idx + oldStr.length).split(/\r?\n/);
  const pre = before.slice(Math.max(0, before.length - contextLines)).join('\n');
  const post = after.slice(0, contextLines).join('\n');
  const snippet = [pre, newStr || '(empty)', post].filter(Boolean).join('\n');
  return { snippet, startLine };
}

export const FileEditTool: Tool = {
  name: 'edit',
  validate(args: unknown) {
    const a = args as any;
    if (!a || typeof a.file_path !== 'string') return { valid: false, errors: ['file_path required'] };
    if (typeof a.old_string !== 'string' || typeof a.new_string !== 'string') return { valid: false, errors: ['old_string and new_string required'] };
    return { valid: true };
  },
  async execute(args: { file_path: string; old_string: string; new_string: string; replace_all?: boolean }, context: ExecutionContext): Promise<ToolResult> {
    try {
      const p = resolveSafe(context.cwd, args.file_path);
      const orig = await fsp.readFile(p, 'utf8').catch(() => '');
      if (!orig && args.old_string !== '') {
        return { ok: false, stderr: 'File does not exist; use old_string="" to create new file', exitCode: 5 };
      }
      if (args.old_string === args.new_string) return { ok: false, stderr: 'No changes to make', exitCode: 5 };
      const occurrences = args.old_string ? orig.split(args.old_string).length - 1 : 0;
      if (!args.replace_all && args.old_string && occurrences > 1) {
        return { ok: false, stderr: `Found ${occurrences} matches, but replace_all=false`, exitCode: 5 };
      }
      let updated: string;
      if (args.old_string === '') updated = args.new_string; else updated = args.replace_all ? orig.split(args.old_string).join(args.new_string) : orig.replace(args.old_string, args.new_string);
      await fsp.writeFile(p, updated, 'utf8');
      const { snippet, startLine } = computeSnippet(orig, args.old_string, args.new_string);
      return { ok: true, stdout: `Updated ${args.file_path}\n` + `--- snippet @${startLine} ---\n${snippet}\n` };
    } catch (e: any) {
      return { ok: false, stderr: e?.message ?? String(e), exitCode: 1 };
    }
  }
};

export const FileMultiEditTool: Tool = {
  name: 'multiedit',
  validate(args: unknown) {
    const a = args as any;
    if (!a || typeof a.file_path !== 'string' || !Array.isArray(a.edits) || a.edits.length < 1) return { valid: false, errors: ['file_path and edits[] required'] };
    return { valid: true };
  },
  async execute(args: { file_path: string; edits: Array<{ old_string: string; new_string: string; replace_all?: boolean }> }, context: ExecutionContext): Promise<ToolResult> {
    try {
      const p = resolveSafe(context.cwd, args.file_path);
      const original = await fsp.readFile(p, 'utf8').catch(() => '');
      let working = original;
      for (const e of args.edits) {
        const count = e.old_string ? working.split(e.old_string).length - 1 : 0;
        if (!e.replace_all && e.old_string && count > 1) return { ok: false, stderr: `Ambiguous edit: ${e.old_string}`, exitCode: 5 };
        working = e.old_string === '' ? e.new_string : (e.replace_all ? working.split(e.old_string).join(e.new_string) : working.replace(e.old_string, e.new_string));
      }
      await fsp.writeFile(p, working, 'utf8');
      return { ok: true, stdout: `Applied ${args.edits.length} edits to ${args.file_path}\n` };
    } catch (e: any) {
      return { ok: false, stderr: e?.message ?? String(e), exitCode: 1 };
    }
  }
};
