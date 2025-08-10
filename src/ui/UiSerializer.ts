import type { Event as UiEvent } from './Conversation.js';

export class UiEventStreamSerializer {
  constructor(private push: (ev: UiEvent) => void) {}

  emitToken(text: string, _isFinal?: boolean): void {
    this.push({ token: { text } });
  }
  emitToolCall(_id: string, name: string, args: unknown): void {
    this.push({ token: { text: `\n[tool_call] ${name} ${JSON.stringify(args)}\n` } });
  }
  emitToolResult(_id: string, result: { ok: boolean; stdout?: string; stderr?: string; exit_code?: number }): void {
    if (result.stdout) this.push({ token: { text: result.stdout } });
    if (result.stderr) this.push({ token: { text: result.stderr } });
    this.push({ notification: { level: result.ok ? 'info' : 'error', message: `tool exit ${result.exit_code ?? 0}` } });
  }
  emitNotification(level: 'info'|'warn'|'error', message: string): void {
    this.push({ notification: { level, message } });
  }
  emitHook(event: string, exitCode: number, io?: { stdout?: string; stderr?: string }): void {
    if (io?.stdout) this.push({ token: { text: io.stdout } });
    if (io?.stderr) this.push({ token: { text: io.stderr } });
    this.push({ notification: { level: exitCode === 0 ? 'info' : 'error', message: `hook ${event} exit ${exitCode}` } });
  }
  emitError(err: { message: string; code?: string; details?: unknown }): void {
    this.push({ notification: { level: 'error', message: `${err.code ?? 'error'}: ${err.message}` } });
  }
  emitDone(): void {
    // no-op
  }
}