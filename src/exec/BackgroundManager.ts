import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export type BackgroundStatus = 'running' | 'exited' | 'error';

export interface BackgroundProcessInfo {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  status: BackgroundStatus;
  exitCode?: number | null;
  signal?: string | null;
  startedAt: number;
  endedAt?: number;
  stdoutTail: string;
  stderrTail: string;
}

class BackgroundProcess extends EventEmitter {
  public readonly id: string;
  public readonly command: string;
  public readonly args: string[];
  public readonly cwd: string;
  private child?: ChildProcess;
  private stdoutBuffer: string[] = [];
  private stderrBuffer: string[] = [];
  private maxTailLines = 500;
  public status: BackgroundStatus = 'running';
  public exitCode?: number | null;
  public signal?: string | null;
  public readonly startedAt: number = Date.now();
  public endedAt?: number;

  constructor(id: string, command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    super();
    this.id = id;
    this.command = command;
    this.args = args;
    this.cwd = cwd;

    const child = spawn(command, args, { cwd, env, shell: true });
    this.child = child;

    child.stdout?.on('data', (d: Buffer) => {
      const lines = String(d).split(/\r?\n/);
      for (const line of lines) {
        if (!line && lines.length > 1) continue;
        this.stdoutBuffer.push(line);
        if (this.stdoutBuffer.length > this.maxTailLines) this.stdoutBuffer.shift();
        this.emit('stdout', line);
      }
    });

    child.stderr?.on('data', (d: Buffer) => {
      const lines = String(d).split(/\r?\n/);
      for (const line of lines) {
        if (!line && lines.length > 1) continue;
        this.stderrBuffer.push(line);
        if (this.stderrBuffer.length > this.maxTailLines) this.stderrBuffer.shift();
        this.emit('stderr', line);
      }
    });

    child.on('error', (err) => {
      this.status = 'error';
      this.exitCode = 1;
      this.signal = null;
      this.endedAt = Date.now();
      this.emit('error', err);
    });

    child.on('close', (code, signal) => {
      this.status = code === 0 ? 'exited' : 'error';
      this.exitCode = code;
      this.signal = signal;
      this.endedAt = Date.now();
      this.emit('exit', { code, signal });
    });
  }

  kill(signal: NodeJS.Signals = 'SIGTERM') {
    if (this.child) this.child.kill(signal);
  }

  info(): BackgroundProcessInfo {
    return {
      id: this.id,
      command: this.command,
      args: this.args,
      cwd: this.cwd,
      status: this.status,
      exitCode: this.exitCode,
      signal: this.signal,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      stdoutTail: this.stdoutBuffer.join('\n'),
      stderrTail: this.stderrBuffer.join('\n')
    };
  }
}

export class BackgroundManager extends EventEmitter {
  private processes = new Map<string, BackgroundProcess>();
  private seq = 0;

  start(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }): string {
    const id = `${Date.now()}-${++this.seq}`;
    const proc = new BackgroundProcess(id, command, args, options.cwd, options.env);
    this.processes.set(id, proc);

    proc.on('exit', () => this.emit('updated', id));
    proc.on('error', () => this.emit('updated', id));
    proc.on('stdout', () => this.emit('updated', id));
    proc.on('stderr', () => this.emit('updated', id));
    this.emit('started', id);
    return id;
  }

  stop(id: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const p = this.processes.get(id);
    if (!p) return false;
    p.kill(signal);
    return true;
  }

  get(id: string): BackgroundProcessInfo | undefined {
    const p = this.processes.get(id);
    return p?.info();
  }

  list(): BackgroundProcessInfo[] {
    return Array.from(this.processes.values()).map((p) => p.info());
  }

  runningCount(): number {
    let n = 0;
    for (const p of this.processes.values()) if (p.status === 'running') n++;
    return n;
  }
}
