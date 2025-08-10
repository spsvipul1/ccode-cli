export const DEFAULT_CONFIG = {
  llm: {
    provider: 'auto', // 'openai' | 'anthropic' | 'auto'
    openai: { apiKeyEnv: 'OPENAI_API_KEY', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY', model: 'claude-3-5-sonnet-2024-06-20', baseUrl: 'https://api.anthropic.com/v1/messages' },
    openrouter: { apiKeyEnv: 'OPENROUTER_API_KEY', model: 'openai/gpt-4o-mini', baseUrl: 'https://openrouter.ai/api/v1' }
  }
};

