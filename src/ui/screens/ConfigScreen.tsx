import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ThemeConfig, THEMES } from '../themes.js';
import { SelectInput, Tabs, Table } from '../components/index.js';

interface ConfigScreenProps {
  theme: ThemeConfig;
  config: any;
  onConfigChange: (key: string, value: any) => void;
  onBack: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  theme,
  config,
  onConfigChange,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState('general');

  const themeOptions = Object.keys(THEMES).map(key => ({
    label: THEMES[key].name,
    value: key,
    description: `${THEMES[key].accessibility.colorBlind ? 'Colorblind-friendly' : 'Standard'} theme`
  }));

  const modelOptions = [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022', description: 'Latest and most capable' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022', description: 'Fast and efficient' },
    { label: 'GPT-4o', value: 'gpt-4o', description: 'OpenAI\'s latest' },
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
            <Text color={theme.colors.primary} bold>General Settings</Text>
          </Box>
          
          <Box marginBottom={2}>
            <Text color={theme.colors.text} bold>Theme:</Text>
            <SelectInput
              options={themeOptions}
              onSelect={(value) => onConfigChange('theme', value)}
              selectedColor={theme.colors.primary}
            />
          </Box>

          <Box marginBottom={2}>
            <Text color={theme.colors.text} bold>LLM Provider:</Text>
            <SelectInput
              options={providerOptions}
              onSelect={(value) => onConfigChange('llm.provider', value)}
              selectedColor={theme.colors.primary}
            />
          </Box>

          <Box marginBottom={2}>
            <Text color={theme.colors.text} bold>Default Model:</Text>
            <SelectInput
              options={modelOptions}
              onSelect={(value) => onConfigChange('llm.model', value)}
              selectedColor={theme.colors.primary}
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
            <Text color={theme.colors.primary} bold>Permission Settings</Text>
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
            <Text color={theme.colors.info}>
              • allow: Execute without prompting
            </Text>
            <Text color={theme.colors.warning}>
              • prompt: Ask for confirmation
            </Text>
            <Text color={theme.colors.error}>
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
            <Text color={theme.colors.primary} bold>Advanced Settings</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.colors.text}>
              Max Tokens: <Text color={theme.colors.info}>{config.maxTokens || 4096}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={theme.colors.text}>
              Temperature: <Text color={theme.colors.info}>{config.temperature || 0.7}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={theme.colors.text}>
              Auto-compact: <Text color={theme.colors.success}>{config.autoCompact ? 'Enabled' : 'Disabled'}</Text>
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={theme.colors.text}>
              Telemetry: <Text color={theme.colors.success}>{config.telemetry ? 'Enabled' : 'Disabled'}</Text>
            </Text>
          </Box>

          <Box marginTop={2} padding={1} borderStyle="round" borderColor={theme.colors.warning}>
            <Text color={theme.colors.warning} bold>⚠️ Warning</Text>
            <Text color={theme.colors.text}>
              Changing advanced settings may affect performance and functionality.
            </Text>
          </Box>
        </Box>
      )
    }
  ];

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.colors.border} padding={1} marginBottom={1}>
        <Text color={theme.colors.primary} bold>Configuration</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color={theme.colors.textSecondary}>Press Esc to go back</Text>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        tabs={configTabs}
        activeColor={theme.colors.primary}
        inactiveColor={theme.colors.textSecondary}
        borderColor={theme.colors.border}
        onChange={setActiveTab}
      />

      {/* Footer */}
      <Box justifyContent="space-between" padding={1} marginTop={1}>
        <Text color={theme.colors.textSecondary}>
          Use ←→ to navigate tabs, ↑↓ to select options
        </Text>
        <Text color={theme.colors.textSecondary}>
          Changes are saved automatically
        </Text>
      </Box>
    </Box>
  );
};
