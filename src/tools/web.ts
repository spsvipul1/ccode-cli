import type { Tool, ExecutionContext, ToolResult } from "../interfaces";
import { request, type Dispatcher } from 'undici';

function sanitizeHeadersForCrossOrigin(original: Record<string,string | string[] | undefined>) {
  const drop = new Set(['authorization','cookie']);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(original)) {
    const key = k.toLowerCase();
    if (drop.has(key)) continue;
    if (typeof v === 'string') out[key] = v;
    else if (Array.isArray(v)) out[key] = v.join(', ');
  }
  return out;
}

export const WebFetchTool: Tool = {
  name: 'web.fetch',
  validate(args: unknown) {
    if (!args || typeof (args as any).url !== 'string') return { valid: false, errors: ['url is required'] };
    return { valid: true };
  },
  async execute(args: { url: string; method?: string; headers?: Record<string,string>; body?: string; maxRedirects?: number }, _context: ExecutionContext): Promise<ToolResult> {
    const maxRedirects = args.maxRedirects ?? 5;
    let url = args.url;
    let method = (args.method ?? 'GET').toUpperCase() as Dispatcher.HttpMethod;
    let headers: Record<string,string> = { ...(args.headers ?? {}) };

    for (let i=0; i<=maxRedirects; i++) {
      const res = await request(url, { method, headers, body: args.body });
      const { statusCode } = res;
      if ([301,302,303,307,308].includes(statusCode)) {
        const locHeader = res.headers.location;
        const loc = Array.isArray(locHeader) ? locHeader[0] : locHeader;
        if (!loc) return { ok: false, stderr: 'redirect without location', exitCode: 1 };
        const next = new URL(loc, url);
        const prev = new URL(url);
        const crossOrigin = next.origin !== prev.origin;
        if (crossOrigin) headers = sanitizeHeadersForCrossOrigin(headers);
        if (statusCode === 303) method = 'GET';
        url = next.toString();
        continue;
      }
      const body = await res.body.text();
      return { ok: statusCode >= 200 && statusCode < 300, stdout: body, stderr: statusCode >= 400 ? String(statusCode) : undefined, exitCode: statusCode };
    }

    return { ok: false, stderr: 'max redirects', exitCode: 1 };
  }
};