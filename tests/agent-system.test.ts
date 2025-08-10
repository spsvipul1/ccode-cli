import { describe, it, expect, beforeEach } from 'vitest';
import { AgentManager, AgentRouter, AgentOrchestrator } from '../src/agents/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('Agent System', () => {
  let agentManager: AgentManager;
  let agentRouter: AgentRouter;
  let agentOrchestrator: AgentOrchestrator;

  beforeEach(() => {
    agentManager = new AgentManager();
    agentRouter = new AgentRouter(agentManager);
    agentOrchestrator = new AgentOrchestrator(agentManager, agentRouter);
  });

  describe('AgentManager', () => {
    it('should initialize with builtin agents', () => {
      const agents = agentManager.getAllAgents();
      expect(agents.length).toBeGreaterThan(0);
      
      const generalPurpose = agentManager.getAgent('general-purpose');
      expect(generalPurpose).toBeDefined();
      expect(generalPurpose?.name).toBe('General Purpose');
      expect(generalPurpose?.agentType).toBe('system');
    });

    it('should get active agent', () => {
      const activeAgent = agentManager.getActiveAgent();
      expect(activeAgent).toBeDefined();
      expect(activeAgent?.identifier).toBe('general-purpose');
    });

    it('should switch active agent', () => {
      const success = agentManager.setActiveAgent('code-reviewer');
      expect(success).toBe(true);
      
      const activeAgent = agentManager.getActiveAgent();
      expect(activeAgent?.identifier).toBe('code-reviewer');
    });

    it('should create custom agent', async () => {
      const customAgent = await agentManager.createAgent({
        name: 'Test Agent',
        agentType: 'user',
        whenToUse: 'Testing purposes',
        systemPrompt: 'You are a test agent.',
        location: 'user'
      });

      expect(customAgent.name).toBe('Test Agent');
      expect(customAgent.agentType).toBe('user');
      expect(customAgent.isUserFile).toBe(true);

      const retrieved = agentManager.getAgent(customAgent.identifier);
      expect(retrieved).toEqual(customAgent);
    });

    it('should filter agents by type', () => {
      const systemAgents = agentManager.getAgentsByType('system');
      expect(systemAgents.length).toBeGreaterThan(0);
      expect(systemAgents.every(a => a.agentType === 'system')).toBe(true);
    });

    it('should search agents', () => {
      const results = agentManager.searchAgents('debug');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(a => a.identifier === 'debug-assistant')).toBe(true);
    });

    it('should assign colors to agents', () => {
      const color = agentManager.getAgentColor('general-purpose');
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });
  });

  describe('AgentRouter', () => {
    it('should route debug requests to debug assistant', async () => {
      const decision = await agentRouter.routeRequest({
        userInput: 'I have a bug in my code, can you help debug it?',
        sessionHistory: []
      });

      expect(decision.recommendedAgent).toBe('debug-assistant');
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.reasoning).toContain('Debug Assistant');
    });

    it('should route code review requests to code reviewer', async () => {
      const decision = await agentRouter.routeRequest({
        userInput: 'Please review this code for best practices',
        sessionHistory: []
      });

      expect(decision.recommendedAgent).toBe('code-reviewer');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should route documentation requests to documentation agent', async () => {
      const decision = await agentRouter.routeRequest({
        userInput: 'Can you help me write a README file?',
        sessionHistory: []
      });

      expect(decision.recommendedAgent).toBe('documentation');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should route security requests to security analyst', async () => {
      const decision = await agentRouter.routeRequest({
        userInput: 'Check this code for security vulnerabilities',
        sessionHistory: []
      });

      // Security analyst should be recommended or at least in alternatives
      const isSecurityRecommended = decision.recommendedAgent === 'security-analyst' ||
        decision.alternatives.some(alt => alt.agent === 'security-analyst');
      
      expect(isSecurityRecommended).toBe(true);
    });

    it('should default to general purpose for ambiguous requests', async () => {
      const decision = await agentRouter.routeRequest({
        userInput: 'Hello, how are you?',
        sessionHistory: []
      });

      expect(decision.recommendedAgent).toBe('general-purpose');
    });

    it('should provide alternatives', async () => {
      const decision = await agentRouter.routeRequest({
        userInput: 'Help me with my code',
        sessionHistory: []
      });

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives.length).toBeGreaterThan(0);
    });

    it('should auto-route with high confidence', async () => {
      const agentId = await agentRouter.autoRoute('Debug this error message');
      expect(agentId).toBe('debug-assistant');
    });

    it('should stick with previous agent for low confidence', async () => {
      const agentId = await agentRouter.autoRoute('Hello', 'code-reviewer');
      expect(agentId).toBe('code-reviewer');
    });
  });

  describe('AgentOrchestrator', () => {
    it('should start and end sessions', async () => {
      const session = await agentOrchestrator.startSession('general-purpose');
      expect(session.agentId).toBe('general-purpose');
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.messageCount).toBe(0);

      const currentSession = agentOrchestrator.getCurrentSession();
      expect(currentSession).toEqual(session);

      await agentOrchestrator.endCurrentSession();
      expect(agentOrchestrator.getCurrentSession()).toBeNull();

      const history = agentOrchestrator.getSessionHistory();
      expect(history.length).toBe(1);
      expect(history[0].agentId).toBe('general-purpose');
    });

    it('should switch agents', async () => {
      await agentOrchestrator.startSession('general-purpose');
      
      const success = await agentOrchestrator.switchAgent('debug-assistant', 'Testing switch', true);
      expect(success).toBe(true);

      const currentAgent = agentOrchestrator.getCurrentAgent();
      expect(currentAgent?.identifier).toBe('debug-assistant');

      const switchHistory = agentOrchestrator.getSwitchHistory();
      expect(switchHistory.length).toBe(1);
      expect(switchHistory[0].fromAgent).toBe('general-purpose');
      expect(switchHistory[0].toAgent).toBe('debug-assistant');
      expect(switchHistory[0].userApproved).toBe(true);
    });

    it('should track agent statistics', async () => {
      await agentOrchestrator.startSession('general-purpose');
      await agentOrchestrator.endCurrentSession();

      await agentOrchestrator.startSession('debug-assistant');
      await agentOrchestrator.endCurrentSession();

      const stats = agentOrchestrator.getAgentStats();
      expect(stats['general-purpose']).toBeDefined();
      expect(stats['debug-assistant']).toBeDefined();
      expect(stats['general-purpose'].sessions).toBe(1);
      expect(stats['debug-assistant'].sessions).toBe(1);
    });

    it('should register LLM clients', () => {
      const mockClient = {
        async *streamChat() {
          yield { type: 'token', data: 'test' };
          yield { type: 'done' };
        }
      };

      agentOrchestrator.registerLlmClient('test', mockClient);
      // No direct way to test this, but it should not throw
      expect(true).toBe(true);
    });
  });
});