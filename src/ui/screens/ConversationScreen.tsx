import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ThemeConfig } from '../themes.js';
import { ProgressBar, Spinner, DiffView } from '../components/index.js';

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

interface ConversationScreenProps {
  theme: ThemeConfig;
  messages: Message[];
  isLoading: boolean;
  currentAgent: string;
  onInput: (input: string) => void;
  onCommand: (command: string) => void;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  theme,
  messages,
  isLoading,
  currentAgent,
  onInput,
  onCommand
}) => {
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useInput((inputChar, key) => {
    if (key.return) {
      if (input.startsWith('/')) {
        onCommand(input);
      } else {
        onInput(input);
      }
      setInput('');
    } else if (key.backspace) {
      setInput(prev => prev.slice(0, -1));
    } else if (key.escape) {
      setShowHelp(!showHelp);
    } else if (inputChar && !key.ctrl) {
      setInput(prev => prev + inputChar);
    }
  });

  const getMessageColor = (message: Message): string => {
    switch (message.type) {
      case 'user': return theme.colors.agent.user;
      case 'assistant': return theme.colors.agent.general;
      case 'system': return theme.colors.agent.system;
      case 'tool': return theme.colors.info;
      default: return theme.colors.text;
    }
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.colors.border} padding={1} marginBottom={1}>
        <Box flexGrow={1}>
          <Text color={theme.colors.primary} bold>
            Claude Code Assistant
          </Text>
        </Box>
        <Box>
          <Text color={theme.colors.textSecondary}>
            Agent: <Text color={theme.colors.agent.general}>{currentAgent}</Text>
          </Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={theme.colors.textSecondary}>
            Theme: <Text color={theme.colors.primary}>{theme.name}</Text>
          </Text>
        </Box>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {messages.map((message) => (
          <Box key={message.id} marginBottom={1} flexDirection="column">
            {/* Message header */}
            <Box>
              <Text color={getMessageColor(message)} bold>
                {message.type === 'user' ? '❯' : 
                 message.type === 'assistant' ? '🤖' :
                 message.type === 'tool' ? '🔧' : '⚙️'}
              </Text>
              <Box marginLeft={1}>
                <Text color={getMessageColor(message)} bold>
                  {message.type}
                </Text>
              </Box>
              {message.agent && (
                <Box marginLeft={1}>
                  <Text color={theme.colors.textSecondary}>
                    @{message.agent}
                  </Text>
                </Box>
              )}
              <Box marginLeft={1}>
                <Text color={theme.colors.textSecondary}>
                  {formatTimestamp(message.timestamp)}
                </Text>
              </Box>
            </Box>

            {/* Tool call info */}
            {message.toolCall && (
              <Box marginLeft={2} marginY={1}>
                <Text color={theme.colors.info}>
                  🔧 {message.toolCall.name}
                </Text>
                {message.toolCall.result && (
                  <Box marginLeft={1}>
                    <Text color={theme.colors.success}>
                      ✓
                    </Text>
                  </Box>
                )}
              </Box>
            )}

            {/* Message content */}
            <Box marginLeft={2} flexDirection="column">
              {message.content.includes('```') ? (
                // Code block rendering
                <Box borderStyle="round" borderColor={theme.colors.border} padding={1}>
                  <Text color={theme.colors.text}>
                    {message.content}
                  </Text>
                </Box>
              ) : (
                <Text color={theme.colors.text}>
                  {message.content}
                </Text>
              )}
            </Box>
          </Box>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <Box marginTop={1}>
            <Spinner color={theme.colors.primary} text="Thinking..." />
          </Box>
        )}
      </Box>

      {/* Input area */}
      <Box borderStyle="round" borderColor={theme.colors.border} padding={1}>
        <Text color={theme.colors.primary}>❯ </Text>
        <Text color={theme.colors.text}>{input}</Text>
        <Text color={theme.colors.textSecondary}>█</Text>
      </Box>

      {/* Help overlay */}
      {showHelp && (
        <Box 
          width={50} 
          borderStyle="round" 
          borderColor={theme.colors.primary}
          padding={2}
        >
          <Box flexDirection="column">
            <Text color={theme.colors.primary} bold>Keyboard Shortcuts</Text>
            <Text>Enter - Send message/command</Text>
            <Text>Esc - Toggle this help</Text>
            <Text>Ctrl+C - Exit</Text>
            <Text></Text>
            <Text color={theme.colors.info} bold>Slash Commands</Text>
            <Text>/config - Configuration</Text>
            <Text>/theme - Change theme</Text>
            <Text>/agents - Manage agents</Text>
            <Text>/help - Show all commands</Text>
          </Box>
        </Box>
      )}

      {/* Status bar */}
      <Box justifyContent="space-between" padding={1}>
        <Text color={theme.colors.textSecondary}>
          {messages.length} messages
        </Text>
        <Text color={theme.colors.textSecondary}>
          Press Esc for help
        </Text>
      </Box>
    </Box>
  );
};