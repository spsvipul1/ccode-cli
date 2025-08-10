import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/exec/Orchestrator.js';
import { ApprovalController } from '../src/exec/ApprovalController.js';

class MockToolManager {
  async executeTool(name: string, args: any, _ctx: any) {
    if (name === 'fs.read') {
      const path = args?.path || 'unknown';
      return { ok: true, stdout: `File content of ${path}:\nHello world!\nThis is a test file.`, exitCode: 0 };
    }
    if (name === 'bash.run') {
      const cmd = args?.cmd || 'unknown';
      if (cmd.includes('ls')) return { ok: true, stdout: 'file1.txt\nfile2.py\ndirectory/\n', exitCode: 0 };
      if (cmd.includes('pwd')) return { ok: true, stdout: '/home/user/test\n', exitCode: 0 };
      return { ok: true, stdout: `Command output: ${cmd}\n`, exitCode: 0 };
    }
    return { ok: true, stdout: 'generic tool output\n', exitCode: 0 };
  }
  listTools() {
    return [{ name: 'fs.read' }, { name: 'bash.run' }, { name: 'web.fetch' }];
  }
}

class DummyResolver { 
  resolve() { return { allowedTools: ['*'], reasons: {} as any, promptsRequired: [] as any }; } 
}

class DummyHooks { 
  async run() { return { exitCode: 0 as const }; } 
}

function makeSerializer(collected: any[]) {
  return {
    emitToken: (t: string, isFinal?: boolean) => collected.push({ token: t, isFinal }),
    emitToolCall: (id: string, name: string, args: any) => collected.push({ tool_call: { id, name, args } }),
    emitToolResult: (id: string, result: any) => collected.push({ tool_result: { id, ...result } }),
    emitHook: () => {},
    emitError: (e: any) => collected.push({ error: e }),
    emitDone: () => collected.push({ done: true }),
  } as any;
}

describe('Agentic Loop Orchestrator', () => {
  it('should loop until model calls task_complete', async () => {
    let callCount = 0;
    const mockLlm = {
      async *streamChat(opts: any) {
        callCount++;
        if (callCount === 1) {
          // First round: gather information
          yield { type: 'token', data: 'Let me read the file first...' };
          yield { type: 'tool_call', data: { id: 't1', name: 'fs_read', args: { path: '/test/file.txt' } } };
          yield { type: 'done' };
        } else if (callCount === 2) {
          // Second round: analyze and complete
          yield { type: 'token', data: 'Now I have the information. Let me complete the task...' };
          yield { type: 'tool_call', data: { 
            id: 't2', 
            name: 'task_complete', 
            args: { 
              summary: 'Read file and analyzed content',
              final_response: 'The file contains "Hello world!" and test content. Analysis complete.'
            }
          }};
          yield { type: 'done' };
        }
      }
    };

    const approvals = new ApprovalController({ autoApprove: true });
    const orch = new Orchestrator(mockLlm as any, approvals);
    const events: any[] = [];
    const ser = makeSerializer(events);
    
    await orch.run({ 
      mode: 'default', 
      model: 'test-model', 
      toolManager: new MockToolManager() as any, 
      permissionResolver: new DummyResolver() as any, 
      hooks: new DummyHooks() as any, 
      serializer: ser, 
      context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any,
      messages: [{ role: 'user', content: 'Please read /test/file.txt and analyze it' }]
    });

    // Verify we had multiple rounds
    expect(callCount).toBe(2);
    
    // Verify intermediate and final tool calls were labeled
    const toolCalls = events.filter(e => e.tool_call);
    expect(toolCalls.some(tc => tc.tool_call.name.includes('[INTERMEDIATE]'))).toBe(true);
    expect(toolCalls.some(tc => tc.tool_call.name.includes('[FINAL]'))).toBe(true);
    
    // Verify final response was emitted
    const finalTokens = events.filter(e => e.token && e.isFinal);
    expect(finalTokens.length).toBeGreaterThan(0);
    expect(finalTokens[0].token).toContain('FINAL RESPONSE');
    expect(finalTokens[0].token).toContain('Analysis complete');
    
    // Verify task completion
    const taskCompleteResult = events.find(e => e.tool_result && e.tool_result.stdout?.includes('TASK COMPLETE'));
    expect(taskCompleteResult).toBeTruthy();
  });

  it('should handle multi-step complex tasks', async () => {
    let callCount = 0;
    const mockLlm = {
      async *streamChat(opts: any) {
        callCount++;
        if (callCount === 1) {
          yield { type: 'token', data: 'I need to check the current directory first...' };
          yield { type: 'tool_call', data: { id: 't1', name: 'bash_run', args: { cmd: 'pwd' } } };
          yield { type: 'done' };
        } else if (callCount === 2) {
          yield { type: 'token', data: 'Now let me list the files...' };
          yield { type: 'tool_call', data: { id: 't2', name: 'bash_run', args: { cmd: 'ls -la' } } };
          yield { type: 'done' };
        } else if (callCount === 3) {
          yield { type: 'token', data: 'Let me read one of the files...' };
          yield { type: 'tool_call', data: { id: 't3', name: 'fs_read', args: { path: '/test/config.txt' } } };
          yield { type: 'done' };
        } else {
          yield { type: 'token', data: 'Perfect! I have all the information needed.' };
          yield { type: 'tool_call', data: { 
            id: 't4', 
            name: 'task_complete', 
            args: { 
              summary: 'Analyzed directory structure and file contents',
              final_response: 'Directory analysis complete. Found 3 files including config.txt with test data.'
            }
          }};
          yield { type: 'done' };
        }
      }
    };

    const approvals = new ApprovalController({ autoApprove: true });
    const orch = new Orchestrator(mockLlm as any, approvals);
    const events: any[] = [];
    const ser = makeSerializer(events);
    
    await orch.run({ 
      mode: 'default', 
      model: 'test-model', 
      toolManager: new MockToolManager() as any, 
      permissionResolver: new DummyResolver() as any, 
      hooks: new DummyHooks() as any, 
      serializer: ser, 
      context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any,
      messages: [{ role: 'user', content: 'Analyze the current directory structure and contents' }]
    });

    // Should have gone through 4 rounds
    expect(callCount).toBe(4);
    
    // Should have multiple intermediate tool calls
    const intermediateCalls = events.filter(e => e.tool_call && e.tool_call.name.includes('[INTERMEDIATE]'));
    expect(intermediateCalls.length).toBe(3); // pwd, ls, fs.read
    
    // Should have one final call
    const finalCalls = events.filter(e => e.tool_call && e.tool_call.name.includes('[FINAL]'));
    expect(finalCalls.length).toBe(1);
    
    // Should complete successfully
    const taskCompleteResult = events.find(e => e.tool_result && e.tool_result.stdout?.includes('TASK COMPLETE'));
    expect(taskCompleteResult).toBeTruthy();
  });

  it('should handle safety limit when model never calls task_complete', async () => {
    let callCount = 0;
    const mockLlm = {
      async *streamChat(opts: any) {
        callCount++;
        // Model keeps making tool calls but never calls task_complete
        yield { type: 'token', data: `Round ${callCount}: still working...` };
        yield { type: 'tool_call', data: { id: `t${callCount}`, name: 'bash_run', args: { cmd: 'echo "still working"' } } };
        yield { type: 'done' };
      }
    };

    const approvals = new ApprovalController({ autoApprove: true });
    const orch = new Orchestrator(mockLlm as any, approvals);
    const events: any[] = [];
    const ser = makeSerializer(events);
    
    await orch.run({ 
      mode: 'default', 
      model: 'test-model', 
      toolManager: new MockToolManager() as any, 
      permissionResolver: new DummyResolver() as any, 
      hooks: new DummyHooks() as any, 
      serializer: ser, 
      context: { cwd: '.', env: process.env, permissions: new Set(['*']) } as any,
      messages: [{ role: 'user', content: 'Do something that never completes' }]
    });

    // Should hit the safety limit
    expect(callCount).toBe(20);
    
    // Should emit safety limit error
    const safetyError = events.find(e => e.error && e.error.message?.includes('Safety limit reached'));
    expect(safetyError).toBeTruthy();
  });
});
