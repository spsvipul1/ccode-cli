import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/exec/Orchestrator.js';
import { ApprovalController } from '../src/exec/ApprovalController.js';

class DummyToolManager {
  async executeTool(name: string, _args: any, _ctx: any) {
    if (name === 'edit') return { ok: true, stdout: 'edited\n', exitCode: 0 };
    return { ok: true, stdout: 'ok\n', exitCode: 0 };
  }
  listTools() {
    return [{ name: 'edit' }, { name: 'bash.run' }];
  }
}
class DummyResolver { resolve() { return { allowedTools: ['edit'], reasons: {} as any, promptsRequired: [] as any }; } }
class DummyHooks { async run() { return { exitCode: 0 as const }; } }

function makeSerializer(collected: any[]) {
  return {
    emitToken: (t: string) => collected.push({ token: t }),
    emitToolCall: (id: string, name: string, args: any) => collected.push({ tool_call: { id, name, args } }),
    emitToolResult: (id: string, result: any) => collected.push({ tool_result: { id, ...result } }),
    emitHook: () => {},
    emitError: (e: any) => collected.push({ error: e }),
    emitDone: () => collected.push({ done: true }),
  } as any;
}

describe('Orchestrator approvals and plan mode', () => {
  it('requires approval for edit and runs after approving', async () => {
    const approvals = new ApprovalController({ autoApprove: false });
    let callCount = 0;
    const orch = new Orchestrator({
      async *streamChat() {
        callCount++;
        if (callCount === 1) {
          yield { type: 'tool_call', data: { id: 't1', name: 'edit', args: { file_path: 'f', old_string: '', new_string: 'x' } } };
          yield { type: 'done' };
        } else {
          // After approval, complete the task
          yield { type: 'tool_call', data: { id: 't2', name: 'task_complete', args: { final_response: 'Edit completed successfully' } } };
          yield { type: 'done' };
        }
      }
    } as any, approvals);
    const events: any[] = [];
    const ser = makeSerializer(events);
    const prom = orch.run({ mode: 'default', model: 'x', toolManager: new DummyToolManager() as any, permissionResolver: new DummyResolver() as any, hooks: new DummyHooks() as any, serializer: ser, context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any });
    // orchestrator will request approval and wait
    await new Promise((r) => setTimeout(r, 50));
    approvals.approve('t1');
    await prom;
    expect(events.some(e => e.tool_result && e.tool_result.id === 't1' && e.tool_result.ok)).toBe(true);
  });

  it('blocks in plan mode until plan.approve', async () => {
    const approvals = new ApprovalController({ autoApprove: true });
    let callCount = 0;
    const orch = new Orchestrator({
      async *streamChat() {
        callCount++;
        if (callCount === 1) {
          yield { type: 'tool_call', data: { id: 't1', name: 'edit', args: {} } };
          yield { type: 'tool_call', data: { id: 't2', name: 'plan.approve', args: {} } };
          yield { type: 'tool_call', data: { id: 't3', name: 'edit', args: {} } };
          yield { type: 'done' };
        } else {
          // Complete after plan approval and edit
          yield { type: 'tool_call', data: { id: 't4', name: 'task_complete', args: { final_response: 'Plan executed successfully' } } };
          yield { type: 'done' };
        }
      }
    } as any, approvals);
    const events: any[] = [];
    const ser = makeSerializer(events);
    await orch.run({ mode: 'plan', model: 'x', toolManager: new DummyToolManager() as any, permissionResolver: new DummyResolver() as any, hooks: new DummyHooks() as any, serializer: ser, context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any });
    const denied = events.filter(e => e.error?.code === 'PERMISSION_DENIED');
    const okAfter = events.find(e => e.tool_result && e.tool_result.id === 't3' && e.tool_result.ok);
    expect(denied.length).toBeGreaterThan(0);
    expect(!!okAfter).toBe(true);
  });
});

