import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DefaultToolManager } from '../src/tools/ToolManager';
import { WebFetchTool } from '../src/tools/web';
import { createServer, Server } from 'node:http';

let serverA: Server;
let serverB: Server;
let portA: number;
let portB: number;

function startServer(handler: Parameters<typeof createServer>[0]): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const s = createServer(handler);
    s.listen(0, () => {
      const address = s.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server: s, port });
    });
  });
}

describe('web.fetch tool', () => {
  beforeAll(async () => {
    ({ server: serverA, port: portA } = await startServer((req, res) => {
      if (req.url === '/redirect303') {
        res.statusCode = 303;
        res.setHeader('Location', `http://127.0.0.1:${portB}/final`);
        res.end();
        return;
      }
      res.statusCode = 200;
      res.end('A ok');
    }));
    ({ server: serverB, port: portB } = await startServer((req, res) => {
      if (req.url === '/final') {
        expect(req.headers['authorization']).toBeUndefined();
        expect(req.headers['cookie']).toBeUndefined();
        res.statusCode = 200;
        res.end('B ok');
        return;
      }
      res.statusCode = 200;
      res.end('B ok');
    }));
  });

  afterAll(async () => {
    serverA.close();
    serverB.close();
  });

  it('follows 303 and sanitizes headers on cross-origin', async () => {
    const mgr = new DefaultToolManager();
    await mgr.registerTool(WebFetchTool);
    const ctx = { cwd: process.cwd(), env: process.env, permissions: new Set(['web.fetch']) } as any;
    const res = await mgr.executeTool('web.fetch', {
      url: `http://127.0.0.1:${portA}/redirect303`,
      method: 'POST',
      headers: { Authorization: 'Bearer x', Cookie: 'a=b' },
      body: 'ignored'
    }, ctx);
    expect(res.ok).toBe(true);
    expect(res.stdout).toBe('B ok');
  });
});