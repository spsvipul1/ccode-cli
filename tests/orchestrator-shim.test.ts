import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/exec/Orchestrator.js';

class DummyToolManager {
  calls: any[] = [];
  async executeTool(name: string, args: any, _ctx: any) {
    this.calls.push({ name, args });
    if (name === 'fs.read') return { ok: true, stdout: 'FILE\n', exitCode: 0 };
    if (name === 'bash.run') return { ok: true, stdout: 'A\nB\n', exitCode: 0 };
    return { ok: true, stdout: 'ok\n', exitCode: 0 };
  }
  listTools() { return [{ name: 'fs.read' }, { name: 'bash.run' }]; }
}
class DummyResolver { resolve() { return { allowedTools: ['fs.read','bash.run'], reasons: {} as any, promptsRequired: [] as any }; } }
class DummyHooks { async run() { return { exitCode: 0 as const }; } }

function ser(events: any[]) {
  return {
    emitToken: (t: string) => events.push({ t }),
    emitToolCall: (id: string, name: string, args: any) => events.push({ call: { id, name, args } }),
    emitToolResult: (id: string, r: any) => events.push({ result: { id, ...r } }),
    emitHook: () => {}, emitError: () => {}, emitDone: () => {}
  } as any;
}

describe('planner shim', () => {
  it('reads file when user asks in plain text', async () => {
    const mgr = new DummyToolManager();
    const orch = new Orchestrator({ async *streamChat() { yield { type: 'done' }; } } as any);
    const events: any[] = [];
    await orch.run({ mode: 'default', model: 'x', toolManager: mgr as any, permissionResolver: new DummyResolver() as any, hooks: new DummyHooks() as any, serializer: ser(events), context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any, messages: [{ role:'user', content: 'read /tmp/file.txt' }] });
    expect(mgr.calls.some(c => c.name === 'fs.read' && c.args.path === '/tmp/file.txt')).toBe(true);
  });
  it('lists directory when user asks in plain text', async () => {
    const mgr = new DummyToolManager();
    const orch = new Orchestrator({ async *streamChat() { yield { type: 'done' }; } } as any);
    const events: any[] = [];
    await orch.run({ mode: 'default', model: 'x', toolManager: mgr as any, permissionResolver: new DummyResolver() as any, hooks: new DummyHooks() as any, serializer: ser(events), context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any, messages: [{ role:'user', content: 'list the directory' }] });
    expect(mgr.calls.some(c => c.name === 'bash.run' && c.args.cmd === 'ls -F')).toBe(true);
  });
});

