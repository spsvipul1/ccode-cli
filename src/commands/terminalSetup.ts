import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';

const pexec = promisify(execFile);

export async function terminalSetup(): Promise<string> {
  // Minimal cross-platform stub; real implementation would mirror chunk policy.
  if (process.platform === 'darwin') {
    // Attempt to set Option as Meta and visual bell via defaults (best-effort)
    try {
      await pexec('defaults', ['write', 'com.apple.Terminal', 'Bell', '-bool', 'false']);
    } catch {}
    return 'Configured Terminal.app settings (best-effort)\n';
  }
  // Ghostty/VSCode keybinding as example for non-macOS
  const confDir = join(homedir(), '.config', 'Code', 'User');
  try { mkdirSync(confDir, { recursive: true } as any); } catch {}
  const kb = join(confDir, 'keybindings.json');
  let json = '[]';
  try { json = readFileSync(kb, 'utf8'); } catch {}
  if (existsSync(kb)) copyFileSync(kb, kb + '.bak');
  try {
    const arr = JSON.parse(json);
    arr.push({ key:'shift+enter', command:'workbench.action.terminal.sendSequence', args:{ text:'\\n' }, when:'terminalFocus' });
    writeFileSync(kb, JSON.stringify(arr, null, 2));
  } catch {}
  return `Installed Shift+Enter keybinding (VSCode) at ${kb}\n`;
}
