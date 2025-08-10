import { describe, it, expect } from 'vitest';
import { McpClient } from '../src/mcp/McpClient';

describe('McpClient', () => {
  it('aggregates tools from multiple connections', async () => {
    const c = new McpClient();
    await c.connect('a', ['fs.read','fs.write']);
    await c.connect('b', ['web.fetch','fs.read']);
    const tools = await c.listTools();
    expect(tools.sort()).toEqual(['fs.read','fs.write','web.fetch'].sort());
  });
});