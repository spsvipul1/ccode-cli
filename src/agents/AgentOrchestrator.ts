import { AgentDefinition, AgentManager } from './AgentManager.js';
import { AgentRouter, RoutingContext, RoutingDecision } from './AgentRouter.js';
import { Orchestrator } from '../exec/Orchestrator.js';
import { LlmClient } from '../interfaces.js';

export interface AgentSession {
  agentId: string;
  startTime: Date;
  messageCount: number;
  totalTokens: number;
  successful: boolean;
  context: any;
}

export interface AgentSwitchEvent {
  fromAgent: string;
  toAgent: string;
  reason: string;
  timestamp: Date;
  userApproved: boolean;
}

export class AgentOrchestrator {
  private agentManager: AgentManager;
  private router: AgentRouter;
  private currentSession: AgentSession | null = null;
  private sessionHistory: AgentSession[] = [];
  private switchHistory: AgentSwitchEvent[] = [];
  private llmClients: Map<string, LlmClient> = new Map();

  constructor(agentManager: AgentManager, router: AgentRouter) {
    this.agentManager = agentManager;
    this.router = router;
  }

  registerLlmClient(provider: string, client: LlmClient): void {
    this.llmClients.set(provider, client);
  }

  async startSession(agentId?: string, context?: any): Promise<AgentSession> {
    // End current session if active
    if (this.currentSession) {
      await this.endCurrentSession();
    }

    // Determine agent to use
    const targetAgentId = agentId || this.agentManager.getRegistry().activeAgent;
    const agent = this.agentManager.getAgent(targetAgentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${targetAgentId}`);
    }

    // Create new session
    this.currentSession = {
      agentId: targetAgentId,
      startTime: new Date(),
      messageCount: 0,
      totalTokens: 0,
      successful: true,
      context: context || {}
    };

    // Set as active agent
    this.agentManager.setActiveAgent(targetAgentId);

    return this.currentSession;
  }

  async endCurrentSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.successful = true; // Could be determined by other criteria
      this.sessionHistory.push({ ...this.currentSession });
      this.currentSession = null;
    }
  }

  async processMessage(
    userInput: string, 
    orchestrator: Orchestrator,
    toolManager: any,
    permissionResolver: any,
    hooks: any,
    serializer: any,
    context: any,
    options?: {
      autoSwitch?: boolean;
      suggestAlternatives?: boolean;
    }
  ): Promise<{
    agentUsed: string;
    switchOccurred: boolean;
    suggestions?: RoutingDecision;
    response?: any;
  }> {
    const opts = { autoSwitch: true, suggestAlternatives: false, ...options };

    // Get current agent
    const currentAgent = this.agentManager.getActiveAgent();
    if (!currentAgent) {
      throw new Error('No active agent');
    }

    let agentToUse = currentAgent;
    let switchOccurred = false;
    let suggestions: RoutingDecision | undefined;

    // Check if we should route to a different agent
    if (opts.autoSwitch || opts.suggestAlternatives) {
      const routingContext: RoutingContext = {
        userInput,
        previousAgent: currentAgent.identifier,
        sessionHistory: this.sessionHistory.map(s => ({
          agent: s.agentId,
          input: userInput, // In a real implementation, this would be stored
          success: s.successful,
          timestamp: s.startTime
        })),
        projectContext: this.detectProjectContext()
      };

      const decision = await this.router.routeRequest(routingContext);
      suggestions = decision;

      // Auto-switch if confidence is high and different from current
      if (opts.autoSwitch && 
          decision.confidence > 0.7 && 
          decision.recommendedAgent !== currentAgent.identifier) {
        
        const newAgent = this.agentManager.getAgent(decision.recommendedAgent);
        if (newAgent) {
          await this.switchAgent(newAgent.identifier, decision.reasoning, true);
          agentToUse = newAgent;
          switchOccurred = true;
        }
      }
    }

    // Update session
    if (this.currentSession) {
      this.currentSession.messageCount++;
    }

    // Get the appropriate LLM client for this agent
    const llmClient = this.getLlmClientForAgent(agentToUse);
    
    // Create orchestrator with agent-specific settings
    const agentOrchestrator = new Orchestrator(llmClient);

    // Prepare agent-specific system prompt and settings
    const systemPrompt = this.buildSystemPrompt(agentToUse, context);
    const messages = context.messages || [];

    // Execute with the selected agent
    try {
      await agentOrchestrator.run({
        mode: context.mode || 'default',
        model: agentToUse.model || 'claude-3-5-sonnet-20241022',
        toolManager,
        permissionResolver,
        hooks,
        serializer,
        context,
        systemPrompt,
        messages
      });

      return {
        agentUsed: agentToUse.identifier,
        switchOccurred,
        suggestions,
        response: 'success'
      };
    } catch (error) {
      // If agent fails, try fallback to general-purpose
      if (agentToUse.identifier !== 'general-purpose') {
        const fallbackAgent = this.agentManager.getAgent('general-purpose');
        if (fallbackAgent) {
          await this.switchAgent('general-purpose', 'Fallback due to error', false);
          
          const fallbackLlm = this.getLlmClientForAgent(fallbackAgent);
          const fallbackOrchestrator = new Orchestrator(fallbackLlm);
          
          await fallbackOrchestrator.run({
            mode: context.mode || 'default',
            model: fallbackAgent.model || 'claude-3-5-sonnet-20241022',
            toolManager,
            permissionResolver,
            hooks,
            serializer,
            context,
            systemPrompt: this.buildSystemPrompt(fallbackAgent, context),
            messages
          });

          return {
            agentUsed: 'general-purpose',
            switchOccurred: true,
            suggestions,
            response: 'fallback'
          };
        }
      }
      
      throw error;
    }
  }

  async switchAgent(agentId: string, reason: string, userApproved: boolean): Promise<boolean> {
    const currentAgent = this.agentManager.getActiveAgent();
    const newAgent = this.agentManager.getAgent(agentId);

    if (!newAgent) {
      return false;
    }

    if (currentAgent && currentAgent.identifier !== agentId) {
      // Record the switch
      this.switchHistory.push({
        fromAgent: currentAgent.identifier,
        toAgent: agentId,
        reason,
        timestamp: new Date(),
        userApproved
      });

      // End current session and start new one
      await this.endCurrentSession();
      await this.startSession(agentId);
    }

    return this.agentManager.setActiveAgent(agentId);
  }

  private getLlmClientForAgent(agent: AgentDefinition): LlmClient {
    // Try to get agent-specific model/provider
    const preferredProvider = this.extractProviderFromModel(agent.model);
    const client = this.llmClients.get(preferredProvider);
    
    if (client) {
      return client;
    }

    // Fallback to first available client
    const firstClient = this.llmClients.values().next().value;
    if (firstClient) {
      return firstClient;
    }

    // Ultimate fallback - mock client
    return {
      async *streamChat() {
        yield { type: 'token', data: 'No LLM client configured' };
        yield { type: 'done' };
      }
    };
  }

  private extractProviderFromModel(model?: string): string {
    if (!model) return 'anthropic';
    
    if (model.startsWith('gpt-') || model.includes('openai')) return 'openai';
    if (model.startsWith('claude-') || model.includes('anthropic')) return 'anthropic';
    if (model.includes('/')) return 'openrouter'; // OpenRouter format: provider/model
    
    return 'anthropic'; // Default
  }

  private buildSystemPrompt(agent: AgentDefinition, context: any): string {
    let prompt = agent.systemPrompt;

    // Add context-specific information
    if (context.projectContext) {
      prompt += `\n\nProject Context:`;
      if (context.projectContext.language) {
        prompt += `\n- Language: ${context.projectContext.language}`;
      }
      if (context.projectContext.framework) {
        prompt += `\n- Framework: ${context.projectContext.framework}`;
      }
      if (context.projectContext.type) {
        prompt += `\n- Project Type: ${context.projectContext.type}`;
      }
    }

    // Add agent-specific tool constraints
    if (agent.tools && agent.tools.length > 0 && !agent.tools.includes('*')) {
      prompt += `\n\nAvailable Tools: ${agent.tools.join(', ')}`;
    }

    // Add permission context
    if (agent.permissions) {
      if (agent.permissions.allow) {
        prompt += `\n\nAllowed Actions: ${agent.permissions.allow.join(', ')}`;
      }
      if (agent.permissions.deny) {
        prompt += `\n\nRestricted Actions: ${agent.permissions.deny.join(', ')}`;
      }
    }

    return prompt;
  }

  private detectProjectContext(): any {
    // Heuristic project context detection
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const cwd = process.cwd();
      const context: any = {};
      if (fs.existsSync(path.join(cwd, 'package.json'))) {
        context.language = 'javascript/typescript';
        context.type = 'node';
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
          const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
          if (deps?.react) context.framework = 'react';
          if (deps?.next) context.framework = 'nextjs';
          if (deps?.vite) context.framework = 'vite';
          if (deps?.express) context.framework = 'express';
        } catch {}
      } else if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'requirements.txt'))) {
        context.language = 'python';
        context.type = 'python';
      } else if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
        context.language = 'rust';
        context.type = 'cargo';
      } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
        context.language = 'go';
        context.type = 'go';
      }
      return context;
    } catch {
      return {};
    }
  }

  getCurrentAgent(): AgentDefinition | undefined {
    return this.agentManager.getActiveAgent();
  }

  getCurrentSession(): AgentSession | null {
    return this.currentSession;
  }

  getSessionHistory(): AgentSession[] {
    return [...this.sessionHistory];
  }

  getSwitchHistory(): AgentSwitchEvent[] {
    return [...this.switchHistory];
  }

  getAgentStats(): Record<string, { 
    sessions: number; 
    totalMessages: number; 
    avgSessionLength: number; 
    successRate: number 
  }> {
    const stats: Record<string, any> = {};
    
    this.sessionHistory.forEach(session => {
      if (!stats[session.agentId]) {
        stats[session.agentId] = {
          sessions: 0,
          totalMessages: 0,
          totalDuration: 0,
          successes: 0
        };
      }
      
      const s = stats[session.agentId];
      s.sessions++;
      s.totalMessages += session.messageCount;
      s.totalDuration += Date.now() - session.startTime.getTime();
      if (session.successful) s.successes++;
    });

    // Calculate derived stats
    Object.keys(stats).forEach(agentId => {
      const s = stats[agentId];
      s.avgSessionLength = s.sessions > 0 ? s.totalMessages / s.sessions : 0;
      s.successRate = s.sessions > 0 ? s.successes / s.sessions : 0;
      delete s.totalDuration;
      delete s.successes;
    });

    return stats;
  }
}