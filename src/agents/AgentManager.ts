import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { getAgentColor } from '../ui/themes/index.js';

export interface AgentDefinition {
  identifier: string;
  name: string;
  agentType: 'user' | 'system' | 'generated';
  whenToUse: string;
  systemPrompt: string;
  location: 'user' | 'project';
  isUserFile: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  permissions?: {
    allow?: string[];
    deny?: string[];
    prompt?: string[];
  };
  metadata?: {
    created: string;
    updated: string;
    version: string;
    author?: string;
    description?: string;
    tags?: string[];
  };
}

export interface AgentRegistry {
  agents: AgentDefinition[];
  activeAgent: string;
  agentColorMap: Record<string, string>;
}

export class AgentManager {
  private registry: AgentRegistry = {
    agents: [],
    activeAgent: 'general-purpose',
    agentColorMap: {}
  };

  private userAgentsPath = join(process.env.HOME || process.cwd(), '.cli-code', 'agents');
  private projectAgentsPath = join(process.cwd(), '.cli-code', 'agents');

  constructor() {
    this.initializeBuiltinAgents();
  }

  private initializeBuiltinAgents() {
    const builtinAgents: AgentDefinition[] = [
      {
        identifier: 'general-purpose',
        name: 'General Purpose',
        agentType: 'system',
        whenToUse: 'Default coding assistant for general development tasks',
        systemPrompt: `You are a helpful coding assistant. Use tools as needed to accomplish tasks. 
When you have completed the user's request, call task_complete with your final response.

You excel at:
- Code analysis and debugging
- File operations and project navigation  
- Running commands and interpreting output
- Explaining complex concepts clearly
- Following best practices and conventions

Always be thorough, accurate, and helpful.`,
        location: 'user',
        isUserFile: false,
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
        tools: ['*'], // All tools available
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0',
          author: 'System',
          description: 'Default general-purpose coding assistant',
          tags: ['builtin', 'general', 'coding']
        }
      },
      {
        identifier: 'code-reviewer',
        name: 'Code Reviewer',
        agentType: 'system',
        whenToUse: 'Code review, analysis, and quality assessment',
        systemPrompt: `You are a senior code reviewer focused on code quality, best practices, and maintainability.

Your expertise includes:
- Code quality assessment and improvement suggestions
- Security vulnerability identification
- Performance optimization recommendations
- Architecture and design pattern analysis
- Documentation and testing recommendations
- Style guide compliance

Provide constructive, actionable feedback with specific examples and alternatives.`,
        location: 'user',
        isUserFile: false,
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.3,
        maxTokens: 4096,
        tools: ['fs.read', 'fs.write', 'edit', 'multiedit', 'bash.run', 'web.fetch'],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0',
          author: 'System',
          description: 'Specialized agent for code review and quality assessment',
          tags: ['builtin', 'review', 'quality']
        }
      },
      {
        identifier: 'debug-assistant',
        name: 'Debug Assistant',
        agentType: 'system',
        whenToUse: 'Debugging, troubleshooting, and error resolution',
        systemPrompt: `You are a debugging specialist with expertise in identifying and resolving software issues.

Your capabilities include:
- Error analysis and root cause identification
- Log file interpretation and pattern recognition
- System diagnostics and health checks
- Performance bottleneck identification
- Testing strategy and implementation
- Environment and configuration troubleshooting

Be methodical, systematic, and thorough in your debugging approach.`,
        location: 'user',
        isUserFile: false,
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.2,
        maxTokens: 4096,
        tools: ['fs.read', 'bash.run', 'web.fetch', 'grep'],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0',
          author: 'System',
          description: 'Specialized agent for debugging and troubleshooting',
          tags: ['builtin', 'debug', 'troubleshooting']
        }
      },
      {
        identifier: 'documentation',
        name: 'Documentation Writer',
        agentType: 'system',
        whenToUse: 'Writing, improving, and maintaining documentation',
        systemPrompt: `You are a technical documentation specialist focused on creating clear, comprehensive, and user-friendly documentation.

Your expertise includes:
- API documentation and reference guides
- User manuals and tutorials
- Code comments and inline documentation
- README files and project documentation
- Architecture and design documentation
- Knowledge base articles and FAQs

Write documentation that is accessible, well-structured, and actionable.`,
        location: 'user',
        isUserFile: false,
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.4,
        maxTokens: 4096,
        tools: ['fs.read', 'fs.write', 'edit', 'multiedit', 'web.fetch'],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0',
          author: 'System',
          description: 'Specialized agent for technical documentation',
          tags: ['builtin', 'documentation', 'writing']
        }
      },
      {
        identifier: 'security-analyst',
        name: 'Security Analyst',
        agentType: 'system',
        whenToUse: 'Security analysis, vulnerability assessment, and hardening',
        systemPrompt: `You are a cybersecurity specialist focused on identifying vulnerabilities and implementing security best practices.

Your expertise includes:
- Security vulnerability scanning and assessment
- Code security review and hardening
- Configuration security analysis
- Threat modeling and risk assessment
- Security testing and validation
- Compliance and regulatory requirements

Prioritize security without compromising functionality, and provide practical remediation steps.`,
        location: 'user',
        isUserFile: false,
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.2,
        maxTokens: 4096,
        tools: ['fs.read', 'bash.run', 'web.fetch', 'grep'],
        permissions: {
          prompt: ['bash.run', 'fs.write', 'edit'] // Security-conscious permissions
        },
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0',
          author: 'System',
          description: 'Specialized agent for security analysis and hardening',
          tags: ['builtin', 'security', 'analysis']
        }
      }
    ];

    this.registry.agents = builtinAgents;
    
    // Initialize color mappings
    builtinAgents.forEach(agent => {
      this.registry.agentColorMap[agent.identifier] = getAgentColor(agent.identifier, { colors: { agent: { custom: ['blue', 'green', 'red', 'cyan', 'magenta'] } } } as any);
    });
  }

  async loadUserAgents(): Promise<void> {
    try {
      await this.loadAgentsFromDirectory(this.userAgentsPath, 'user');
    } catch (error) {
      // User agents directory doesn't exist yet - that's fine
    }
  }

  async loadProjectAgents(): Promise<void> {
    try {
      await this.loadAgentsFromDirectory(this.projectAgentsPath, 'project');
    } catch (error) {
      // Project agents directory doesn't exist yet - that's fine
    }
  }

  private async loadAgentsFromDirectory(directory: string, location: 'user' | 'project'): Promise<void> {
    try {
      const files = await fs.readdir(directory);
      const agentFiles = files.filter(f => f.endsWith('.json'));

      for (const file of agentFiles) {
        try {
          const content = await fs.readFile(join(directory, file), 'utf-8');
          const agent: AgentDefinition = JSON.parse(content);
          
          // Validate agent definition
          if (this.validateAgentDefinition(agent)) {
            agent.location = location;
            agent.isUserFile = true;
            
            // Remove any existing agent with the same identifier
            this.registry.agents = this.registry.agents.filter(a => a.identifier !== agent.identifier);
            
            // Add the loaded agent
            this.registry.agents.push(agent);
            
            // Assign color if not already assigned
            if (!this.registry.agentColorMap[agent.identifier]) {
              this.registry.agentColorMap[agent.identifier] = getAgentColor(agent.identifier, { colors: { agent: { custom: ['blue', 'green', 'red', 'cyan', 'magenta'] } } } as any);
            }
          }
        } catch (error) {
          console.warn(`Failed to load agent from ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }

  private validateAgentDefinition(agent: any): agent is AgentDefinition {
    return (
      typeof agent.identifier === 'string' &&
      typeof agent.name === 'string' &&
      typeof agent.agentType === 'string' &&
      ['user', 'system', 'generated'].includes(agent.agentType) &&
      typeof agent.whenToUse === 'string' &&
      typeof agent.systemPrompt === 'string'
    );
  }

  async createAgent(definition: Partial<AgentDefinition>): Promise<AgentDefinition> {
    const agent: AgentDefinition = {
      identifier: definition.identifier || `agent-${Date.now()}`,
      name: definition.name || 'Unnamed Agent',
      agentType: definition.agentType || 'user',
      whenToUse: definition.whenToUse || 'General purpose assistance',
      systemPrompt: definition.systemPrompt || 'You are a helpful assistant.',
      location: definition.location || 'user',
      isUserFile: true,
      model: definition.model || 'claude-3-5-sonnet-20241022',
      temperature: definition.temperature || 0.7,
      maxTokens: definition.maxTokens || 4096,
      tools: definition.tools || ['*'],
      permissions: definition.permissions || {},
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0',
        author: definition.metadata?.author || 'User',
        description: definition.metadata?.description || '',
        tags: definition.metadata?.tags || []
      }
    };

    // Assign color
    this.registry.agentColorMap[agent.identifier] = getAgentColor(agent.identifier, { colors: { agent: { custom: ['blue', 'green', 'red', 'cyan', 'magenta'] } } } as any);

    // Add to registry
    this.registry.agents.push(agent);

    // Save to file
    await this.saveAgent(agent);

    return agent;
  }

  async saveAgent(agent: AgentDefinition): Promise<void> {
    const directory = agent.location === 'user' ? this.userAgentsPath : this.projectAgentsPath;
    
    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });
    
    const filename = `${agent.identifier}.json`;
    const filepath = join(directory, filename);
    
    await fs.writeFile(filepath, JSON.stringify(agent, null, 2));
  }

  async deleteAgent(identifier: string): Promise<boolean> {
    const agent = this.getAgent(identifier);
    if (!agent) return false;

    // Can't delete builtin agents
    if (!agent.isUserFile) return false;

    // Remove from registry
    this.registry.agents = this.registry.agents.filter(a => a.identifier !== identifier);
    delete this.registry.agentColorMap[identifier];

    // Remove file
    try {
      const directory = agent.location === 'user' ? this.userAgentsPath : this.projectAgentsPath;
      const filename = `${identifier}.json`;
      const filepath = join(directory, filename);
      await fs.unlink(filepath);
    } catch (error) {
      // File might not exist - that's ok
    }

    // If this was the active agent, switch to default
    if (this.registry.activeAgent === identifier) {
      this.registry.activeAgent = 'general-purpose';
    }

    return true;
  }

  getAgent(identifier: string): AgentDefinition | undefined {
    return this.registry.agents.find(a => a.identifier === identifier);
  }

  getAllAgents(): AgentDefinition[] {
    return [...this.registry.agents];
  }

  getAgentsByType(type: 'user' | 'system' | 'generated'): AgentDefinition[] {
    return this.registry.agents.filter(a => a.agentType === type);
  }

  getAgentsByLocation(location: 'user' | 'project'): AgentDefinition[] {
    return this.registry.agents.filter(a => a.location === location);
  }

  setActiveAgent(identifier: string): boolean {
    const agent = this.getAgent(identifier);
    if (agent) {
      this.registry.activeAgent = identifier;
      return true;
    }
    return false;
  }

  getActiveAgent(): AgentDefinition | undefined {
    return this.getAgent(this.registry.activeAgent);
  }

  getAgentColor(identifier: string): string {
    return this.registry.agentColorMap[identifier] || 'blue';
  }

  async generateAgent(prompt: string, type: 'user' | 'generated' = 'generated'): Promise<AgentDefinition> {
    // This would use an LLM to generate an agent based on the prompt
    // For now, create a basic template
    const identifier = `generated-${Date.now()}`;
    const agent: AgentDefinition = {
      identifier,
      name: `Generated Agent`,
      agentType: type,
      whenToUse: `Generated for: ${prompt}`,
      systemPrompt: `You are a specialized assistant created for the following purpose: ${prompt}. 
      
Use your expertise to help with this specific domain while maintaining general coding assistant capabilities.`,
      location: 'user',
      isUserFile: true,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096,
      tools: ['*'],
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0',
        author: 'AI Generated',
        description: `AI-generated agent for: ${prompt}`,
        tags: ['generated', 'ai-created']
      }
    };

    return await this.createAgent(agent);
  }

  searchAgents(query: string): AgentDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.registry.agents.filter(agent => 
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.whenToUse.toLowerCase().includes(lowerQuery) ||
      agent.metadata?.description?.toLowerCase().includes(lowerQuery) ||
      agent.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getRegistry(): AgentRegistry {
    return { ...this.registry };
  }
}
