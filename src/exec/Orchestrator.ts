import type { ExecutionContext, Orchestrator as IOrchestrator, OrchestratorMode, LlmClient, ToolManager, PermissionResolver, HookRunner, FunctionToolDef } from "../interfaces";
import { ApprovalController } from "./ApprovalController.js";
import { PlanGate } from "./PlanGate.js";

function getToolDescription(name: string): string {
  switch (name) {
    case 'bash.run': return 'Execute a bash command in the shell';
    case 'fs.read': return 'Read the contents of a file';
    case 'fs.write': return 'Write content to a file';
    case 'edit': return 'Edit a file by replacing text';
    case 'multiedit': return 'Apply multiple edits to a file';
    case 'notebook.edit': return 'Edit a Jupyter notebook cell';
    case 'web.fetch': return 'Fetch content from a URL';
    case 'plan.approve': return 'Approve the proposed plan and allow write/edit commands to proceed';
    case 'task_complete': return 'Signal that the task is complete and provide final response to user';
    default: return `Execute ${name}`;
  }
}

function getToolParameters(name: string): any {
  switch (name) {
    case 'bash.run': return {
      type: 'object',
      properties: { cmd: { type: 'string', description: 'The bash command to execute' } },
      required: ['cmd']
    };
    case 'fs.read': return {
      type: 'object', 
      properties: { path: { type: 'string', description: 'Path to the file to read' } },
      required: ['path']
    };
    case 'fs.write': return {
      type: 'object',
      properties: { 
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'Content to write to the file' }
      },
      required: ['path', 'content']
    };
    case 'edit': return {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file to edit' },
        old_string: { type: 'string', description: 'Text to replace' },
        new_string: { type: 'string', description: 'Replacement text' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences' }
      },
      required: ['file_path', 'old_string', 'new_string']
    };
    case 'multiedit': return {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file to edit' },
        edits: { 
          type: 'array', 
          description: 'Array of edit operations',
          items: {
            type: 'object',
            properties: {
              old_string: { type: 'string' },
              new_string: { type: 'string' },
              replace_all: { type: 'boolean' }
            },
            required: ['old_string', 'new_string']
          }
        }
      },
      required: ['file_path', 'edits']
    };
    case 'web.fetch': return {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL to fetch' } },
      required: ['url']
    };
    case 'plan.approve': return {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Why the plan is safe to execute now' } },
      required: []
    };
    case 'notebook.edit': return {
      type: 'object',
      properties: {
        notebook_path: { type: 'string', description: 'Path to the notebook file' },
        cell_idx: { type: 'number', description: 'Cell index to edit' },
        is_new_cell: { type: 'boolean', description: 'Whether to create a new cell' },
        cell_language: { type: 'string', description: 'Cell language (python, markdown, etc.)' },
        old_string: { type: 'string', description: 'Text to replace in cell' },
        new_string: { type: 'string', description: 'Replacement text' }
      },
      required: ['notebook_path', 'cell_idx', 'is_new_cell', 'cell_language', 'old_string', 'new_string']
    };
    case 'task_complete': return {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of what was accomplished' },
        final_response: { type: 'string', description: 'Final response to present to the user' }
      },
      required: ['final_response']
    };
    default: return { type: 'object' };
  }
}

export class Orchestrator implements IOrchestrator {
  private planGate = new PlanGate();
  constructor(private llm: LlmClient, private approvals = new ApprovalController()) {}

  async run(options: {
    mode: OrchestratorMode
    model: string
    toolManager: ToolManager
    permissionResolver: PermissionResolver
    hooks: HookRunner
    serializer: { emitToken(text: string, isFinal?: boolean): void; emitToolCall(id: string, name: string, args: unknown): void; emitToolResult(id: string, result: { ok: boolean; stdout?: string; stderr?: string; exit_code?: number }): void; emitHook(event: string, exitCode: number, io?: { stdout?: string; stderr?: string }): void; emitError(err: { message: string; code?: string; details?: unknown }): void; emitDone(): void; emitNotification?(level: 'info'|'warn'|'error', message: string): void }
    context: ExecutionContext
    systemPrompt?: string
    messages?: Array<{role:'user'|'assistant'|'tool'; content: string|unknown; tool_call_id?: string }>
    maxRounds?: number
  }): Promise<void> {
    const { mode, model, toolManager, serializer } = options;
    const maxRounds = Math.max(1, Math.min(50, options.maxRounds ?? 20));
    // Wrap context to stream tool notifications into serializer
    const context: ExecutionContext = {
      ...options.context,
      onNotification: (n) => {
        try { options.serializer.emitNotification?.(n.level, n.message); } catch {}
      }
    } as ExecutionContext;
    const baseSystem = options.systemPrompt ?? 'You are a coding assistant. Use tools as needed to accomplish tasks. When you have completed the user\'s request, call task_complete with your final response.';
    let messages = options.messages ? [...options.messages] : [];

    // Plan mode is enforced via gating and plan_approve virtual tool in the main loop.

    // Build tool defs and mapping - include task_complete virtual tool
    const realTools = toolManager.listTools();
    const allToolDefs: FunctionToolDef[] = [
      ...realTools.map((t) => ({
        internalName: t.name,
        apiName: t.name.replace(/[^a-zA-Z0-9_]/g, '_'),
        description: getToolDescription(t.name),
        parameters: getToolParameters(t.name)
      })),
      {
        internalName: 'task_complete',
        apiName: 'task_complete',
        description: getToolDescription('task_complete'),
        parameters: getToolParameters('task_complete')
      }
    ];
    if (mode === 'plan') {
      allToolDefs.push({
        internalName: 'plan.approve',
        apiName: 'plan_approve',
        description: getToolDescription('plan.approve'),
        parameters: getToolParameters('plan.approve')
      });
    }
    const apiNameToInternal = new Map(allToolDefs.map((d) => [d.apiName, d.internalName] as const));
    const toolListText = allToolDefs.map(d => `- ${d.internalName}: ${d.description ?? ''}`).join('\n');

    let roundCount = 0;
    let taskCompleted = false;
    
    while (!taskCompleted && roundCount < maxRounds) { // safety limit
      roundCount++;
      // Planner shim for simple imperatives
      const last = messages[messages.length - 1];
      if (last && last.role === 'user' && typeof last.content === 'string') {
        const m = /\b(read|open|show)\b.*?\s(\/[\w\-\.\/~]+)\b/i.exec(last.content);
        if (m) {
          const path = m[2];
          const res = await toolManager.executeTool('fs.read', { path }, context);
          serializer.emitToolCall('planner_1', 'fs.read', { path });
          serializer.emitToolResult('planner_1', { ok: res.ok, stdout: res.stdout, stderr: res.stderr, exit_code: res.exitCode });
          messages.push({ role: 'tool', content: res.stdout ?? res.stderr ?? '', tool_call_id: 'planner_1' } as any);
        }
        const m2 = /\b(list|ls|show)\b.*(dir|directory|folder)\b/i.exec(last.content);
        if (m2) {
          const res = await toolManager.executeTool('bash.run', { cmd: 'ls -F' }, context);
          serializer.emitToolCall('planner_2', 'bash.run', { cmd: 'ls -F' });
          serializer.emitToolResult('planner_2', { ok: res.ok, stdout: res.stdout, stderr: res.stderr, exit_code: res.exitCode });
          messages.push({ role: 'tool', content: res.stdout ?? res.stderr ?? '', tool_call_id: 'planner_2' } as any);
        }
      }

      const system = `${baseSystem}\n\nAvailable tools:\n${toolListText}\n\nIMPORTANT: When you have fully completed the user's request, call task_complete with your final response. Use intermediate tool calls for information gathering and processing, then summarize with task_complete.`;
      const iterator = this.llm.streamChat({ system, model, messages, functionTools: allToolDefs });
      const collectedToolCalls: Array<{ id: string; internalName: string; args: any }> = [];
      let sawEvent = false;
      try {
        for await (const event of iterator) {
          sawEvent = true;
          if (event.type === 'token') {
            serializer.emitToken(String((event as any).data ?? ''), false);
          } else if (event.type === 'tool_call') {
            const { id, name, args } = (event as any).data || {};
            const internalName = apiNameToInternal.get(name) ?? name;
            collectedToolCalls.push({ id: String(id ?? '1'), internalName, args });
            
            // Label intermediate vs final calls
            if (internalName === 'task_complete') {
              serializer.emitToolCall(String(id ?? '1'), `[FINAL] ${internalName}`, args);
            } else {
              serializer.emitToolCall(String(id ?? '1'), `[INTERMEDIATE] ${internalName}`, args);
            }
          } else if (event.type === 'error') {
            const err = (event as any).data?.message ?? 'error';
            serializer.emitError({ message: err });
          } else if (event.type === 'done') {
            // handled after loop
          }
        }
      } catch (e: any) {
        serializer.emitError({ message: e?.message ?? String(e) });
      }

      if (!collectedToolCalls.length) {
        // No tool calls -> model just responded with text, continue loop
        continue;
      }

      // Execute tool calls, apply plan/approval gates, append tool messages
      for (const call of collectedToolCalls) {
        const { id, internalName, args } = call;
        
        // Handle task_complete - signal end of agentic loop
        if (internalName === 'task_complete') {
          const finalResponse = args?.final_response || 'Task completed';
          const summary = args?.summary || '';
          serializer.emitToolResult(id, { ok: true, stdout: `TASK COMPLETE\nSummary: ${summary}\nFinal Response: ${finalResponse}`, exit_code: 0 });
          serializer.emitToken(`\n\n=== FINAL RESPONSE ===\n${finalResponse}\n`, true);
          taskCompleted = true;
          break;
        }
        
        // Plan approval virtual tool
        if (mode === 'plan' && (internalName === 'plan.approve' || internalName === 'plan_approve')) {
          this.planGate.approvePlan();
          serializer.emitNotification?.('info' as any, 'Plan approved');
          serializer.emitToolResult(id, { ok: true, stdout: 'Plan approved\n', exit_code: 0 });
          continue;
        }

        if (mode === 'plan' && !this.planGate.isApproved() && /^(fs\.write|edit|multiedit|bash\.run)$/i.test(internalName)) {
          const msg = 'Plan mode: write/edit tools are blocked until plan approval';
          serializer.emitError({ message: msg, code: 'PERMISSION_DENIED' });
          serializer.emitToolResult(id, { ok: false, stderr: msg, exit_code: 2 });
          continue;
        }
        // Permission check using context.permissions set
        const permSet = (context.permissions ?? new Set<string>()) as Set<string>;
        const isAllowed = permSet.has('*') || permSet.has(internalName) || permSet.has(internalName.split('.')[0] + '.*');
        if (!isAllowed) {
          const msg = `Denied by permissions: ${internalName}`;
          serializer.emitError({ message: msg, code: 'PERMISSION_DENIED' });
          serializer.emitToolResult(id, { ok: false, stderr: msg, exit_code: 2 });
          continue;
        }

        // Hook: PreToolUse
        try {
          const pre = await options.hooks.run('PreToolUse', { toolId: internalName, args });
          serializer.emitHook('PreToolUse', pre.exitCode, { stdout: pre.stdout, stderr: pre.stderr });
          if (pre.exitCode === 2) {
            serializer.emitError({ message: pre.stderr ?? 'Blocked by hook', code: 'HOOK_BLOCKED' });
            serializer.emitToolResult(id, { ok: false, stderr: pre.stderr ?? 'Blocked by hook', exit_code: 2 });
            continue;
          }
        } catch (e: any) {
          serializer.emitError({ message: e?.message ?? String(e) });
        }

        if (this.approvals.shouldRequireApproval(internalName)) {
          const ok = await this.approvals.requestApproval({ id, name: internalName, args });
          if (!ok) {
            serializer.emitError({ message: `Approval required for ${internalName}`, code: 'APPROVAL_REQUIRED' });
            const granted = await this.approvals.waitForApproval(id);
            if (!granted) {
              serializer.emitToolResult(id, { ok: false, stderr: 'Approval not granted', exit_code: 2 });
              continue;
            }
          }
        }
        // Execute with basic retry on transient errors
        let res = await toolManager.executeTool(internalName, args, context);
        const transient = (txt?: string) => /timeout|temporar|econnrefused|network|rate.?limit/i.test(txt || '');
        if (!res.ok && (transient(res.stderr) || transient(res.stdout))) {
          serializer.emitNotification?.('warn' as any, `Retrying ${internalName} after transient error`);
          res = await toolManager.executeTool(internalName, args, context);
        }
        serializer.emitToolResult(id, { ok: res.ok, stdout: res.stdout, stderr: res.stderr, exit_code: res.exitCode });
        messages.push({ role: 'tool', content: res.stdout ?? res.stderr ?? '', tool_call_id: id } as any);

        // Hook: PostToolUse
        try {
          const post = await options.hooks.run('PostToolUse', { toolId: internalName, result: res });
          serializer.emitHook('PostToolUse', post.exitCode, { stdout: post.stdout, stderr: post.stderr });
        } catch (e: any) {
          serializer.emitError({ message: e?.message ?? String(e) });
        }
      }
    }
    
    if (!taskCompleted) {
      serializer.emitError({ message: 'Safety limit reached: model did not call task_complete' });
    }
    serializer.emitDone();
  }

  approvePlan() { this.planGate.approvePlan(); }
}
