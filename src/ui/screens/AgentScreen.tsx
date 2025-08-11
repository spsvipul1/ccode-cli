import React, { useState } from 'react';
import { Box, Text, SelectInput } from '../framework/index.js';
import { Table, Modal } from '../components/index.js';
import { getAgentColor } from '../themes/index.js';
import { useTheme } from '../themeContext.js';

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

interface AgentScreenProps {
  agents: Agent[];
  currentAgent: string;
  onAgentSelect: (agentId: string) => void;
  onAgentCreate: (agent: Partial<Agent>) => void;
  onAgentDelete: (agentId: string) => void;
  onBack: () => void;
}

export const AgentScreen: React.FC<AgentScreenProps> = ({
  agents,
  currentAgent,
  onAgentSelect,
  onAgentCreate,
  onAgentDelete,
  onBack
}) => {
  const theme = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const agentTableData = agents.map(agent => ({
    name: agent.name,
    type: agent.type,
    location: agent.location,
    status: agent.id === currentAgent ? 'Active' : 'Inactive',
    color: getAgentColor(agent.id, theme)
  }));

  const agentTypeOptions = [
    { label: 'User Agent', value: 'user', description: 'Custom agent created by user' },
    { label: 'System Agent', value: 'system', description: 'Built-in system agent' },
    { label: 'Generated Agent', value: 'generated', description: 'AI-generated specialized agent' }
  ];

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="border" padding={1} marginBottom={1}>
        <Text color="primary" bold>Agent Management</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color="textSecondary">
            Current: <Text color={getAgentColor(currentAgent, theme)}>{currentAgent}</Text>
          </Text>
        </Box>
      </Box>

      {/* Agent List */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        <Box marginBottom={2}>
          <Text color="text" bold>Available Agents</Text>
        </Box>

        <Table
          columns={[
            { key: 'name', title: 'Name', width: 20 },
            { key: 'type', title: 'Type', width: 12 },
            { key: 'location', title: 'Scope', width: 10 },
            { key: 'status', title: 'Status', width: 10 }
          ]}
          data={agentTableData}
          headerColor={theme.colors.primary}
          borderColor={theme.colors.border}
        />

        {/* Agent Details */}
        {selectedAgent && (
          <Box marginTop={2} padding={1} borderStyle="round" borderColor="border">
            {(() => {
              const agent = agents.find(a => a.id === selectedAgent);
              if (!agent) return null;

              return (
                <Box flexDirection="column">
                  <Text color="primary" bold>{agent.name}</Text>
                  <Text color="textSecondary">Type: {agent.type}</Text>
                  <Text color="textSecondary">When to use: {agent.whenToUse}</Text>
                  <Box marginTop={1}>
                    <Text color="text">System Prompt:</Text>
                    <Text color="textSecondary">
                      {agent.systemPrompt.slice(0, 200)}...
                    </Text>
                  </Box>
                </Box>
              );
            })()}
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box justifyContent="space-between" padding={1} marginTop={1}>
        <Box>
          <Text color="success">N</Text>
          <Text color="textSecondary"> New Agent  </Text>
          <Text color="info">S</Text>
          <Text color="textSecondary"> Switch  </Text>
          <Text color="error">D</Text>
          <Text color="textSecondary"> Delete</Text>
        </Box>
        <Text color="textSecondary">Press Esc to go back</Text>
      </Box>

      {/* Create Agent Modal */}
      <Modal
        title="Create New Agent"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        borderColor={theme.colors.primary}
        width={70}
        height={25}
      >
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="text" bold>Agent Type:</Text>
          </Box>
          <SelectInput
            options={agentTypeOptions}
            onSelect={(value) => {
              onAgentCreate({
                type: value as 'user' | 'system' | 'generated',
                name: `New ${value} Agent`,
                location: 'user',
                whenToUse: 'General purpose assistance',
                systemPrompt: 'You are a helpful assistant.'
              });
              setShowCreateModal(false);
            }}
          />

          <Box marginTop={2}>
            <Text color="textSecondary">
              You can customize the agent after creation
            </Text>
          </Box>
        </Box>
      </Modal>

      {/* Built-in Agents Info */}
      <Box marginTop={1} padding={1} borderStyle="round" borderColor="info">
        <Text color="info" bold>Built-in Agents:</Text>
        <Text color="text">
          • General Purpose: Default coding assistant
        </Text>
        <Text color="text">
          • Code Reviewer: Specialized in code analysis
        </Text>
        <Text color="text">
          • Documentation: Focused on writing docs
        </Text>
        <Text color="text">
          • Debug Assistant: Specialized in debugging
        </Text>
      </Box>
    </Box>
  );
};
