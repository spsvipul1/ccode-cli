import { describe, it, expect } from 'vitest';
import { McpServer } from '../src/mcp/McpServer';
import { McpClient } from '../src/mcp/McpClient';

describe('McpServer', () => {
  it('starts, lists tools, invokes tool, and stops', async () => {
    const srv = new McpServer('local', [{ name: 'echo', invoke: async (a: any) => a }]);
    await srv.start();
    expect(srv.status).toBe('running');
    expect(srv.tools()).toContain('echo');
    const out = await srv.invoke('echo', { hi: 'there' });
    expect(out).toEqual({ hi: 'there' });
    await srv.stop();
    expect(srv.status).toBe('stopped');
  });

  it('client aggregates tools from server definitions', async () => {
    const c = new McpClient();
    await c.connect('srv1', ['a','b']);
    await c.connect('srv2', ['b','c']);
    expect((await c.listTools()).sort()).toEqual(['a','b','c'].sort());
  });
});