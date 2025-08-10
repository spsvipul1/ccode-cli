import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { 
  McpTransportFactory, 
  StdioTransport, 
  SseTransport, 
  HttpTransport, 
  WebSocketTransport,
  McpTransportConfig
} from '../src/mcp/McpTransport.js';
import { 
  McpServer, 
  McpServerManager, 
  McpServerConfig 
} from '../src/mcp/McpServerManager.js';
import { 
  EnhancedMcpConfigRepository, 
  EnhancedMcpServerDefinition 
} from '../src/mcp/EnhancedMcpConfig.js';
import { 
  MCP_METHODS, 
  MCP_ERROR_CODES, 
  McpError, 
  createMcpRequest, 
  createMcpResponse, 
  validateMcpMessage 
} from '../src/mcp/McpProtocol.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('ws');
vi.mock('eventsource');
vi.mock('undici');

describe('Enhanced MCP System', () => {
  describe('McpTransportFactory', () => {
    it('should create stdio transport', () => {
      const config: McpTransportConfig = {
        type: 'stdio',
        command: 'node',
        args: ['server.js']
      };
      
      const transport = McpTransportFactory.create(config);
      expect(transport).toBeInstanceOf(StdioTransport);
    });

    it('should create SSE transport', () => {
      const config: McpTransportConfig = {
        type: 'sse',
        url: 'http://localhost:3000/sse'
      };
      
      const transport = McpTransportFactory.create(config);
      expect(transport).toBeInstanceOf(SseTransport);
    });

    it('should create HTTP transport', () => {
      const config: McpTransportConfig = {
        type: 'http',
        url: 'http://localhost:3000'
      };
      
      const transport = McpTransportFactory.create(config);
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should create WebSocket transport', () => {
      const config: McpTransportConfig = {
        type: 'ws-ide',
        url: 'ws://localhost:3000',
        authToken: 'test-token'
      };
      
      const transport = McpTransportFactory.create(config);
      expect(transport).toBeInstanceOf(WebSocketTransport);
    });

    it('should throw for unsupported transport type', () => {
      const config = {
        type: 'invalid'
      } as any;
      
      expect(() => McpTransportFactory.create(config)).toThrow('Unsupported transport type');
    });
  });

  describe('McpProtocol', () => {
    it('should validate valid MCP messages', () => {
      const request = createMcpRequest(1, 'test/method', { param: 'value' });
      expect(validateMcpMessage(request)).toBe(true);
      
      const response = createMcpResponse(1, { result: 'success' });
      expect(validateMcpMessage(response)).toBe(true);
      
      const notification = {
        jsonrpc: '2.0',
        method: 'test/notification',
        params: {}
      };
      expect(validateMcpMessage(notification)).toBe(true);
    });

    it('should reject invalid MCP messages', () => {
      expect(validateMcpMessage(null)).toBe(false);
      expect(validateMcpMessage({})).toBe(false);
      expect(validateMcpMessage({ jsonrpc: '1.0' })).toBe(false);
      expect(validateMcpMessage({ jsonrpc: '2.0' })).toBe(false);
    });

    it('should create proper MCP error', () => {
      const error = new McpError(MCP_ERROR_CODES.METHOD_NOT_FOUND, 'Method not found');
      const errorResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: error.toJsonRpc()
      };
      
      expect(errorResponse.error.code).toBe(MCP_ERROR_CODES.METHOD_NOT_FOUND);
      expect(errorResponse.error.message).toBe('Method not found');
    });
  });

  describe('McpServer', () => {
    let mockTransport: EventEmitter;
    let server: McpServer;

    beforeEach(() => {
      mockTransport = new EventEmitter();
      mockTransport.connect = vi.fn().mockResolvedValue(undefined);
      mockTransport.disconnect = vi.fn().mockResolvedValue(undefined);
      mockTransport.send = vi.fn().mockResolvedValue(undefined);
      mockTransport.isConnected = vi.fn().mockReturnValue(true);

      // Mock the factory to return our mock transport
      vi.spyOn(McpTransportFactory, 'create').mockReturnValue(mockTransport as any);

      const config: McpServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['test.js']
        },
        scope: 'user',
        enabled: true,
        autoReconnect: true,
        timeout: 5000
      };

      server = new McpServer(config);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should connect and initialize', async () => {
      const connectedPromise = new Promise(resolve => server.once('connected', resolve));
      const initializedPromise = new Promise(resolve => server.once('initialized', resolve));

      await server.connect();
      mockTransport.emit('connected');

      await connectedPromise;

      // Simulate initialize response
      const initResponse = createMcpResponse(1, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true }
        },
        serverInfo: {
          name: 'Test Server',
          version: '1.0.0'
        }
      });

      mockTransport.emit('message', initResponse);
      await initializedPromise;

      expect(server.isConnected()).toBe(true);
      expect(server.isInitialized()).toBe(true);
    });

    it('should handle tool calls', async () => {
      // Setup initialized and connected server
      server['state'].initialized = true;
      server['state'].connected = true;
      
      const toolResult = {
        content: [
          { type: 'text', text: 'Tool executed successfully' }
        ]
      };

      const responsePromise = server.callTool('test-tool', { arg: 'value' });
      
      // Simulate tool response with correct ID (first request will be ID 1)
      const toolResponse = createMcpResponse(1, toolResult);
      setTimeout(() => mockTransport.emit('message', toolResponse), 10);

      const result = await responsePromise;
      expect(result).toEqual(toolResult);
    });

    it('should handle notifications', async () => {
      // Setup connected and initialized server
      server['state'].connected = true;
      server['state'].initialized = true;
      
      const notificationPromise = new Promise(resolve => {
        server.once('toolsUpdated', resolve);
      });

      // Simulate tools list changed notification
      const notification = {
        jsonrpc: '2.0',
        method: MCP_METHODS.NOTIFICATION_TOOLS_LIST_CHANGED,
        params: {}
      };

      // First emit the notification
      mockTransport.emit('message', notification);
      
      // Should trigger tools refresh - simulate the response to tools/list (ID will be 1)
      const toolsResponse = createMcpResponse(1, {
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' }
              }
            }
          }
        ]
      });

      setTimeout(() => mockTransport.emit('message', toolsResponse), 10);
      await notificationPromise;
    });

    it('should handle connection errors', async () => {
      const errorPromise = new Promise(resolve => server.once('error', resolve));
      
      const error = new Error('Connection failed');
      mockTransport.emit('error', error);
      
      const receivedError = await errorPromise;
      expect(receivedError).toBe(error);
    });
  });

  describe('McpServerManager', () => {
    let manager: McpServerManager;

    beforeEach(() => {
      manager = new McpServerManager();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should add and manage servers', async () => {
      const config: McpServerConfig = {
        name: 'test-server',
        description: 'Test server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['test.js']
        },
        scope: 'user',
        enabled: false, // Don't auto-connect for test
        autoReconnect: true,
        timeout: 5000
      };

      const server = await manager.addServer(config);
      expect(server).toBeInstanceOf(McpServer);
      expect(manager.getServer('test-server')).toBe(server);
      expect(manager.getServerNames()).toContain('test-server');
    });

    it('should remove servers', async () => {
      const config: McpServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node'
        },
        scope: 'user',
        enabled: false,
        autoReconnect: true,
        timeout: 5000
      };

      await manager.addServer(config);
      expect(manager.getServer('test-server')).toBeDefined();

      const removed = await manager.removeServer('test-server');
      expect(removed).toBe(true);
      expect(manager.getServer('test-server')).toBeUndefined();
    });

    it('should aggregate tools from all servers', async () => {
      // Mock a server with tools
      const mockServer = {
        isInitialized: () => true,
        getState: () => ({
          tools: [
            {
              name: 'test-tool',
              description: 'Test tool',
              inputSchema: { type: 'object', properties: {} }
            }
          ]
        })
      };

      manager['servers'].set('test-server', mockServer as any);

      const allTools = manager.getAllTools();
      expect(allTools).toHaveLength(1);
      expect(allTools[0].serverName).toBe('test-server');
      expect(allTools[0].tool.name).toBe('test-tool');
    });

    it('should get server states', async () => {
      const mockServer = {
        getState: () => ({
          name: 'test-server',
          connected: true,
          initialized: true,
          tools: [],
          resources: [],
          prompts: [],
          messageCount: 5
        })
      };

      manager['servers'].set('test-server', mockServer as any);

      const states = manager.getServerStates();
      expect(states['test-server']).toBeDefined();
      expect(states['test-server'].connected).toBe(true);
      expect(states['test-server'].messageCount).toBe(5);
    });
  });

  describe('EnhancedMcpConfigRepository', () => {
    let repo: EnhancedMcpConfigRepository;

    beforeEach(async () => {
      // Create completely fresh instance for each test
      repo = new EnhancedMcpConfigRepository();
      // Reset state for test isolation
      repo.reset();
      // Mock file operations to return empty configs
      vi.clearAllMocks();
      
      // Mock fs operations to return empty objects for all config files
      const mockFs = await import('node:fs');
      vi.spyOn(mockFs.promises, 'readFile').mockResolvedValue('{}');
      vi.spyOn(mockFs.promises, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(mockFs.promises, 'mkdir').mockResolvedValue(undefined as any);
    });

    it('should validate server definitions', async () => {
      const validDef: EnhancedMcpServerDefinition = {
        name: 'test-server',
        description: 'Test server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        },
        scope: 'user',
        enabled: true,
        autoReconnect: true,
        timeout: 30000
      };

      // Should not throw
      await expect(repo.add('user', validDef)).resolves.toBeUndefined();
    });

    it('should reject invalid server definitions', async () => {
      const invalidDef = {
        name: '',
        transport: {
          type: 'invalid-type'
        }
      } as any;

      await expect(repo.add('user', invalidDef)).rejects.toThrow();
    });

    it('should handle different scopes', async () => {
      const userDef: EnhancedMcpServerDefinition = {
        name: 'user-server',
        transport: { type: 'stdio', command: 'node' },
        scope: 'user',
        enabled: true,
        autoReconnect: true,
        timeout: 30000
      };

      const projectDef: EnhancedMcpServerDefinition = {
        name: 'project-server',
        transport: { type: 'stdio', command: 'node' },
        scope: 'project',
        enabled: true,
        autoReconnect: true,
        timeout: 30000
      };

      await repo.add('user', userDef);
      await repo.add('project', projectDef);

      const userServers = await repo.list('user');
      const projectServers = await repo.list('project');

      expect(userServers).toHaveLength(1);
      expect(projectServers).toHaveLength(1);
      expect(userServers[0].name).toBe('user-server');
      expect(projectServers[0].name).toBe('project-server');
    });

    it('should enable/disable servers', async () => {
      const def: EnhancedMcpServerDefinition = {
        name: 'test-server',
        transport: { type: 'stdio', command: 'node' },
        scope: 'user',
        enabled: true,
        autoReconnect: true,
        timeout: 30000
      };

      await repo.add('user', def);
      
      const disabled = await repo.disable('user', 'test-server');
      expect(disabled).toBe(true);

      const server = await repo.get('user', 'test-server');
      expect(server?.enabled).toBe(false);

      const enabled = await repo.enable('user', 'test-server');
      expect(enabled).toBe(true);

      const enabledServer = await repo.get('user', 'test-server');
      expect(enabledServer?.enabled).toBe(true);
    });

    it('should find servers by name across scopes', async () => {
      const def: EnhancedMcpServerDefinition = {
        name: 'test-server',
        transport: { type: 'stdio', command: 'node' },
        scope: 'project',
        enabled: true,
        autoReconnect: true,
        timeout: 30000
      };

      await repo.add('project', def);

      const found = await repo.getByName('test-server');
      expect(found).toBeDefined();
      expect(found?.server.name).toBe('test-server');
      expect(found?.scope).toBe('project');
    });

    it('should export and import configurations', async () => {
      const def: EnhancedMcpServerDefinition = {
        name: 'test-server',
        transport: { type: 'stdio', command: 'node' },
        scope: 'user',
        enabled: true,
        autoReconnect: true,
        timeout: 30000
      };

      await repo.add('user', def);

      const exported = await repo.export('user');
      expect(exported['test-server']).toBeDefined();

      await repo.clear('user');
      const empty = await repo.list('user');
      expect(empty).toHaveLength(0);

      await repo.import('user', exported);
      const imported = await repo.list('user');
      expect(imported).toHaveLength(1);
      expect(imported[0].name).toBe('test-server');
    });
  });
});

