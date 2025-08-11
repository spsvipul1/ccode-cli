import React, { useState } from 'react';
import { Box, Text, SelectInput, Tabs } from '../framework/index.js';
import { Table } from '../components/index.js';
import { themes } from '../themes/index.js';
import { useTheme } from '../themeContext.js';

interface ConfigScreenProps {
  config: any;
  onConfigChange: (key: string, value: any) => void;
  onBack: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  config,
  onConfigChange,
  onBack
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('general');

  const themeOptions = Object.keys(themes).map(key => ({
    label: themes[key].name,
    value: key,
    description: `${themes[key].accessibility.colorBlind ? 'Colorblind-friendly' : 'Standard'} theme`
  }));

  const modelOptions = [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022', description: 'Latest and most capable' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022', description: 'Fast and efficient' },
    { label: 'GPT-4o', value: 'gpt-4o', description: "OpenAI's latest" },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini', description: 'Fast and cost-effective' }
  ];

  const providerOptions = [
    { label: 'Anthropic', value: 'anthropic', description: 'Claude models' },
    { label: 'OpenAI', value: 'openai', description: 'GPT models' },
    { label: 'OpenRouter', value: 'openrouter', description: 'Multiple providers' },
    { label: 'Auto', value: 'auto', description: 'Automatic selection' }
  ];

  const configTabs = [
    {
      id: 'general',
      label: 'General',
      content: (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="primary" bold>General Settings</Text>
          </Box>

          <Box marginBottom={2}>
            <Text color="text" bold>Theme:</Text>
            <SelectInput
              options={themeOptions}
              onSelect={(value) => onConfigChange('theme', value)}
            />
          </Box>

          <Box marginBottom={2}>
            <Text color="text" bold>LLM Provider:</Text>
            <SelectInput
              options={providerOptions}
              onSelect={(value) => onConfigChange('llm.provider', value)}
            />
          </Box>

          <Box marginBottom={2}>
            <Text color="text" bold>Default Model:</Text>
            <SelectInput
              options={modelOptions}
              onSelect={(value) => onConfigChange('llm.model', value)}
            />
          </Box>
        </Box>
      )
    },
    {
      id: 'permissions',
      label: 'Permissions',
      content: (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="primary" bold>Permission Settings</Text>
          </Box>

          <Table
            columns={[
              { key: 'tool', title: 'Tool', width: 15 },
              { key: 'permission', title: 'Permission', width: 10 },
              { key: 'scope', title: 'Scope', width: 12 }
            ]}
            data={[
              { tool: 'bash.run', permission: 'allow', scope: 'user' },
              { tool: 'fs.write', permission: 'prompt', scope: 'project' },
              { tool: 'web.fetch', permission: 'allow', scope: 'global' },
              { tool: 'edit', permission: 'prompt', scope: 'project' }
            ]}
            headerColor={theme.colors.primary}
            borderColor={theme.colors.border}
          />

          <Box marginTop={2}>
            <Text color="info">
              • allow: Execute without prompting
            </Text>
            <Text color="warning">
              • prompt: Ask for confirmation
            </Text>
            <Text color="error">
              • deny: Block execution
            </Text>
          </Box>
        </Box>
      )
    },
    {
      id: 'advanced',
      label: 'Advanced',
      content: (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="primary" bold>Advanced Settings</Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="text">
              Max Tokens: <Text color="info">{config.maxTokens || 4096}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="text">
              Temperature: <Text color="info">{config.temperature || 0.7}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="text">
              Auto-compact: <Text color="success">{config.autoCompact ? 'Enabled' : 'Disabled'}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="text">
              Telemetry: <Text color="success">{config.telemetry ? 'Enabled' : 'Disabled'}</Text>
            </Text>
          </Box>

          <Box marginTop={2} padding={1} borderStyle="round" borderColor="warning">
            <Text color="warning" bold>⚠️ Warning</Text>
            <Text color="text">
              Changing advanced settings may affect performance and functionality.
            </Text>
          </Box>
        </Box>
      )
    }
  ];

  return (
    <Box flexDirection="column" height="100%">
      <Tabs tabs={configTabs} onChange={setActiveTab} />
    </Box>
  );
};
