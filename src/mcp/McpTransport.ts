import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';
import EventSource from 'eventsource';
import { fetch } from 'undici';

export interface McpTransportConfig {
  type: 'stdio' | 'sse' | 'http' | 'sse-ide' | 'ws-ide';
  
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  
  // For HTTP/SSE transports
  url?: string;
  headers?: Record<string, string>;
  
  // For IDE transports
  ideName?: string;
  ideRunningInWindows?: boolean;
  authToken?: string;
}

export interface McpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export abstract class McpTransport extends EventEmitter {
  protected config: McpTransportConfig;
  protected connected = false;
  protected reconnectAttempts = 0;
  protected maxReconnectAttempts = 5;
  protected reconnectDelay = 1000;

  constructor(config: McpTransportConfig) {
    super();
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(message: McpMessage): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  protected async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0;
      } catch (error) {
        await this.attemptReconnect();
      }
    }, delay);
  }

  protected handleMessage(data: string): void {
    try {
      const message: McpMessage = JSON.parse(data);
      this.emit('message', message);
    } catch (error) {
      this.emit('error', new Error(`Invalid JSON: ${data}`));
    }
  }

  protected handleError(error: Error): void {
    this.connected = false;
    this.emit('error', error);
    
    // Attempt reconnection for certain error types
    if (this.shouldReconnect(error)) {
      this.attemptReconnect();
    }
  }

  protected shouldReconnect(error: Error): boolean {
    // Don't reconnect for authentication errors or intentional disconnections
    const message = error.message.toLowerCase();
    return !message.includes('auth') && !message.includes('unauthorized') && !message.includes('forbidden');
  }
}

export class StdioTransport extends McpTransport {
  private process?: ChildProcess;

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env }
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => this.handleMessage(line));
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('error', new Error(`Process stderr: ${data.toString()}`));
    });

    this.process.on('error', (error) => {
      this.handleError(error);
    });

    this.process.on('exit', (code, signal) => {
      this.connected = false;
      if (code !== 0) {
        this.handleError(new Error(`Process exited with code ${code}, signal ${signal}`));
      }
    });

    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.connected = false;
    this.emit('disconnected');
  }

  async send(message: McpMessage): Promise<void> {
    if (!this.connected || !this.process?.stdin) {
      throw new Error('Not connected');
    }

    const data = JSON.stringify(message) + '\n';
    this.process.stdin.write(data);
  }
}

export class SseTransport extends McpTransport {
  private eventSource?: EventSource;

  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required for SSE transport');
    }

    this.eventSource = new EventSource(this.config.url, {
      headers: this.config.headers || {}
    });

    this.eventSource.onopen = () => {
      this.connected = true;
      this.emit('connected');
    };

    this.eventSource.onmessage = (event: any) => {
      this.handleMessage(event.data);
    };

    this.eventSource.onerror = (error: any) => {
      this.handleError(new Error('SSE connection error'));
    };
  }

  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    this.connected = false;
    this.emit('disconnected');
  }

  async send(message: McpMessage): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required');
    }

    // For SSE, we typically send via HTTP POST
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
}

export class HttpTransport extends McpTransport {
  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required for HTTP transport');
    }

    // Test connection with a ping
    try {
      const response = await fetch(this.config.url + '/ping', {
        method: 'GET',
        headers: this.config.headers || {}
      });

      if (response.ok) {
        this.connected = true;
        this.emit('connected');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  async send(message: McpMessage): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required');
    }

    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    this.handleMessage(JSON.stringify(responseData));
  }
}

export class WebSocketTransport extends McpTransport {
  private ws?: WebSocket;

  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required for WebSocket transport');
    }

    const headers: Record<string, string> = { ...this.config.headers };
    
    // Add auth token if provided (for IDE transport)
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    this.ws = new WebSocket(this.config.url, { headers });

    this.ws.on('open', () => {
      this.connected = true;
      this.emit('connected');
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('error', (error) => {
      this.handleError(error);
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      if (code !== 1000) {
        this.handleError(new Error(`WebSocket closed with code ${code}: ${reason}`));
      } else {
        this.emit('disconnected');
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.connected = false;
    this.emit('disconnected');
  }

  async send(message: McpMessage): Promise<void> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected');
    }

    this.ws.send(JSON.stringify(message));
  }
}

export class McpTransportFactory {
  static create(config: McpTransportConfig): McpTransport {
    switch (config.type) {
      case 'stdio':
        return new StdioTransport(config);
      case 'sse':
      case 'sse-ide':
        return new SseTransport(config);
      case 'http':
        return new HttpTransport(config);
      case 'ws-ide':
        return new WebSocketTransport(config);
      default:
        throw new Error(`Unsupported transport type: ${config.type}`);
    }
  }
}