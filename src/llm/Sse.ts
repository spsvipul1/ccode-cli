export type SseEvent = { event?: string; data?: string };

export async function* parseSse(body: any): AsyncIterable<SseEvent> {
  const reader = body?.getReader?.();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let ev: SseEvent = {};
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) ev.data = (ev.data ?? '') + line.slice(5).trim();
      }
      yield ev;
    }
  }
  if (buffer.length > 0) {
    let ev: SseEvent = {};
    for (const line of buffer.split('\n')) {
      if (line.startsWith('event:')) ev.event = line.slice(6).trim();
      else if (line.startsWith('data:')) ev.data = (ev.data ?? '') + line.slice(5).trim();
    }
    yield ev;
  }
}

export async function withRetry<T>(fn: () => Promise<T>, opts?: { maxRetries?: number; baseDelayMs?: number }): Promise<T> {
  const max = opts?.maxRetries ?? 3;
  const base = opts?.baseDelayMs ?? 500;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt > max) throw err;
      const jitter = Math.floor(Math.random() * 200);
      const delay = base * Math.pow(2, attempt - 1) + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

