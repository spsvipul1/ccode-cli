import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Conversation, type Event as UiEvent } from './Conversation.js';
import { parseCommand } from './commandRunner.js';
import { Engine } from '../exec/Engine.js';
import { UiEventStreamSerializer } from './UiSerializer.js';
import { ApprovalController } from '../exec/ApprovalController.js';
import { Orchestrator } from '../exec/Orchestrator.js';
import { LlmClientOpenAI } from '../llm/LlmClientOpenAI.js';
import { LlmClientAnthropic } from '../llm/LlmClientAnthropic.js';
import { LlmClientOpenRouter } from '../llm/LlmClientOpenRouter.js';
import { ConfigStore } from '../core/ConfigStore.js';
import { DEFAULT_CONFIG } from '../core/ConfigDefaults.js';

function createEventQueue() {
  const listeners: ((ev: UiEvent) => void)[] = [];
  const push = (ev: UiEvent) => listeners.forEach((l) => l(ev));
  async function* stream() {
    while (true) {
      const ev = await new Promise<UiEvent>((resolve) => listeners.push(resolve));
      yield ev;
    }
  }
  return { push, stream };
}

export function App({ autoChat = true }: { autoChat?: boolean } = {}) {
  const [value, setValue] = useState<string>('');
  const { push, stream } = useMemo(() => createEventQueue(), []);
  const engine = useMemo(() => new Engine({ cwd: process.cwd(), env: process.env, permissions: { allow: ['*'] } }), []);
  const serializer = useMemo(() => new UiEventStreamSerializer(push), [push]);
  const approvals = useMemo(() => new ApprovalController(), []);
  const orchRef = useRef<Orchestrator | null>(null);
  const modelRef = useRef<string>('');
  const chatRef = useRef<{ messages: Array<{ role: 'user'|'assistant'|'tool'; content: string }>; model: string } | null>(null);

  useInput(async (input, key) => {
    if (key.return) {
      const line = value.trim();
      if (line.length > 0) {
        push({ token: { text: `\n> ${line}\n` } });
        if (line === '/help') {
          push({ token: { text: `Commands:\n/approve <id>|--all\n/approvals\n/plan-approve\n/model <name>\n/chat\n/help\n` } });
          setValue('');
          return;
        }
        const parts = line.split(/\s+/);
        if (parts[0] === '/approve') {
          if (parts[1] === '--all') { approvals.approveAll(); push({ notification: { level: 'info', message: 'Approved all pending' } }); }
          else if (parts[1]) { const ok = approvals.approve(parts[1]); push({ notification: { level: ok ? 'info' : 'error', message: ok ? `Approved ${parts[1]}` : `No pending ${parts[1]}` } }); }
          else push({ notification: { level: 'error', message: 'usage: /approve <id>|--all' } });
          setValue('');
          return;
        }
        if (parts[0] === '/approvals') {
          const list = approvals.listPending();
          if (!list.length) push({ token: { text: 'No pending approvals\n' } });
          else list.forEach((p) => push({ token: { text: `${p.id}: ${p.name} ${JSON.stringify(p.args)}\n` } }));
          setValue('');
          return;
        }
        if (parts[0] === '/plan-approve') {
          orchRef.current?.approvePlan?.();
          push({ notification: { level: 'info', message: 'Plan approved' } });
          setValue('');
          return;
        }
        if (parts[0] === '/model' && parts[1]) {
          modelRef.current = parts[1];
          push({ notification: { level: 'info', message: `Model set to ${modelRef.current}` } });
          setValue('');
          return;
        }
        if (parts[0] === '/chat') {
          // Start orchestrator using config-based provider selection
          const store = new ConfigStore();
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
          const openaiKey = openaiApiKey || process.env[openaiEnvName] || process.env.OPENAI_API_KEY;
          const anthropicKey = anthropicApiKey || process.env[anthropicEnvName] || process.env.ANTHROPIC_API_KEY;
          const openrouterKey = openrouterApiKey || process.env[openrouterEnvName] || process.env.OPENROUTER_API_KEY;
          let llm: any;
          let model = openaiModel;
          if ((provider === 'openai' || provider === 'auto') && openaiKey) { llm = new LlmClientOpenAI(openaiKey, openaiBaseUrl); model = openaiModel; }
          else if ((provider === 'anthropic' || provider === 'auto') && anthropicKey) { llm = new LlmClientAnthropic(anthropicKey, anthropicBaseUrl); model = anthropicModel; }
          else if ((provider === 'openrouter' || provider === 'auto') && openrouterKey) { llm = new LlmClientOpenRouter(openrouterKey, openrouterBaseUrl); model = openrouterModel; }
          else { llm = { async *streamChat() { yield { type: 'token', data: 'No LLM configured. Use ccode llm set ...' }; yield { type: 'done' }; } }; }
          const orch = new Orchestrator(llm, approvals);
          orchRef.current = orch;
          chatRef.current = { messages: [], model: modelRef.current || model };
          push({ notification: { level: 'info', message: `Chat started (model=${chatRef.current.model}). Type your message.` } });
          setValue('');
          return;
        }
        // Detect tool syntax vs chat
        const raw = line;
        const isToolSyntax = /:\s*/.test(raw) || /^(bash|fs\.read|fs\.write|edit|multiedit|web\.fetch|notebook\.edit)\b/.test(raw);
        if (!isToolSyntax && orchRef.current && chatRef.current) {
          // Chat message path
          chatRef.current.messages.push({ role: 'user', content: raw });
          let assistantAcc = '';
          const ser = {
            emitToken: (t: string) => { assistantAcc += t; serializer.emitToken(t); },
            emitToolCall: (id: string, name: string, args: unknown) => serializer.emitToken(`\n[tool_call] ${name} ${JSON.stringify(args)}\n`),
            emitToolResult: (id: string, result: any) => {
              if (result.stdout) serializer.emitToken(`\n${result.stdout}`);
              if (result.stderr) serializer.emitToken(`\n${result.stderr}`);
              serializer.emitToken(`\n[tool_result ${id}] exit=${result.exit_code ?? 0}\n`);
            },
            emitHook: (event: string, exitCode: number, io?: { stdout?: string; stderr?: string }) => {
              if (io?.stdout) serializer.emitToken(`\n${io.stdout}`);
              if (io?.stderr) serializer.emitToken(`\n${io.stderr}`);
              serializer.emitToken(`\n[hook ${event}] exit=${exitCode}\n`);
            },
            emitError: (e: any) => serializer.emitToken(`\n[error] ${e?.code ? `${e.code}: ` : ''}${e?.message ?? String(e)}\n`),
            emitDone: () => { serializer.emitToken('\n'); if (assistantAcc.trim().length) chatRef.current!.messages.push({ role: 'assistant', content: assistantAcc }); },
          } as any;
          await orchRef.current.run({ mode: 'default', model: chatRef.current.model, toolManager: engine.getToolManager() as any, permissionResolver: engine.getPermissionResolver() as any, hooks: engine.getHookRunner() as any, serializer: ser, context: { cwd: process.cwd(), env: process.env, permissions: new Set(['*']) } as any, systemPrompt: 'You are a coding assistant.', messages: chatRef.current.messages });
        } else {
          const parsed = parseCommand(line);
          await engine.execute(parsed, { stream: serializer as any });
        }
        setValue('');
      }
      return;
    }
    if (key.backspace || key.delete) { setValue((s) => s.slice(0, -1)); return; }
    if (input) setValue((s) => s + input);
  });

  const s = useMemo(() => stream(), []);

  return (
    <Box flexDirection="column">
      <Conversation stream={s} />
      <Box>
        <Text color="yellow">Pending approvals:</Text>
      </Box>
      <Box flexDirection="column">
        {approvals.listPending().map((p) => (
          <Text key={p.id}>- {p.id}: {p.name} {JSON.stringify(p.args)}</Text>
        ))}
        {approvals.listPending().length === 0 && <Text dimColor>none</Text>}
      </Box>
      <Box>
        <Text color="green">&gt; </Text>
        <Text>{value}</Text>
      </Box>
    </Box>
  );
}