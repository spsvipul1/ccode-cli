import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { TelemetryExporter } from '../interfaces';

function telemetryPath() {
  return join(homedir(), '.cli-code', 'telemetry.log');
}

export class FileTelemetry implements TelemetryExporter {
  private buffer: string[] = [];
  private started = false;

  async start(): Promise<void> {
    this.started = true;
  }

  emit(metric: { name: string; value: number; labels?: Record<string, string> }): void {
    if (!this.started) return;
    const line = JSON.stringify({ ts: Date.now(), ...metric });
    this.buffer.push(line);
    if (this.buffer.length > 100) void this.flush();
  }

  async flush(): Promise<void> {
    if (!this.buffer.length) return;
    const out = this.buffer.join('\n') + '\n';
    this.buffer = [];
    await fsp.mkdir(join(telemetryPath(), '..'), { recursive: true } as any).catch(()=>{});
    await fsp.appendFile(telemetryPath(), out, 'utf8');
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.started = false;
  }
}
