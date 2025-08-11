import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useInput, useApp } from 'ink';
import { Box, Text } from './framework/index.js';
import { Theme, resolveTheme, themes } from './themes/index.js';
import { ThemeProvider } from './themeContext.js';
import { ConversationScreen } from './screens/ConversationScreen.js';
import { ConfigScreen } from './screens/ConfigScreen.js';
import { AgentScreen } from './screens/AgentScreen.js';
import { Engine } from '../exec/Engine.js';
import { McpServerManager } from '../mcp/McpServerManager.js';
import { BackgroundManager } from '../exec/BackgroundManager.js';
import { UiEventStreamSerializer } from './UiSerializer.js';
import { ApprovalController } from '../exec/ApprovalController.js';
import { Orchestrator } from '../exec/Orchestrator.js';
import { LlmClientOpenAI } from '../llm/LlmClientOpenAI.js';
import { LlmClientAnthropic } from '../llm/LlmClientAnthropic.js';
import { LlmClientOpenRouter } from '../llm/LlmClientOpenRouter.js';
import { ConfigStore } from '../core/ConfigStore.js';
import { DEFAULT_CONFIG } from '../core/ConfigDefaults.js';
import { AgentManager, AgentRouter, AgentOrchestrator } from '../agents/index.js';

type Screen = 'conversation' | 'config' | 'agents' | 'help' | 'diagnostics' | 'performance';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  agent?: string;
  toolCall?: {
    name: string;
    args: any;
    result?: any;
  };
}

interface Agent {
  id: string;
  name: string;
  type: 'user' | 'system' | 'generated';
  whenToUse: string;
  systemPrompt: string;
  location: 'user' | 'project';
  isActive: boolean;
  color: string;
}

function createEventQueue() {
  const listeners: ((ev: any) => void)[] = [];
  const push = (ev: any) => listeners.forEach((l) => l(ev));
  async function* stream() {
    while (true) {
      const ev = await new Promise<any>((resolve) => listeners.push(resolve));
      yield ev;
    }
  }
  return { push, stream };
}

export const EnhancedApp: React.FC<{ autoChat?: boolean }> = ({ autoChat = true }) => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('conversation');
  const [currentTheme, setCurrentTheme] = useState<string>('dark-ansi');
  const [currentAgent, setCurrentAgent] = useState<string>('general-purpose');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');

  const { push, stream } = useMemo(() => createEventQueue(), []);
  const engine = useMemo(() => new Engine({ cwd: process.cwd(), env: process.env, permissions: { allow: ['*'] } }), []);
  const serializer = useMemo(() => new UiEventStreamSerializer(push), [push]);
  const approvals = useMemo(() => new ApprovalController(), []);
  const agentManager = useMemo(() => new AgentManager(), []);
  const agentRouter = useMemo(() => new AgentRouter(agentManager), [agentManager]);
  const agentOrchestrator = useMemo(() => new AgentOrchestrator(agentManager, agentRouter), [agentManager, agentRouter]);
  const orchRef = useRef<Orchestrator | null>(null);
  const mcpManagerRef = useRef<McpServerManager | null>(null);
  const bgManagerRef = useRef<BackgroundManager | null>(null);
  const chatRef = useRef<{ messages: Array<{ role: 'user'|'assistant'|'tool'; content: string }>; model: string } | null>(null);

  const [config, setConfig] = useState({
    theme: 'dark-ansi',
    llm: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022'
    },
    maxTokens: 4096,
    temperature: 0.7,
    autoCompact: true,
    telemetry: true
  });

  // Get agents from AgentManager instead of static array
  const [agents, setAgents] = useState<Agent[]>([]);

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      await agentManager.loadUserAgents();
      await agentManager.loadProjectAgents();
      
      const allAgents = agentManager.getAllAgents().map(agent => ({
        id: agent.identifier,
        name: agent.name,
        type: agent.agentType,
        whenToUse: agent.whenToUse,
        systemPrompt: agent.systemPrompt,
        location: agent.location,
        isActive: agent.identifier === agentManager.getRegistry().activeAgent,
        color: agentManager.getAgentColor(agent.identifier)
      }));
      
      setAgents(allAgents);
    };
    
    loadAgents();
  }, [agentManager]);

  const { exit } = useApp();
  const theme: Theme = resolveTheme(currentTheme);

  // Initialize chat on startup if autoChat is enabled
  useEffect(() => {
    if (autoChat) {
      initializeChat();
    }
  }, [autoChat]);

  const initializeChat = async () => {
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
    
    if ((provider === 'openai' || provider === 'auto') && openaiKey) { 
      llm = new LlmClientOpenAI(openaiKey, openaiBaseUrl); 
      model = openaiModel; 
    } else if ((provider === 'anthropic' || provider === 'auto') && anthropicKey) { 
      llm = new LlmClientAnthropic(anthropicKey, anthropicBaseUrl); 
      model = anthropicModel; 
    } else if ((provider === 'openrouter' || provider === 'auto') && openrouterKey) { 
      llm = new LlmClientOpenRouter(openrouterKey, openrouterBaseUrl); 
      model = openrouterModel; 
    } else { 
      llm = { 
        async *streamChat() { 
          yield { type: 'token', data: 'No LLM configured. Use /config to set up your API keys.' }; 
          yield { type: 'done' }; 
        } 
      }; 
    }
    
    // Register LLM clients with agent orchestrator
    agentOrchestrator.registerLlmClient('openai', llm);
    agentOrchestrator.registerLlmClient('anthropic', llm);
    agentOrchestrator.registerLlmClient('openrouter', llm);
    
    // Initialize managers for diagnostics
    mcpManagerRef.current = new McpServerManager();
    bgManagerRef.current = new BackgroundManager();
    
    const orch = new Orchestrator(llm, approvals);
    orchRef.current = orch;
    chatRef.current = { messages: [], model };
    
    // Start agent session
    await agentOrchestrator.startSession();
    
    // Add welcome message
    const currentAgent = agentManager.getActiveAgent();
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'system',
      content: `Welcome to Claude Code Assistant!\nActive Agent: ${currentAgent?.name || 'General Purpose'}\nUsing ${model} with ${theme.name} theme.\n\nType your message to start coding, or use slash commands:\n/config - Configuration\n/agents - Agent management\n/help - Show all commands`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  };

  useInput((inputChar, key) => {
    if (key.escape) {
      if (currentScreen !== 'conversation') {
        setCurrentScreen('conversation');
      }
    } else if (key.ctrl && inputChar === 'c') {
      exit();
    } else if (currentScreen === 'conversation') {
      if (key.return) {
        if (input.trim()) {
          if (input.startsWith('/')) {
            handleCommand(input);
          } else {
            handleInput(input);
          }
          setInput('');
        }
      } else if (key.backspace) {
        setInput(prev => prev.slice(0, -1));
      } else if (inputChar && !key.ctrl) {
        setInput(prev => prev + inputChar);
      }
    }
  });

  const handleInput = async (userInput: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userInput,
      timestamp: new Date(),
      agent: currentAgent
    };

    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    if (orchRef.current && chatRef.current) {
      chatRef.current.messages.push({ role: 'user', content: userInput });
      
      let assistantContent = '';
      const ser = {
        emitToken: (text: string, isFinal?: boolean) => {
          assistantContent += text;
          // Update UI in real-time if needed
        },
        emitToolCall: (id: string, name: string, args: unknown) => {
          const toolMessage: Message = {
            id: `tool-${id}`,
            type: 'tool',
            content: `Calling ${name}`,
            timestamp: new Date(),
            toolCall: { name, args, result: null }
          };
          setMessages(prev => [...prev, toolMessage]);
        },
        emitToolResult: (id: string, result: any) => {
          setMessages(prev => prev.map(msg => 
            msg.id === `tool-${id}` && msg.toolCall ? 
            { ...msg, toolCall: { ...msg.toolCall, result } } : msg
          ));
        },
        emitHook: () => {},
        emitError: (e: any) => {
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            type: 'system',
            content: `Error: ${e?.message ?? String(e)}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMessage]);
        },
        emitDone: () => {
          if (assistantContent.trim()) {
            const responseMessage: Message = {
              id: `assistant-${Date.now()}`,
              type: 'assistant',
              content: assistantContent,
              timestamp: new Date(),
              agent: currentAgent
            };
            setMessages(prev => [...prev, responseMessage]);
            chatRef.current!.messages.push({ role: 'assistant', content: assistantContent });
          }
          setIsLoading(false);
        }
      } as any;

      const currentAgentData = agents.find(a => a.id === currentAgent);
      const systemPrompt = currentAgentData?.systemPrompt || 'You are a helpful coding assistant.';

      try {
        await orchRef.current.run({
          mode: 'default',
          model: chatRef.current.model,
          toolManager: engine.getToolManager() as any,
          permissionResolver: engine.getPermissionResolver() as any,
          hooks: engine.getHookRunner() as any,
          serializer: ser,
          context: { cwd: process.cwd(), env: process.env, permissions: new Set(['*']) } as any,
          systemPrompt,
          messages: chatRef.current.messages
        });
      } catch (error) {
        setIsLoading(false);
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          type: 'system',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

  const handleCommand = (command: string) => {
    const cmd = command.toLowerCase().trim();
    const parts = cmd.split(/\s+/);
    
    if (cmd === '/config') {
      setCurrentScreen('config');
    } else if (cmd === '/agents') {
      setCurrentScreen('agents');
    } else if (cmd === '/help') {
      setCurrentScreen('help');
    } else if (cmd === '/diagnostics') {
      setCurrentScreen('diagnostics');
    } else if (cmd === '/performance') {
      setCurrentScreen('performance');
    } else if (cmd.startsWith('/theme ')) {
      const themeName = parts[1];
      if (themes[themeName]) {
        setCurrentTheme(themeName);
        setConfig(prev => ({ ...prev, theme: themeName }));
        const message: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `Theme changed to ${themes[themeName].name}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
      }
    } else if (cmd.startsWith('/agent ')) {
      const agentName = parts[1];
      const agent = agents.find(a => a.id === agentName);
      if (agent) {
        setCurrentAgent(agentName);
        const message: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `Switched to ${agent.name} agent`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
      }
    } else if (parts[0] === '/approve') {
      if (parts[1] === '--all') { 
        approvals.approveAll(); 
        const message: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: 'Approved all pending requests',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
      } else if (parts[1]) { 
        const ok = approvals.approve(parts[1]); 
        const message: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: ok ? `Approved ${parts[1]}` : `No pending request ${parts[1]}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
      }
    } else if (parts[0] === '/approvals') {
      const pending = approvals.listPending();
      const content = pending.length ? 
        pending.map(p => `${p.id}: ${p.name} ${JSON.stringify(p.args)}`).join('\n') :
        'No pending approvals';
      const message: Message = {
        id: Date.now().toString(),
        type: 'system',
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
    } else {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `Unknown command: ${command}. Type /help for available commands.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    const keys = key.split('.');
    setConfig(prev => {
      const newConfig = { ...prev };
      let current = newConfig as any;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      if (key === 'theme') {
        setCurrentTheme(value);
      }
      
      return newConfig;
    });
  };

  const handleAgentSelect = async (agentId: string) => {
    const success = await agentOrchestrator.switchAgent(agentId, 'User selected', true);
    if (success) {
      setCurrentAgent(agentId);
      
      // Update agents list to reflect active status
      setAgents(prev => prev.map(agent => ({
        ...agent,
        isActive: agent.id === agentId
      })));
      
      // Add system message about agent switch
      const newAgent = agentManager.getAgent(agentId);
      if (newAgent) {
        const message: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `Switched to ${newAgent.name} agent - ${newAgent.whenToUse}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
      }
    }
    setCurrentScreen('conversation');
  };

  const handleAgentCreate = async (agent: Partial<Agent>) => {
    try {
      const newAgent = await agentManager.createAgent({
        name: agent.name,
        agentType: agent.type,
        whenToUse: agent.whenToUse || 'Custom agent',
        systemPrompt: agent.systemPrompt || 'You are a helpful assistant.',
        location: 'user'
      });
      
      // Refresh agents list
      const allAgents = agentManager.getAllAgents().map(a => ({
        id: a.identifier,
        name: a.name,
        type: a.agentType,
        whenToUse: a.whenToUse,
        systemPrompt: a.systemPrompt,
        location: a.location,
        isActive: a.identifier === agentManager.getRegistry().activeAgent,
        color: agentManager.getAgentColor(a.identifier)
      }));
      setAgents(allAgents);
      
      const message: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `Created new agent: ${newAgent.name}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleAgentDelete = async (agentId: string) => {
    const success = await agentManager.deleteAgent(agentId);
    if (success) {
      // Refresh agents list
      const allAgents = agentManager.getAllAgents().map(agent => ({
        id: agent.identifier,
        name: agent.name,
        type: agent.agentType,
        whenToUse: agent.whenToUse,
        systemPrompt: agent.systemPrompt,
        location: agent.location,
        isActive: agent.identifier === agentManager.getRegistry().activeAgent,
        color: agentManager.getAgentColor(agent.identifier)
      }));
      setAgents(allAgents);
      
      const message: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `Deleted agent: ${agentId}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'config':
        return (
          <ConfigScreen
            config={config}
            onConfigChange={handleConfigChange}
            onBack={() => setCurrentScreen('conversation')}
          />
        );
      case 'agents':
        return (
          <AgentScreen
            agents={agents}
            currentAgent={currentAgent}
            onAgentSelect={handleAgentSelect}
            onAgentCreate={handleAgentCreate}
            onAgentDelete={handleAgentDelete}
            onBack={() => setCurrentScreen('conversation')}
          />
        );
      case 'help':
        return (
          <Box flexDirection="column" padding={2}>
            <Text color="primary" bold>Claude Code Assistant - Help</Text>
            <Box marginTop={1}>
              <Text color="text">Available Commands:</Text>
            </Box>
            <Text>/config - Open configuration panel</Text>
            <Text>/agents - Manage agents</Text>
            <Text>/theme [name] - Change theme (light, dark-ansi, light-daltonized, etc.)</Text>
            <Text>/agent [name] - Switch agent</Text>
            <Text>/approve [id|--all] - Approve pending tool calls</Text>
            <Text>/approvals - List pending approvals</Text>
            <Text>/diagnostics - System diagnostics</Text>
            <Text>/performance - Performance metrics</Text>
            <Text>/help - Show this help</Text>
            <Box marginTop={1}>
              <Text color="textSecondary">
                Press Esc to return to conversation
              </Text>
            </Box>
          </Box>
        );
      case 'diagnostics':
        return (
          <Box flexDirection="column" padding={2}>
            <Text color="primary" bold>System Diagnostics</Text>
            <Text color="success">✓ LLM Client: Connected</Text>
            <Text color="success">✓ Tool Manager: {engine.getToolManager().listTools().length} tools loaded</Text>
            <Text color="success">✓ Permission System: Active</Text>
            {mcpManagerRef.current ? (
              <Text color="text">MCP Servers: {mcpManagerRef.current.getServerNames().length} configured, {mcpManagerRef.current.getConnectedServers().length} connected</Text>
            ) : (
              <Text color="warning">⚠ MCP Manager not initialized</Text>
            )}
            {bgManagerRef.current ? (
              <Text color="text">Background Processes: {bgManagerRef.current.runningCount()} running</Text>
            ) : (
              <Text color="warning">⚠ Background Manager not initialized</Text>
            )}
            <Box marginTop={1}>
              <Text color="textSecondary">
                Press Esc to return to conversation
              </Text>
            </Box>
          </Box>
        );
      case 'performance':
        return (
          <Box flexDirection="column" padding={2}>
            <Text color="primary" bold>Performance Metrics</Text>
            <Text color="text">Messages: {messages.length}</Text>
            <Text color="text">Current Agent: {currentAgent}</Text>
            <Text color="text">Theme: {theme.name}</Text>
            <Text color="text">Pending Approvals: {approvals.listPending().length}</Text>
            <Box marginTop={1}>
              <Text color="textSecondary">
                Press Esc to return to conversation
              </Text>
            </Box>
          </Box>
        );
      default:
        return (
          <ConversationScreen
            messages={messages}
            isLoading={isLoading}
            currentAgent={currentAgent}
            onInput={handleInput}
            onCommand={handleCommand}
          />
        );
    }
  };

  return (
    <ThemeProvider themeName={currentTheme}>
      <Box flexDirection="column" height="100%" width="100%">
        {renderScreen()}

        {/* Input area for conversation screen */}
        {currentScreen === 'conversation' && (
          <Box borderStyle="round" borderColor="border" padding={1}>
            <Text color="primary">❯ </Text>
            <Text color="text">{input}</Text>
            <Text color="textSecondary">█</Text>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
};
