import { JsonEventStreamSerializer } from "./JsonEventStreamSerializer.js";

export type Mode = 'tty' | 'print' | 'stream-json';

export interface Writers {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export class CliOutputModeController {
  private mode: Mode;
  private serializer: JsonEventStreamSerializer | null = null;

  constructor(mode: Mode, private writers: Writers) {
    this.mode = mode;
    if (mode === 'stream-json') this.serializer = new JsonEventStreamSerializer(this.writers.stdout);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.serializer = mode === 'stream-json' ? new JsonEventStreamSerializer(this.writers.stdout) : null;
  }

  writeFinal(text: string): void {
    if (this.mode === 'print') {
      this.writers.stdout(text + "\n");
    } else if (this.mode === 'stream-json') {
      this.serializer?.emitToken(text, true);
    } else {
      // tty: UI renders elsewhere
    }
  }

  writeError(err: { message: string; code?: string; details?: unknown }): void {
    if (this.mode === 'print') {
      this.writers.stderr(JSON.stringify({ error: { message: err.message, ...(err.code ? { code: err.code } : {}) } }) + "\n");
    } else if (this.mode === 'stream-json') {
      this.serializer?.emitError(err);
    } else {
      // tty: UI renders elsewhere
    }
  }

  emitEvent(event: unknown): void {
    if (this.mode === 'stream-json') {
      const e = event as any;
      if (e?.token) {
        this.serializer?.emitToken(e.token.text, e.token.is_final);
        return;
      }
      if (e?.tool_call) {
        this.serializer?.emitToolCall(e.tool_call.id, e.tool_call.name, e.tool_call.args);
        return;
      }
      if (e?.tool_result) {
        this.serializer?.emitToolResult(e.tool_result.id, e.tool_result);
        return;
      }
      if (e?.notification) {
        this.serializer?.emitNotification(e.notification.level, e.notification.message);
        return;
      }
      if (e?.hook) {
        this.serializer?.emitHook(e.hook.event, e.hook.exit_code, { stdout: e.hook.stdout, stderr: e.hook.stderr });
        return;
      }
      if (e?.error) {
        this.serializer?.emitError(e.error);
        return;
      }
      if (e?.done) {
        this.serializer?.emitDone();
        return;
      }
      this.writers.stdout(JSON.stringify(event) + "\n");
    } else if (this.mode === 'print') {
    } else {
    }
  }
}