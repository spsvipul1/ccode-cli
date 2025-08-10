export interface ConfigManager {
  loadGlobalConfig(): Promise<unknown>
  loadUserConfig(): Promise<unknown>
  loadProjectConfig(cwd: string): Promise<unknown>
  merge(configs: { defaults: unknown; user?: unknown; project?: unknown; cli?: unknown }): Promise<unknown>
  validate(config: unknown): { valid: boolean; errors?: string[] }
}

export interface PermissionResolver {
  resolve(input: {
    defaults?: { allow?: string[]; deny?: string[]; defaultMode?: 'prompt'|'allow'|'deny' }
    user?: { allow?: string[]; deny?: string[]; defaultMode?: 'prompt'|'allow'|'deny' }
    project?: { allow?: string[]; deny?: string[]; defaultMode?: 'prompt'|'allow'|'deny' }
    cli?: { allow?: string[]; deny?: string[]; bypassPermissions?: boolean }
    toolUniverse: string[]
  }): {
    allowedTools: string[]
    promptsRequired: string[]
    reasons: Record<string, { source: 'cli'|'project'|'user'|'defaults'|'prompt'; pattern: string; precedence: number; decision: 'allow'|'deny'|'prompt' }>
  }
}

export class HookRegistry {
  register(event: string, handler: (payload: unknown) => Promise<{ exitCode: number; stdout?: string; stderr?: string }>, matcher?: Record<string, unknown>): void {}
}
export interface HookRunner {
  run(event: string, payload: unknown): Promise<{ exitCode: number; stdout?: string; stderr?: string }>
}

export interface ToolResult {
  ok: boolean
  stdout?: string
  stderr?: string
  exitCode?: number
  signal?: string
  timedOut?: boolean
}

export interface ExecutionContext {
  cwd: string
  env: NodeJS.ProcessEnv
  permissions: Set<string>
  onNotification?: (n: { level: 'info'|'warn'|'error'; message: string }) => void
  sandboxPreferred?: boolean
  backgroundOutputCaps?: { maxBytes?: number; maxLines?: number }
}

export interface Tool {
  name: string
  validate?(args: unknown): { valid: boolean; errors?: string[] }
  execute(args: unknown, context: ExecutionContext): Promise<ToolResult>
}

export interface ToolManager {
  registerTool(tool: Tool): Promise<void>
  unregisterTool(name: string): Promise<void>
  listTools(): Tool[]
  getTool(name: string): Tool | null
  executeTool(name: string, args: unknown, context: ExecutionContext): Promise<ToolResult>
}

export interface SandboxProfileManager {
  run(command: string, args: string[], options: { sandboxPreferred?: boolean; cwd?: string; env?: NodeJS.ProcessEnv; background?: boolean }): Promise<{ ok: boolean; stdout?: string; stderr?: string; exitCode?: number; signal?: string; timedOut?: boolean; truncated?: boolean }>
}

export interface TelemetryExporter {
  start(): Promise<void>
  emit(metric: { name: string; value: number; labels?: Record<string,string> }): void
  flush(): Promise<void>
  shutdown(): Promise<void>
}

export interface MCPServerDefinition {
  name: string
  command: string
  args?: string[]
  env?: Record<string,string>
  cwd?: string
  transport?: 'stdio'|'tcp'|'unix'
  host?: string
  port?: number
  path?: string
  enabled?: boolean
  scope?: 'user'|'project'
}

export interface MCPClient {
  connect(def: MCPServerDefinition): Promise<void>
  listTools(): Promise<string[]>
  invoke(tool: string, args: unknown): Promise<unknown>
  disconnect(): Promise<void>
}

export interface MCPServer {
  start(def: MCPServerDefinition): Promise<void>
  stop(name: string): Promise<void>
  status(name: string): Promise<'starting'|'running'|'stopped'|'error'>
}

export type OrchestratorMode = 'default'|'plan'|'acceptEdits'|'bypassPermissions'

export type FunctionToolDef = { internalName: string; apiName: string; description?: string; parameters: any };

export interface LlmClient {
  streamChat(opts: { system: string; messages: Array<{role:'user'|'assistant'|'tool'; content: string|unknown; tool_call_id?: string }>; model: string; maxTokens?: number; functionTools?: FunctionToolDef[]; }): AsyncIterable<{ type: 'token'|'tool_call'|'done'|'error'; data?: any }>
}

export interface Orchestrator {
  run(options: {
    mode: OrchestratorMode
    model: string
    toolManager: ToolManager
    permissionResolver: PermissionResolver
    hooks: HookRunner
    serializer: { emitToken(text: string, isFinal?: boolean): void; emitToolCall(id: string, name: string, args: unknown): void; emitToolResult(id: string, result: { ok: boolean; stdout?: string; stderr?: string; exit_code?: number }): void; emitHook(event: string, exitCode: number, io?: { stdout?: string; stderr?: string }): void; emitError(err: { message: string; code?: string; details?: unknown }): void; emitDone(): void; emitNotification?(level: 'info'|'warn'|'error', message: string): void }
    context: ExecutionContext
    llm: LlmClient
    systemPrompt?: string
    messages?: Array<{role:'user'|'assistant'|'tool'; content: string|unknown; tool_call_id?: string }>
    maxRounds?: number
  }): Promise<void>
  approvePlan?(): void
}