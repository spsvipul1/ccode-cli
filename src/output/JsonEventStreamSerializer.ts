export type Write = (line: string) => void;

export class JsonEventStreamSerializer {
  constructor(private write: Write) {}

  emitToken(text: string, isFinal?: boolean): void {
    this.write(JSON.stringify({ token: { text, ...(isFinal ? { is_final: true } : {}) } }) + "\n");
  }
  emitToolCall(id: string, name: string, args: unknown): void {
    this.write(JSON.stringify({ tool_call: { id, name, args } }) + "\n");
  }
  emitToolResult(id: string, result: { ok: boolean; stdout?: string; stderr?: string; exit_code?: number }): void {
    this.write(JSON.stringify({ tool_result: { id, ...result } }) + "\n");
  }
  emitNotification(level: 'info'|'warn'|'error', message: string): void {
    this.write(JSON.stringify({ notification: { level, message, ts: Date.now() } }) + "\n");
  }
  emitHook(event: string, exitCode: number, io?: { stdout?: string; stderr?: string }): void {
    this.write(JSON.stringify({ hook: { event, exit_code: exitCode, ...(io?.stdout ? { stdout: io.stdout } : {}), ...(io?.stderr ? { stderr: io.stderr } : {}) } }) + "\n");
  }
  emitError(err: { message: string; code?: string; details?: unknown }): void {
    this.write(JSON.stringify({ error: { message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.details ? { details: err.details } : {}) } }) + "\n");
  }
  emitDone(): void {
    this.write(JSON.stringify({ done: {} }) + "\n");
  }
}