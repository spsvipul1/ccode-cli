export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

export interface McpClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: {};
}

export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: McpClientCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

// Standard MCP methods
export const MCP_METHODS = {
  // Initialization
  INITIALIZE: 'initialize',
  INITIALIZED: 'initialized',
  
  // Tools
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  
  // Resources
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',
  
  // Prompts
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  
  // Logging
  LOGGING_SET_LEVEL: 'logging/setLevel',
  
  // Notifications
  NOTIFICATION_CANCELLED: 'notifications/cancelled',
  NOTIFICATION_PROGRESS: 'notifications/progress',
  NOTIFICATION_INITIALIZED: 'notifications/initialized',
  NOTIFICATION_ROOTS_LIST_CHANGED: 'notifications/roots/list_changed',
  NOTIFICATION_TOOLS_LIST_CHANGED: 'notifications/tools/list_changed',
  NOTIFICATION_RESOURCES_LIST_CHANGED: 'notifications/resources/list_changed',
  NOTIFICATION_RESOURCES_UPDATED: 'notifications/resources/updated',
  NOTIFICATION_PROMPTS_LIST_CHANGED: 'notifications/prompts/list_changed'
} as const;

export type McpMethod = typeof MCP_METHODS[keyof typeof MCP_METHODS];

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, any>;
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface McpResourceReadParams {
  uri: string;
}

export interface McpResourceReadResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface McpPromptGetParams {
  name: string;
  arguments?: Record<string, any>;
}

export interface McpPromptGetResult {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
    };
  }>;
}

export interface McpListToolsResult {
  tools: McpTool[];
}

export interface McpListResourcesResult {
  resources: McpResource[];
}

export interface McpListPromptsResult {
  prompts: McpPrompt[];
}

export interface McpProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
}

export interface McpLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  data: any;
  logger?: string;
}

// Error codes as defined in MCP specification
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP-specific error codes
  INVALID_TOOL: -32000,
  TOOL_EXECUTION_ERROR: -32001,
  RESOURCE_NOT_FOUND: -32002,
  RESOURCE_ACCESS_DENIED: -32003,
  PROMPT_NOT_FOUND: -32004,
  CANCELLED: -32800
} as const;

export class McpError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'McpError';
  }

  toJsonRpc() {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
}

export function validateMcpMessage(message: any): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  // Must have jsonrpc field
  if (message.jsonrpc !== '2.0') {
    return false;
  }

  // Must be either a request, response, or notification
  const isRequest = message.method && (message.id !== undefined);
  const isNotification = message.method && (message.id === undefined);
  const isResponse = !message.method && (message.id !== undefined) && (message.result !== undefined || message.error !== undefined);

  return isRequest || isNotification || isResponse;
}

export function createMcpRequest(id: string | number, method: string, params?: any) {
  return {
    jsonrpc: '2.0' as const,
    id,
    method,
    params
  };
}

export function createMcpResponse(id: string | number, result: any) {
  return {
    jsonrpc: '2.0' as const,
    id,
    result
  };
}

export function createMcpError(id: string | number, error: McpError) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: error.toJsonRpc()
  };
}

export function createMcpNotification(method: string, params?: any) {
  return {
    jsonrpc: '2.0' as const,
    method,
    params
  };
}