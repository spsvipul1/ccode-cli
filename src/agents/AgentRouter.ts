import { AgentDefinition, AgentManager } from './AgentManager.js';

export interface RoutingContext {
  userInput: string;
  currentTask?: string;
  previousAgent?: string;
  sessionHistory: Array<{
    agent: string;
    input: string;
    success: boolean;
    timestamp: Date;
  }>;
  projectContext?: {
    language?: string;
    framework?: string;
    type?: string; // 'web', 'mobile', 'desktop', 'library', etc.
  };
}

export interface RoutingDecision {
  recommendedAgent: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    agent: string;
    confidence: number;
    reasoning: string;
  }>;
}

export class AgentRouter {
  private agentManager: AgentManager;
  private routingRules: Map<string, (context: RoutingContext) => number> = new Map();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.initializeRoutingRules();
  }

  private initializeRoutingRules() {
    // Code review keywords and patterns
    this.routingRules.set('code-reviewer', (context) => {
      const input = context.userInput.toLowerCase();
      const reviewKeywords = [
        'review', 'analyze code', 'check code', 'code quality', 'best practices',
        'security', 'vulnerability', 'performance', 'optimize', 'refactor',
        'style guide', 'lint', 'code smell', 'technical debt'
      ];
      
      let score = 0;
      reviewKeywords.forEach(keyword => {
        if (input.includes(keyword)) score += 0.2;
      });

      // Boost if asking to review specific files or code blocks
      if (input.includes('review this') || input.includes('what do you think')) score += 0.3;
      if (input.includes('.js') || input.includes('.ts') || input.includes('.py')) score += 0.1;

      return Math.min(score, 1.0);
    });

    // Debug assistant keywords and patterns
    this.routingRules.set('debug-assistant', (context) => {
      const input = context.userInput.toLowerCase();
      const debugKeywords = [
        'debug', 'error', 'bug', 'issue', 'problem', 'broken', 'not working',
        'exception', 'crash', 'fail', 'troubleshoot', 'diagnose', 'fix',
        'stack trace', 'log', 'stderr', 'stdout'
      ];

      let score = 0;
      debugKeywords.forEach(keyword => {
        if (input.includes(keyword)) score += 0.2;
      });

      // Boost for error messages or stack traces
      if (input.includes('error:') || input.includes('exception:')) score += 0.4;
      if (input.includes('traceback') || input.includes('stack trace')) score += 0.3;

      return Math.min(score, 1.0);
    });

    // Documentation writer keywords and patterns
    this.routingRules.set('documentation', (context) => {
      const input = context.userInput.toLowerCase();
      const docKeywords = [
        'document', 'readme', 'docs', 'documentation', 'explain', 'describe',
        'write guide', 'tutorial', 'how to', 'api docs', 'comments',
        'markdown', 'wiki', 'manual'
      ];

      let score = 0;
      docKeywords.forEach(keyword => {
        if (input.includes(keyword)) score += 0.2;
      });

      // Boost for specific documentation requests
      if (input.includes('write a readme') || input.includes('create docs')) score += 0.4;
      if (input.includes('.md') || input.includes('markdown')) score += 0.2;

      return Math.min(score, 1.0);
    });

    // Security analyst keywords and patterns
    this.routingRules.set('security-analyst', (context) => {
      const input = context.userInput.toLowerCase();
      const securityKeywords = [
        'security', 'secure', 'vulnerability', 'exploit', 'attack', 'breach',
        'authentication', 'authorization', 'encryption', 'decrypt', 'hash',
        'sql injection', 'xss', 'csrf', 'sanitize', 'validate', 'audit'
      ];

      let score = 0;
      securityKeywords.forEach(keyword => {
        if (input.includes(keyword)) score += 0.25;
      });

      // Boost for security-specific requests
      if (input.includes('security scan') || input.includes('vulnerability assessment')) score += 0.4;
      if (input.includes('penetration test') || input.includes('security review')) score += 0.3;

      return Math.min(score, 1.0);
    });
  }

  async routeRequest(context: RoutingContext): Promise<RoutingDecision> {
    const agents = this.agentManager.getAllAgents();
    const scores: Array<{ agent: AgentDefinition; score: number; reasoning: string }> = [];

    // Calculate scores for each agent
    for (const agent of agents) {
      let score = 0;
      let reasoning = '';

      // Apply routing rules
      const rule = this.routingRules.get(agent.identifier);
      if (rule) {
        const ruleScore = rule(context);
        score += ruleScore * 0.8; // Rule-based scoring gets high weight
        if (ruleScore > 0.3) {
          reasoning += `Matches ${agent.name} patterns (${(ruleScore * 100).toFixed(0)}%). `;
        }
      }

      // Check whenToUse field
      const whenToUse = agent.whenToUse.toLowerCase();
      const input = context.userInput.toLowerCase();
      const whenToUseWords = whenToUse.split(/\s+/);
      const inputWords = input.split(/\s+/);
      
      let whenToUseScore = 0;
      whenToUseWords.forEach(word => {
        if (word.length > 3 && inputWords.some(iw => iw.includes(word) || word.includes(iw))) {
          whenToUseScore += 0.1;
        }
      });
      score += Math.min(whenToUseScore, 0.3);

      if (whenToUseScore > 0.1) {
        reasoning += `Relevant to agent purpose. `;
      }

      // Boost for previously successful agent
      if (context.previousAgent === agent.identifier) {
        score += 0.1;
        reasoning += `Previously used successfully. `;
      }

      // Context-based boosts
      if (context.projectContext) {
        // Language-specific boosts
        if (context.projectContext.language) {
          const lang = context.projectContext.language.toLowerCase();
          if (agent.systemPrompt.toLowerCase().includes(lang)) {
            score += 0.1;
            reasoning += `Specialized for ${context.projectContext.language}. `;
          }
        }

        // Framework-specific boosts
        if (context.projectContext.framework) {
          const framework = context.projectContext.framework.toLowerCase();
          if (agent.systemPrompt.toLowerCase().includes(framework)) {
            score += 0.1;
            reasoning += `Familiar with ${context.projectContext.framework}. `;
          }
        }
      }

      // Default to general-purpose if no strong matches
      if (agent.identifier === 'general-purpose' && score < 0.3) {
        score = 0.4;
        reasoning = 'Default general-purpose agent for coding tasks. ';
      }

      scores.push({ agent, score, reasoning: reasoning.trim() });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    const top = scores[0];
    const alternatives = scores.slice(1, 4).map(s => ({
      agent: s.agent.identifier,
      confidence: s.score,
      reasoning: s.reasoning
    }));

    return {
      recommendedAgent: top.agent.identifier,
      confidence: top.score,
      reasoning: top.reasoning,
      alternatives
    };
  }

  async autoRoute(userInput: string, previousAgent?: string): Promise<string> {
    const context: RoutingContext = {
      userInput,
      previousAgent,
      sessionHistory: []
    };

    const decision = await this.routeRequest(context);
    
    // Only auto-switch if confidence is high enough
    if (decision.confidence > 0.6) {
      return decision.recommendedAgent;
    }

    // Otherwise, stick with current or default
    return previousAgent || 'general-purpose';
  }

  addCustomRoutingRule(agentId: string, rule: (context: RoutingContext) => number): void {
    this.routingRules.set(agentId, rule);
  }

  removeRoutingRule(agentId: string): void {
    this.routingRules.delete(agentId);
  }

  getAvailableAgents(): Array<{ id: string; name: string; description: string }> {
    return this.agentManager.getAllAgents().map(agent => ({
      id: agent.identifier,
      name: agent.name,
      description: agent.whenToUse
    }));
  }
}