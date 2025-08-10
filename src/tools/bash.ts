import type { Tool, ExecutionContext, ToolResult } from "../interfaces";
import { spawn } from 'node:child_process';

interface BashArgs { cmd: string; timeoutMs?: number; background?: boolean }

type ExecResult = { code: number | null; signal: string | null; stdout: string; stderr: string; errorCode?: string };

type Executor = (cmd: string, opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }) => Promise<ExecResult>;

function defaultExecutor(cmd: string, opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: opts.cwd, env: opts.env, shell: true });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const t = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, opts.timeoutMs);

    child.stdout.on('data', (d) => stdout += String(d));
    child.stderr.on('data', (d) => stderr += String(d));
    child.on('error', (err: any) => {
      clearTimeout(t);
      resolve({ code: 1, signal: null, stdout, stderr: err?.message ?? String(err), errorCode: err?.code });
    });
    child.on('close', (code, signal) => {
      clearTimeout(t);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function truncateOutput(text: string, caps?: { maxBytes?: number; maxLines?: number }) {
  const maxBytes = caps?.maxBytes ?? 131072;
  const maxLines = caps?.maxLines ?? 1000;
  let buf = Buffer.from(text);
  let truncated = false;
  if (buf.length > maxBytes) {
    buf = buf.subarray(buf.length - maxBytes);
    truncated = true;
  }
  let str = buf.toString('utf8');
  const lines = str.split(/\r?\n/);
  if (lines.length > maxLines) {
    str = lines.slice(lines.length - maxLines).join('\n');
    truncated = true;
  }
  if (truncated) str = str + `\n...[truncated]`;
  return { text: str, truncated };
}

function isNeverSandbox(cmd: string): boolean {
  const patterns = [/(npm|pnpm|yarn)\s+(test|run\s+test)/i, /pytest\b/i, /mvn\s+test/i, /make\s+(build|test)/i, /--watch\b/i, /serve\b/i];
  return patterns.some((re) => re.test(cmd));
}

function isSandboxDowngradeError(res: ExecResult): boolean {
  return res.errorCode === 'EACCES' || res.errorCode === 'EPERM' || /permission denied|operation not permitted|network.*restricted/i.test(res.stderr);
}

export function makeBashTool(executor: Executor = defaultExecutor): Tool {
  return {
    name: 'bash.run',
    validate(args: unknown) {
      const cmd = typeof (args as any)?.cmd === 'string' ? ((args as any).cmd as string).trim() : '';
      if (!cmd) return { valid: false, errors: ['cmd is required'] };
      return { valid: true };
    },
    async execute(args: BashArgs, context: ExecutionContext): Promise<ToolResult> {
      const { cmd, timeoutMs = 60_000, background = false } = args;
      const trimmed = (cmd ?? '').trim();
      if (!trimmed) return { ok: false, stderr: 'cmd is required', exitCode: 2 };
      const sandboxPreferred = context.sandboxPreferred === true && !isNeverSandbox(trimmed);

      let first = await executor(trimmed, { cwd: context.cwd, env: context.env, timeoutMs });
      if (sandboxPreferred && (first.code !== 0) && isSandboxDowngradeError(first)) {
        context.onNotification?.({ level: 'warn', message: 'Sandbox restrictions detected; retrying without sandbox' });
        first = await executor(trimmed, { cwd: context.cwd, env: context.env, timeoutMs });
      }

      const ok = (first.code ?? 0) === 0;
      if (background) {
        const out = truncateOutput(first.stdout, context.backgroundOutputCaps);
        const err = truncateOutput(first.stderr, context.backgroundOutputCaps);
        return { ok, stdout: out.text, stderr: err.text, exitCode: first.code ?? 0, signal: first.signal ?? undefined };
      } else {
        return { ok, stdout: first.stdout, stderr: first.stderr, exitCode: first.code ?? 0, signal: first.signal ?? undefined };
      }
    }
  };
}

export const BashTool: Tool = makeBashTool();