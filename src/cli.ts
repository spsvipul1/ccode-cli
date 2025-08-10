#!/usr/bin/env node
import readline from 'node:readline';
import React from 'react';
import { Engine } from './exec/Engine.js';
import { parseCommand } from './ui/commandRunner.js';
import { JsonEventStreamSerializer } from './output/JsonEventStreamSerializer.js';
import { ShellMcp } from './mcp/ShellMcpCommands.js';
import { AuthManager } from './auth/AuthManager.js';
import { ConfigStore } from './core/ConfigStore.js';
import { DEFAULT_CONFIG } from './core/ConfigDefaults.js';
import { configureLLM } from './commands/configLLM.js';
import { addDir } from './commands/addDir.js';
import { terminalSetup } from './commands/terminalSetup.js';
import { initClaudeDoc } from './commands/init.js';
import { exportConversation } from './commands/export.js';
import { Orchestrator } from './exec/Orchestrator.js';
import { ApprovalController } from './exec/ApprovalController.js';
import { LlmClientAnthropic } from './llm/LlmClientAnthropic.js';
import { LlmClientOpenAI } from './llm/LlmClientOpenAI.js';
import { LlmClientOpenRouter } from './llm/LlmClientOpenRouter.js';

function help() {
  console.log(`ccode <subcommand>
  run "<command-string>"
  print
  stream
  ui
  chat [--mode plan]
  config <get|set|list> [--scope user|project] [key] [value]
  llm set <key> <value>  # Configure LLM provider and models
  auth login [--profile <name>] [--force]
  auth logout
  mcp add <scope> <name> <command> [args...]
  mcp list <scope>
  mcp get <scope> <name>
  mcp remove <scope> <name>

LLM Configuration:
  llm set provider <openai|anthropic|openrouter|auto>
  llm set openai.apiKey <YOUR_API_KEY>
  llm set openai.baseUrl <API_ENDPOINT>
  llm set openai.model <MODEL_NAME>
  llm set anthropic.apiKey <YOUR_API_KEY>
  llm set anthropic.baseUrl <API_ENDPOINT>
  llm set anthropic.model <MODEL_NAME>
  llm set openrouter.apiKey <YOUR_API_KEY>
  llm set openrouter.baseUrl <API_ENDPOINT>
  llm set openrouter.model <PROVIDER/MODEL_NAME>
  llm set openrouter.apiKey <YOUR_API_KEY>
  llm set openrouter.baseUrl <API_ENDPOINT>
  llm set openrouter.model <PROVIDER/MODEL_NAME>`);
}

function parseTop(argv: string[]) {
  const sub = argv[0];
  const rest = argv.slice(1);
  const flags: Record<string, string|boolean> = {};
  const positional: string[] = [];
  for (let i=0; i<rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const nxt = rest[i+1];
      if (nxt && !nxt.startsWith('--')) { flags[key] = nxt; i++; }
      else flags[key] = true;
    } else positional.push(a);
  }
  return { sub, flags, positional };
}

type ChatSession = {
  orch: Orchestrator
  provider: string
  model: string
  messages: Array<{ role: 'user'|'assistant'|'tool'; content: string; tool_call_id?: string }>
}

async function runShell(engine: Engine, serializer?: JsonEventStreamSerializer, approvals?: ApprovalController, orch?: Orchestrator, chat?: ChatSession) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('> ');
  console.log('Shell mode. Try: bash: echo hi | fs.read: package.json | web.fetch: https://example.com');
  console.log('MCP: mcp add/list/get/remove/reconnect | Auth: auth login/logout');
  rl.prompt();
  const mcp = new ShellMcp();
  const auth = new AuthManager();
  rl.on('line', async (line) => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === '/approve') {
      if (parts[1] === '--all') { approvals?.approveAll(); console.log('Approved all pending'); rl.prompt(); return; }
      const id = parts[1];
      if (!id) { console.log('usage: /approve <tool_call_id> | /approve --all'); rl.prompt(); return; }
      const ok = approvals?.approve(id);
      console.log(ok ? `Approved ${id}` : `No pending ${id}`);
      rl.prompt();
      return;
    }
    if (parts[0] === '/approvals') {
      const list = approvals?.listPending() ?? [];
      console.log(list.length ? list.map(p => `${p.id}: ${p.name} ${JSON.stringify(p.args)}`).join('\n') : 'No pending approvals');
      rl.prompt();
      return;
    }
    if (parts[0] === '/plan-approve') {
      orch?.approvePlan?.();
      console.log('Plan approved');
      rl.prompt();
      return;
    }
    if (parts[0] === 'mcp') {
      const [, action, scope, name, command, ...args] = parts;
      let r: any = { ok: false };
      switch (action) {
        case 'add': r = await mcp.add(scope as any, name!, command!, args); break;
        case 'remove': r = await mcp.remove(scope as any, name!); break;
        case 'list': r = await mcp.list(scope as any); break;
        case 'get': r = await mcp.get(scope as any, name!); break;
        case 'reconnect': r = await mcp.reconnect(scope!); break; // here scope holds server name when using: mcp reconnect <server>
      }
      if (r.ok && r.stdout) process.stdout.write(String(r.stdout));
      else if (!r.ok && r.stderr) process.stderr.write(String(r.stderr) + '\n');
      rl.prompt();
      return;
    }
    // Chat controls
    if (parts[0] === '/model' && chat) {
      chat.model = parts[1] || chat.model;
      console.log(`Model set to ${chat.model}`);
      rl.prompt();
      return;
    }
    if (parts[0] === '/history' && chat) {
      console.log(JSON.stringify(chat.messages.map(m => ({ role: m.role, content: m.content.slice(0,200) })), null, 2));
      rl.prompt();
      return;
    }
    if (parts[0] === '/add-dir') {
      try {
        const target = parts[1];
        const remembered = parts.includes('--remember');
        const msg = await addDir(process.cwd(), target, remembered);
        console.log(msg);
      } catch (e: any) { console.error(e?.message ?? String(e)); }
      rl.prompt();
      return;
    }
    if (parts[0] === '/terminal-setup') {
      try { const msg = await terminalSetup(); process.stdout.write(msg); } catch (e: any) { console.error(e?.message ?? String(e)); }
      rl.prompt();
      return;
    }
    if (parts[0] === '/init') {
      try { const p = initClaudeDoc(process.cwd()); console.log(`Created ${p}`); } catch (e: any) { console.error(e?.message ?? String(e)); }
      rl.prompt();
      return;
    }
    if (parts[0] === '/export') {
      try {
        const fn = parts[1];
        const name = exportConversation([{ role:'assistant', content:'(example)' }], fn);
        console.log(`Exported to ${name}`);
      } catch (e: any) { console.error(e?.message ?? String(e)); }
      rl.prompt();
      return;
    }
    if (parts[0] === 'auth') {
      const [, action] = parts;
      if (action === 'login') { const res = await (new AuthManager()).authenticateWithOAuth(); console.log('INFO: logged in via', res.provider); }
      else if (action === 'logout') { await (new AuthManager()).logout(); console.log('INFO: logged out'); }
      else console.log('usage: auth login|logout');
      rl.prompt();
      return;
    }

    const raw = line.trim();
    const isToolSyntax = /:\s*/.test(raw) || /^(bash|fs\.read|fs\.write|edit|multiedit|web\.fetch|notebook\.edit)\b/.test(raw);
    if (!isToolSyntax && chat && orch) {
      // Treat as chat message
      chat.messages.push({ role: 'user', content: raw });
      let assistantAcc = '';
      const ser = {
        // Human-friendly streaming: print tokens directly, newline on done
        emitToken: (t: string) => { assistantAcc += t; process.stdout.write(t); },
        emitToolCall: (_id: string, name: string, args: unknown) => process.stdout.write(`\n[tool_call] ${name} ${JSON.stringify(args)}\n`),
        emitToolResult: (id: string, result: any) => {
          if (result.stdout) process.stdout.write(`\n${result.stdout}`);
          if (result.stderr) process.stdout.write(`\n${result.stderr}`);
          process.stdout.write(`\n[tool_result ${id}] exit=${result.exit_code ?? 0}\n`);
        },
        emitHook: (event: string, exitCode: number, io?: { stdout?: string; stderr?: string }) => {
          if (io?.stdout) process.stdout.write(`\n${io.stdout}`);
          if (io?.stderr) process.stdout.write(`\n${io.stderr}`);
          process.stdout.write(`\n[hook ${event}] exit=${exitCode}\n`);
        },
        emitError: (e: any) => process.stdout.write(`\n[error] ${e?.code ? `${e.code}: ` : ''}${e?.message ?? String(e)}\n`),
        emitDone: () => { process.stdout.write('\n'); if (assistantAcc.trim().length) chat!.messages.push({ role: 'assistant', content: assistantAcc }); },
        emitNotification: (level: 'info'|'warn'|'error', message: string) => process.stdout.write(`\n[${level}] ${message}\n`)
      } as any;
      await orch.run({ mode: 'default', model: chat.model, toolManager: engine.getToolManager() as any, permissionResolver: engine.getPermissionResolver() as any, hooks: engine.getHookRunner() as any, serializer: ser, context: { cwd: process.cwd(), env: process.env, permissions: new Set(['*']) } as any, systemPrompt: 'You are a coding assistant.', messages: chat.messages });
    } else {
      // Treat as tool command or echo
      const parsed = parseCommand(raw);
      const res = await engine.execute(parsed, { stream: serializer });
      if (!serializer) {
        if (res.stdout) process.stdout.write(res.stdout);
        if (!res.ok && res.stderr) process.stderr.write(res.stderr + '\n');
        console.log(`${res.ok ? 'INFO' : 'ERROR'}: exit ${res.exitCode ?? (res.ok ? 0 : 1)}`);
      }
    }
    rl.prompt();
  });
  await new Promise<void>((resolve) => rl.on('close', () => resolve()));
}

async function main() {
  const { sub, flags, positional } = parseTop(process.argv.slice(2));
  const engine = new Engine({ cwd: process.cwd(), env: process.env, permissions: { allow: ['*'] } });

  if (!sub) {
    // Default to launching UI
    const { render } = await import('ink');
    const { App } = await import('./ui/App.js');
    render(React.createElement(App));
    return;
  }
  if (sub === 'ui') {
    // Launch Ink UI instead of shell
    const { render } = await import('ink');
    const { App } = await import('./ui/App.js');
    render(React.createElement(App));
    return;
  }

  if (sub === 'run') {
    const cmd = positional.join(' ');
    if (!cmd) { console.error('usage: ccode run "<command-string>"'); process.exit(3); }
    const res = await engine.execute(parseCommand(cmd));
    if (res.stdout) process.stdout.write(res.stdout);
    process.exit(res.exitCode ?? (res.ok ? 0 : 1));
  }

  if (sub === 'print') {
    const res = await engine.execute(parseCommand('bash: echo hello'));
    if (res.stdout) process.stdout.write(res.stdout);
    process.exit(res.exitCode ?? (res.ok ? 0 : 1));
  }

  if (sub === 'stream') {
    const ser = new JsonEventStreamSerializer((l) => process.stdout.write(l));
    const res = await engine.execute(parseCommand('bash: echo hello'), { stream: ser });
    process.exit(res.exitCode ?? (res.ok ? 0 : 1));
  }

  if (sub === 'chat') {
    const approvals = new ApprovalController();
    const store = new ConfigStore();
    // Try to read config, fallback to defaults/env
    const provider = JSON.parse((await store.get('user','llm.provider')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.provider));
    const openaiApiKey = JSON.parse((await store.get('user','llm.openai.apiKey')).trim() || '""');
    const openaiEnvName = JSON.parse((await store.get('user','llm.openai.apiKeyEnv')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.openai.apiKeyEnv));
    const openaiBaseUrl = JSON.parse((await store.get('user','llm.openai.baseUrl')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.openai.baseUrl));
    const openaiModel = JSON.parse((await store.get('user','llm.openai.model')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.openai.model));
    const anthropicApiKey = JSON.parse((await store.get('user','llm.anthropic.apiKey')).trim() || '""');
    const anthropicEnvName = JSON.parse((await store.get('user','llm.anthropic.apiKeyEnv')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.anthropic.apiKeyEnv));
    const anthropicBaseUrl = JSON.parse((await store.get('user','llm.anthropic.baseUrl')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.anthropic.baseUrl));
    const anthropicModel = JSON.parse((await store.get('user','llm.anthropic.model')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.anthropic.model));
    const openrouterApiKey = JSON.parse((await store.get('user','llm.openrouter.apiKey')).trim() || '""');
    const openrouterEnvName = JSON.parse((await store.get('user','llm.openrouter.apiKeyEnv')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.openrouter.apiKeyEnv));
    const openrouterBaseUrl = JSON.parse((await store.get('user','llm.openrouter.baseUrl')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.openrouter.baseUrl));
    const openrouterModel = JSON.parse((await store.get('user','llm.openrouter.model')).trim() || JSON.stringify(DEFAULT_CONFIG.llm.openrouter.model));
    // Use direct API key from config, or fallback to environment variable
    const openaiKey = openaiApiKey || process.env[openaiEnvName] || process.env.OPENAI_API_KEY;
    const anthropicKey = anthropicApiKey || process.env[anthropicEnvName] || process.env.ANTHROPIC_API_KEY;
    const openrouterKey = openrouterApiKey || process.env[openrouterEnvName] || process.env.OPENROUTER_API_KEY;
    let llm: any;
    if ((provider === 'openai' || provider === 'auto') && openaiKey) llm = new LlmClientOpenAI(openaiKey, openaiBaseUrl);
    else if ((provider === 'anthropic' || provider === 'auto') && anthropicKey) llm = new LlmClientAnthropic(anthropicKey, anthropicBaseUrl);
    else if ((provider === 'openrouter' || provider === 'auto') && openrouterKey) llm = new LlmClientOpenRouter(openrouterKey, openrouterBaseUrl);
    else {
      llm = { async *streamChat() { yield { type: 'tool_call', data: { id: 't1', name: 'edit', args: { file_path: 'docs/implementation/file.txt', old_string: '', new_string: 'hello world\n' } } }; yield { type: 'done' }; } };
    }
    const orch = new Orchestrator(llm, approvals);
    const modeFlag = (flags.mode as string) === 'plan' ? 'plan' : 'default';
    const selectedModel = (provider === 'openai') ? openaiModel : (provider === 'anthropic') ? anthropicModel : (provider === 'openrouter') ? openrouterModel : (openaiKey ? openaiModel : (anthropicKey ? anthropicModel : openrouterModel));
    const chatSession: ChatSession = { orch, provider, model: selectedModel, messages: [] };
    await runShell(engine, undefined, approvals, orch, chatSession);
    return;
  }

  if (sub === 'config') {
    const store = new ConfigStore();
    const scope = (flags.scope as string) === 'project' ? 'project' : 'user';
    const action = positional[0];
    if (action === 'list') { process.stdout.write(await store.list(scope)); return; }
    if (action === 'get') { const key = positional[1]; if (!key) { console.error('usage: ccode config get <key>'); process.exit(3); } process.stdout.write(await store.get(scope, key)); return; }
    if (action === 'set') { const key = positional[1]; const value = positional[2]; if (!key || value === undefined) { console.error('usage: ccode config set <key> <value>'); process.exit(3); } await store.set(scope, key, JSON.parse(value)); return; }
    console.error('usage: ccode config <get|set|list> [--scope user|project] [key] [value]'); process.exit(3);
  }

  if (sub === 'llm') {
    const res = await configureLLM(positional);
    if (!res.ok) { console.error(res.stderr); process.exit(3); }
    if (res.stdout) process.stdout.write(res.stdout);
    return;
  }

  if (sub === 'auth') {
    const am = new AuthManager();
    const action = positional[0];
    if (action === 'login') { const _profile = flags.profile as string | undefined; const _force = !!flags.force; const res = await am.authenticateWithOAuth(); console.log('INFO: logged in via', res.provider); return; }
    if (action === 'logout') { await am.logout(); console.log('INFO: logged out'); return; }
    console.error('usage: ccode auth <login|logout>'); process.exit(3);
  }

  console.error('Unknown subcommand');
  help();
  process.exit(3);
}

main().catch((e) => { console.error(e?.message ?? String(e)); process.exit(1); });