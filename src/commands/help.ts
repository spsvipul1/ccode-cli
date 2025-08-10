const USAGE: Record<string, string> = {
  login: 'login [--profile <name>] [--force]  # authenticate via OAuth or env creds',
  logout: 'logout  # clear stored credentials',
  chat: 'chat [-s --session <id>] [-m --model <name>]  # start interactive chat',
  run: 'run [--cwd <path>] [--yes] <command...>  # run non-interactive command',
  edit: 'edit <file> [-i --instructions <text>] [--in-place]  # apply changes to a file',
  commit: 'commit [--all]  # generate commit message and commit',
  diff: 'diff [commit]  # show differences vs commit or unstaged',
  config: 'config <get|set|list|mcp ...>  # manage config and MCP',
  feedback: 'feedback  # submit feedback',
  help: 'help [command]  # show help'
};

export function getHelp(command?: string): string {
  if (!command) {
    return Object.values(USAGE).join('\n');
  }
  return USAGE[command] ?? 'Unknown command';
}