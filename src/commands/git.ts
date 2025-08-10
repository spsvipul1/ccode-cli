import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(_exec);

export async function gitInit(cwd: string) {
  await exec('git init -q', { cwd });
  await exec('git config user.email test@example.com', { cwd });
  await exec('git config user.name test', { cwd });
}

export async function gitAddAll(cwd: string) {
  await exec('git add -A', { cwd });
}

export async function gitCommit(cwd: string, message: string) {
  await exec(`git commit -m ${JSON.stringify(message)}`, { cwd });
}

export async function gitDiff(cwd: string, ref?: string) {
  const { stdout } = await exec(`git diff ${ref ?? ''}`.trim(), { cwd });
  return stdout;
}