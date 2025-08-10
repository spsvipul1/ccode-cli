import type { LlmClient } from "../interfaces";
import { parseSse, withRetry } from "./Sse.js";

export class LlmClientAnthropic implements LlmClient {
  constructor(private apiKey = process.env.ANTHROPIC_API_KEY ?? '', private baseUrl = 'https://api.anthropic.com/v1/messages') {}

  async *streamChat(opts: { system: string; messages: Array<{role:'user'|'assistant'|'tool'; content: string|unknown; tool_call_id?: string }>; model: string; maxTokens?: number; functionTools?: Array<{ internalName: string; apiName: string; description?: string; parameters: any }> }): AsyncIterable<{ type: 'token'|'tool_call'|'done'|'error'; data?: unknown }>{
    if (!this.apiKey) {
      yield { type: 'error', data: { message: 'ANTHROPIC_API_KEY not set' } };
      yield { type: 'done' };
      return;
    }
    const body: any = {
      model: opts.model,
      system: opts.system,
      messages: opts.messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
      max_tokens: opts.maxTokens ?? 1024,
      stream: true
    };
    
    if (opts.functionTools && opts.functionTools.length > 0) {
      body.tools = opts.functionTools.map(tool => ({
        name: tool.apiName,
        description: tool.description || `Execute ${tool.internalName}`,
        input_schema: tool.parameters
      }));
    }

    const res = await withRetry(() => fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }));

    if (!res.ok || !res.body) {
      yield { type: 'error', data: { message: `anthropic http ${res.status}` } };
      yield { type: 'done' };
      return;
    }

    for await (const ev of parseSse(res.body)) {
      const data = ev.data;
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        const type = parsed.type;
        if (type === 'message_start' || type === 'message_stop') continue;
        if (type === 'content_block_start') {
          const b = parsed.content_block;
          if (b?.type === 'tool_use') {
            yield { type: 'tool_call', data: { id: b.id ?? '1', name: b.name, args: b.input ?? {} } };
          }
        } else if (type === 'content_block_delta') {
          const delta = parsed.delta;
          if (delta?.type === 'text_delta' && delta?.text) yield { type: 'token', data: delta.text };
        }
      } catch {
        // ignore non-json lines
      }
    }
    yield { type: 'done' };
  }
}
