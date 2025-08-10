import type { LlmClient } from "../interfaces";
import { parseSse, withRetry } from "./Sse.js";

export class LlmClientOpenRouter implements LlmClient {
  constructor(private apiKey: string, private baseUrl = 'https://openrouter.ai/api/v1') {}

  async *streamChat(opts: { system: string; messages: Array<{ role: 'user' | 'assistant' | 'tool'; content: string | unknown; tool_call_id?: string }>; model: string; maxTokens?: number; functionTools?: Array<{ internalName: string; apiName: string; description?: string; parameters: any }> }): AsyncIterable<{ type: 'token' | 'tool_call' | 'done' | 'error'; data?: any }>{
    const messages = [
      { role: 'system', content: opts.system },
      ...opts.messages.map((m) => {
        const msg: any = { role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        return msg;
      })
    ];
    const body: any = {
      model: opts.model,
      messages,
      stream: true,
      temperature: 0,
      max_tokens: opts.maxTokens ?? 1024
    };
    if (opts.functionTools && opts.functionTools.length > 0) {
      body.tools = opts.functionTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.apiName,
          description: tool.description || `Execute ${tool.internalName}`,
          parameters: tool.parameters
        }
      }));
      body.tool_choice = 'auto';
    }

    const res = await withRetry(() => fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://local.cli',
        'X-Title': 'CLI Assistant'
      },
      body: JSON.stringify(body)
    }));

    if (!res.ok || !res.body) {
      yield { type: 'error', data: { message: `openrouter http ${res.status}` } };
      yield { type: 'done' };
      return;
    }

    const pending: Map<string, { name?: string; args: string }> = new Map();

    for await (const ev of parseSse(res.body)) {
      const data = ev.data;
      if (!data) continue;
      if (data === '[DONE]') { yield { type: 'done' }; return; }
      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;
        const toolCalls = delta?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          for (const call of toolCalls) {
            if (call.type === 'function') {
              const id = call.id ?? '1';
              const st = pending.get(id) ?? { args: '' };
              if (call.function?.name) st.name = call.function.name;
              if (typeof call.function?.arguments === 'string') st.args += call.function.arguments;
              pending.set(id, st);
            }
          }
        }
        const finish = choice?.finish_reason;
        if (finish === 'tool_calls') {
          for (const [id, st] of pending.entries()) {
            let argsObj: any = {};
            try { argsObj = st.args ? JSON.parse(st.args) : {}; } catch { argsObj = {}; }
            yield { type: 'tool_call', data: { id, name: st.name ?? 'unknown', args: argsObj } };
          }
          pending.clear();
        }
        const token = delta?.content;
        if (token) yield { type: 'token', data: token };
      } catch {}
    }
    yield { type: 'done' };
  }
}

