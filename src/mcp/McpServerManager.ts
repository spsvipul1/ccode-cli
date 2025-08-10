import { EventEmitter } from 'events';
import { McpTransport, McpTransportFactory, McpTransportConfig, McpMessage } from './McpTransport.js';
import { 
  McpTool, 
  McpResource, 
  McpPrompt, 
  McpServerCapabilities,
  McpInitializeParams,
  McpInitializeResult,
  McpToolCallParams,
  McpToolCallResult,
  McpResourceReadParams,
  McpResourceReadResult,
  McpPromptGetParams,
  McpPromptGetResult,
  McpListToolsResult,
  McpListResourcesResult,
  McpListPromptsResult,
  MCP_METHODS,
  MCP_ERROR_CODES,
  McpError,
  createMcpRequest,
  createMcpResponse,
  createMcpError
} from './McpProtocol.js';

export interface McpServerConfig {
  name: string;
  description?: string;
  transport: McpTransportConfig;
  scope: 'user' | 'project' | 'local';
  enabled: boolean;
  autoReconnect: boolean;
  timeout: number;
  oauth?: {
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
  };
}

export interface McpServerState {
  name: string;
  connected: boolean;
  initialized: boolean;
  capabilities?: McpServerCapabilities;
  serverInfo?: {
    name: string;
    version: string;
  };
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
  lastError?: string;
  connectionTime?: Date;
  messageCount: number;
}

export class McpServer extends EventEmitter {
  private config: McpServerConfig;
  private transport: McpTransport;
  private state: McpServerState;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: McpServerConfig) {
    super();
    this.config = config;
    this.transport = McpTransportFactory.create(config.transport);
    this.state = {
      name: config.name,
      connected: false,
      initialized: false,
      tools: [],
      resources: [],
      prompts: [],
      messageCount: 0
    };

    this.setupTransportListeners();
  }

  private setupTransportListeners(): void {
    this.transport.on('connected', () => {
      this.state.connected = true;
      this.state.connectionTime = new Date();
      this.emit('connected');
      this.initialize();
    });

    this.transport.on('disconnected', () => {
      this.state.connected = false;
      this.state.initialized = false;
      this.clearPendingRequests();
      this.emit('disconnected');
    });

    this.transport.on('message', (message: McpMessage) => {
      this.handleMessage(message);
    });

    this.transport.on('error', (error: Error) => {
      this.state.lastError = error.message;
      this.emit('error', error);
    });
  }

  private handleMessage(message: McpMessage): void {
    this.state.messageCount++;

    // Handle responses to our requests
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      clearTimeout(pending.timeout);

      if (message.error) {
        pending.reject(new McpError(message.error.code, message.error.message, message.error.data));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    // Handle notifications from server
    if (message.method && message.id === undefined) {
      this.handleNotification(message);
      return;
    }

    // Handle requests from server (rare, but possible)
    if (message.method && message.id !== undefined) {
      this.handleRequest(message);
      return;
    }
  }

  private handleNotification(message: McpMessage): void {
    switch (message.method) {
      case MCP_METHODS.NOTIFICATION_TOOLS_LIST_CHANGED:
        this.refreshTools();
        break;
      case MCP_METHODS.NOTIFICATION_RESOURCES_LIST_CHANGED:
        this.refreshResources();
        break;
      case MCP_METHODS.NOTIFICATION_PROMPTS_LIST_CHANGED:
        this.refreshPrompts();
        break;
      case MCP_METHODS.NOTIFICATION_RESOURCES_UPDATED:
        this.emit('resourceUpdated', message.params);
        break;
      default:
        this.emit('notification', message);
    }
  }

  private async handleRequest(message: McpMessage): Promise<void> {
    // Most MCP servers don't send requests to clients, but we should handle them
    try {
      let result: any;

      switch (message.method) {
        case MCP_METHODS.LOGGING_SET_LEVEL:
          // Handle logging level changes
          result = {};
          break;
        default:
          throw new McpError(MCP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${message.method}`);
      }

      const response = createMcpResponse(message.id!, result);
      await this.transport.send(response);
    } catch (error) {
      const mcpError = error instanceof McpError ? error : new McpError(MCP_ERROR_CODES.INTERNAL_ERROR, (error as Error).message || String(error));
      const response = createMcpError(message.id!, mcpError);
      await this.transport.send(response);
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.state.connected) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    const request = createMcpRequest(id, method, params);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.transport.send(request).catch(reject);
    });
  }

  private clearPendingRequests(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection lost'));
    }
    this.pendingRequests.clear();
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async disconnect(): Promise<void> {
    this.clearPendingRequests();
    await this.transport.disconnect();
  }

  private async initialize(): Promise<void> {
    try {
      const params: McpInitializeParams = {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        },
        clientInfo: {
          name: 'Claude Code CLI',
          version: '1.0.0'
        }
      };

      const result: McpInitializeResult = await this.sendRequest(MCP_METHODS.INITIALIZE, params);
      
      this.state.capabilities = result.capabilities;
      this.state.serverInfo = result.serverInfo;
      
      // Send initialized notification
      await this.transport.send({
        jsonrpc: '2.0',
        method: MCP_METHODS.INITIALIZED,
        params: {}
      });

      this.state.initialized = true;
      this.emit('initialized');

      // Load available tools, resources, and prompts
      await Promise.all([
        this.refreshTools(),
        this.refreshResources(),
        this.refreshPrompts()
      ]);
      
    } catch (error) {
      this.state.lastError = (error as Error).message || String(error);
      this.emit('error', error);
    }
  }

  async refreshTools(): Promise<void> {
    if (!this.state.initialized) return;

    try {
      const result: McpListToolsResult = await this.sendRequest(MCP_METHODS.TOOLS_LIST);
      this.state.tools = result.tools;
      this.emit('toolsUpdated', this.state.tools);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async refreshResources(): Promise<void> {
    if (!this.state.initialized) return;

    try {
      const result: McpListResourcesResult = await this.sendRequest(MCP_METHODS.RESOURCES_LIST);
      this.state.resources = result.resources;
      this.emit('resourcesUpdated', this.state.resources);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async refreshPrompts(): Promise<void> {
    if (!this.state.initialized) return;

    try {
      const result: McpListPromptsResult = await this.sendRequest(MCP_METHODS.PROMPTS_LIST);
      this.state.prompts = result.prompts;
      this.emit('promptsUpdated', this.state.prompts);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async callTool(name: string, args?: Record<string, any>): Promise<McpToolCallResult> {
    if (!this.state.initialized) {
      throw new Error('Server not initialized');
    }

    const params: McpToolCallParams = {
      name,
      arguments: args
    };

    return await this.sendRequest(MCP_METHODS.TOOLS_CALL, params);
  }

  async readResource(uri: string): Promise<McpResourceReadResult> {
    if (!this.state.initialized) {
      throw new Error('Server not initialized');
    }

    const params: McpResourceReadParams = { uri };
    return await this.sendRequest(MCP_METHODS.RESOURCES_READ, params);
  }

  async getPrompt(name: string, args?: Record<string, any>): Promise<McpPromptGetResult> {
    if (!this.state.initialized) {
      throw new Error('Server not initialized');
    }

    const params: McpPromptGetParams = {
      name,
      arguments: args
    };

    return await this.sendRequest(MCP_METHODS.PROMPTS_GET, params);
  }

  getState(): McpServerState {
    return { ...this.state };
  }

  getConfig(): McpServerConfig {
    return { ...this.config };
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  isInitialized(): boolean {
    return this.state.initialized;
  }
}

export class McpServerManager extends EventEmitter {
  private servers = new Map<string, McpServer>();
  private configs = new Map<string, McpServerConfig>();

  async addServer(config: McpServerConfig): Promise<McpServer> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server already exists: ${config.name}`);
    }

    this.configs.set(config.name, config);
    const server = new McpServer(config);

    // Forward server events
    server.on('connected', () => this.emit('serverConnected', config.name));
    server.on('disconnected', () => this.emit('serverDisconnected', config.name));
    server.on('initialized', () => this.emit('serverInitialized', config.name));
    server.on('error', (error) => this.emit('serverError', config.name, error));
    server.on('toolsUpdated', (tools) => this.emit('serverToolsUpdated', config.name, tools));
    server.on('resourcesUpdated', (resources) => this.emit('serverResourcesUpdated', config.name, resources));
    server.on('promptsUpdated', (prompts) => this.emit('serverPromptsUpdated', config.name, prompts));

    this.servers.set(config.name, server);

    // Auto-connect if enabled
    if (config.enabled) {
      try {
        await server.connect();
      } catch (error) {
        this.emit('serverError', config.name, error);
      }
    }

    return server;
  }

  async removeServer(name: string): Promise<boolean> {
    const server = this.servers.get(name);
    if (!server) {
      return false;
    }

    await server.disconnect();
    this.servers.delete(name);
    this.configs.delete(name);
    
    this.emit('serverRemoved', name);
    return true;
  }

  getServer(name: string): McpServer | undefined {
    return this.servers.get(name);
  }

  getAllServers(): McpServer[] {
    return Array.from(this.servers.values());
  }

  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  getConnectedServers(): McpServer[] {
    return this.getAllServers().filter(server => server.isConnected());
  }

  getAllTools(): Array<{ serverName: string; tool: McpTool }> {
    const tools: Array<{ serverName: string; tool: McpTool }> = [];
    
    for (const [name, server] of this.servers) {
      if (server.isInitialized()) {
        const state = server.getState();
        state.tools.forEach(tool => {
          tools.push({ serverName: name, tool });
        });
      }
    }
    
    return tools;
  }

  getAllResources(): Array<{ serverName: string; resource: McpResource }> {
    const resources: Array<{ serverName: string; resource: McpResource }> = [];
    
    for (const [name, server] of this.servers) {
      if (server.isInitialized()) {
        const state = server.getState();
        state.resources.forEach(resource => {
          resources.push({ serverName: name, resource });
        });
      }
    }
    
    return resources;
  }

  getAllPrompts(): Array<{ serverName: string; prompt: McpPrompt }> {
    const prompts: Array<{ serverName: string; prompt: McpPrompt }> = [];
    
    for (const [name, server] of this.servers) {
      if (server.isInitialized()) {
        const state = server.getState();
        state.prompts.forEach(prompt => {
          prompts.push({ serverName: name, prompt });
        });
      }
    }
    
    return prompts;
  }

  async connectAll(): Promise<void> {
    const promises = Array.from(this.servers.values())
      .filter(server => server.getConfig().enabled)
      .map(server => server.connect().catch(error => 
        this.emit('serverError', server.getConfig().name, error)
      ));
    
    await Promise.all(promises);
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.servers.values())
      .map(server => server.disconnect());
    
    await Promise.all(promises);
  }

  getServerStates(): Record<string, McpServerState> {
    const states: Record<string, McpServerState> = {};
    
    for (const [name, server] of this.servers) {
      states[name] = server.getState();
    }
    
    return states;
  }
}