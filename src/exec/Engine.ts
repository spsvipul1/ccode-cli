import { DefaultPermissionResolver } from "../permissions/PermissionResolver.js";
import { HookRegistry, HookRunner } from "../hooks/HookRunner.js";
import { DefaultToolManager } from "../tools/ToolManager.js";
import { BashTool } from "../tools/bash.js";
import { FsReadTool, FsWriteTool } from "../tools/fs.js";
import { WebFetchTool } from "../tools/web.js";
import { FileEditTool, FileMultiEditTool } from "../tools/edit.js";
import { NotebookEditTool } from "../tools/notebook.js";
import type { Parsed } from "../ui/commandRunner.js";
import { JsonEventStreamSerializer } from "../output/JsonEventStreamSerializer.js";
import { DecisionStore } from "../permissions/DecisionStore.js";

export type AllowDenyConfig = { allow?: string[]; deny?: string[]; defaultMode?: 'prompt'|'allow'|'deny' };

export class Engine {
  private resolver = new DefaultPermissionResolver();
  private hooks = new HookRunner(new HookRegistry());
  private mgr = new DefaultToolManager();
  private toolUniverse: string[] = ['bash.run','fs.read','fs.write','web.fetch','edit','multiedit','notebook.edit'];
  private decisions = new DecisionStore();

  constructor(private ctx: { cwd: string; env: NodeJS.ProcessEnv; permissions: AllowDenyConfig }) {
    this.mgr.registerTool(BashTool);
    this.mgr.registerTool(FsReadTool);
    this.mgr.registerTool(FsWriteTool);
    this.mgr.registerTool(WebFetchTool);
    this.mgr.registerTool(FileEditTool);
    this.mgr.registerTool(FileMultiEditTool);
    this.mgr.registerTool(NotebookEditTool);
  }

  async execute(parsed: Parsed, opts?: { stream?: JsonEventStreamSerializer }): Promise<{ ok: boolean; stdout?: string; stderr?: string; exitCode?: number }>{
    if (parsed.kind === 'echo') {
      const text = parsed.text + (parsed.text.endsWith('\n') ? '' : '\n');
      if (opts?.stream) opts.stream.emitToken(text, true);
      return { ok: true, stdout: text, exitCode: 0 };
    }

    const userScope = await this.decisions.asUserScope();
    const res = this.resolver.resolve({
      defaults: { allow: [], deny: [], defaultMode: 'deny' },
      user: userScope,
      cli: { allow: this.ctx.permissions.allow, deny: this.ctx.permissions.deny },
      toolUniverse: this.toolUniverse
    });

    const allowed = res.allowedTools.includes(parsed.toolId);
    if (!allowed) {
      const reason = res.reasons[parsed.toolId];
      const msg = `Denied by permissions (${reason?.source}:${reason?.pattern})`;
      if (opts?.stream) { opts.stream.emitNotification('error', msg); opts.stream.emitError({ message: msg, code: 'PERMISSION_DENIED' }); }
      return { ok: false, stderr: msg, exitCode: 2 };
    }

    const hookRes = await this.hooks.run('PreToolUse', { toolId: parsed.toolId, args: parsed.args });
    if (hookRes.exitCode === 2) {
      if (opts?.stream) { opts.stream.emitHook('PreToolUse', 2, { stderr: hookRes.stderr }); opts.stream.emitError({ message: hookRes.stderr ?? 'Blocked by hook', code: 'HOOK_BLOCKED' }); }
      return { ok: false, stderr: hookRes.stderr ?? 'Blocked by hook', exitCode: 2 };
    }

    if (opts?.stream) opts.stream.emitToolCall('1', parsed.toolId, parsed.args);

    const execRes = await this.mgr.executeTool(parsed.toolId, parsed.args, { cwd: this.ctx.cwd, env: this.ctx.env, permissions: new Set(res.allowedTools), sandboxPreferred: true, backgroundOutputCaps: { maxBytes: 131072, maxLines: 1000 } } as any);

    if (opts?.stream) opts.stream.emitToolResult('1', { ok: execRes.ok, stdout: execRes.stdout, stderr: execRes.stderr, exit_code: execRes.exitCode });

    await this.hooks.run('PostToolUse', { toolId: parsed.toolId, result: execRes });

    return { ok: execRes.ok, stdout: execRes.stdout, stderr: execRes.stderr, exitCode: execRes.exitCode };
  }

  getToolManager() { return this.mgr; }
  getPermissionResolver() { return this.resolver; }
  getHookRunner() { return this.hooks; }
}