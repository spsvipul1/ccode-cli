# LLM Configuration Example

## Quick Setup

### For OpenAI
```bash
# Set your API key in environment
export OPENAI_API_KEY="sk-..."

# Configure the CLI to use OpenAI
ccode llm set provider openai
ccode llm set openai.model gpt-4o

# Start coding assistant
ccode chat
```

### For Anthropic
```bash
# Set your API key in environment
export ANTHROPIC_API_KEY="sk-ant-..."

# Configure the CLI to use Anthropic
ccode llm set provider anthropic
ccode llm set anthropic.model claude-3-5-sonnet-2024-06-20

# Start coding assistant
ccode chat
```

### Custom Environment Variable Names
```bash
# Use custom env var names
ccode llm set openai.apiKeyEnv MY_OPENAI_KEY
ccode llm set anthropic.apiKeyEnv MY_ANTHROPIC_KEY

export MY_OPENAI_KEY="sk-..."
export MY_ANTHROPIC_KEY="sk-ant-..."
```

## Available Models

### OpenAI Models
- `gpt-4o` - Latest GPT-4 Omni model
- `gpt-4o-mini` - Faster, cheaper GPT-4 variant
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - GPT-3.5 Turbo

### Anthropic Models
- `claude-3-5-sonnet-2024-06-20` - Latest Claude 3.5 Sonnet
- `claude-3-opus-20240229` - Most capable Claude 3 model
- `claude-3-sonnet-20240229` - Balanced Claude 3 model
- `claude-3-haiku-20240307` - Fast Claude 3 model

## Interactive Commands

Once in `ccode chat`, you can use:

- `/approve <id>` - Approve a pending tool call
- `/approve --all` - Approve all pending tool calls
- `/approvals` - List pending approvals
- `/plan-approve` - Approve plan mode (when using `--mode plan`)

## Plan Mode

Use plan mode to have the AI propose changes without executing them:

```bash
ccode chat --mode plan
```

The AI will propose tool calls but won't execute write/edit operations until you approve the plan with `/plan-approve`.