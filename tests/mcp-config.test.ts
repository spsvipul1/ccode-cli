import { describe, it, expect } from 'vitest';
import { McpConfigRepository } from '../src/mcp/ConfigCrud';

describe('MCP Config CRUD', () => {
  it('adds, lists, gets and removes servers per scope', async () => {
    const repo = new McpConfigRepository();
    await repo.add('user', { name: 'u1', command: 'tool' });
    await repo.add('project', { name: 'p1', command: 'tool' });

    const userList = await repo.list('user');
    const projectList = await repo.list('project');
    expect(userList.map((d) => d.name)).toContain('u1');
    expect(projectList.map((d) => d.name)).toContain('p1');

    const got = await repo.get('user', 'u1');
    expect(got?.command).toBe('tool');
    expect(await repo.remove('user', 'u1')).toBe(true);
    expect(await repo.get('user', 'u1')).toBeNull();
  });

  it('validates inputs and rejects bad definitions', async () => {
    const repo = new McpConfigRepository();
    await expect(repo.add('user', { name: '', command: '' } as any)).rejects.toThrow();
    await expect(repo.add('user', { name: 'x', command: 'c', transport: 'bad' as any })).rejects.toThrow();
  });
});