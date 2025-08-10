import { ConfigStore } from '../core/ConfigStore.js';

export async function configureLLM(args: string[]) {
  // usage:
  //   llm set provider <openai|anthropic|auto>
  //   llm set openai.apiKeyEnv <ENV_NAME>
  //   llm set openai.apiKey <KEY>
  //   llm set openai.baseUrl <URL>
  //   llm set openai.model <MODEL>
  //   llm set anthropic.apiKeyEnv <ENV_NAME>
  //   llm set anthropic.apiKey <KEY>
  //   llm set anthropic.baseUrl <URL>
  //   llm set anthropic.model <MODEL>
  //   llm set openrouter.apiKeyEnv <ENV_NAME>
  //   llm set openrouter.apiKey <KEY>
  //   llm set openrouter.baseUrl <URL>
  //   llm set openrouter.model <PROVIDER/MODEL>
  const [action, key, value] = args;
  if (action !== 'set') return { ok: false, stderr: 'usage: llm set <key> <value>' };
  if (!key || value === undefined) return { ok: false, stderr: 'usage: llm set <key> <value>' };
  const path = `llm.${key}`;
  const store = new ConfigStore();
  await store.set('user', path, value);
  return { ok: true, stdout: `set ${path}=${value}\n` };
}

