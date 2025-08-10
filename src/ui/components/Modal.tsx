import React from 'react';
import { Box, Text } from 'ink';

interface ModalProps {
  title?: string;
  isOpen: boolean;
  onClose?: () => void;
  width?: number;
  height?: number;
  children: React.ReactNode;
  borderColor?: string;
  backgroundColor?: string;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  isOpen,
  onClose,
  width = 60,
  height = 20,
  children,
  borderColor = 'blue',
  backgroundColor = 'black'
}) => {
  if (!isOpen) return null;

  return (
    <Box 
      width={width}
      height={height}
      borderStyle="round"
      borderColor={borderColor}
      padding={1}
      flexDirection="column"
    >
      {/* Title bar */}
      {title && (
        <Box marginBottom={1} justifyContent="space-between">
          <Text color={borderColor} bold>{title}</Text>
          {onClose && (
            <Text color="red" bold>✕</Text>
          )}
        </Box>
      )}

      {/* Content */}
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press Esc to close
        </Text>
      </Box>
    </Box>
  );
};
