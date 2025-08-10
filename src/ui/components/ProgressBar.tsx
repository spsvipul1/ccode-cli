import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  color?: string;
  showPercentage?: boolean;
  width?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  color = 'blue',
  showPercentage = true,
  width = 40
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  const filledWidth = Math.round((clampedValue / 100) * width);
  const emptyWidth = width - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return (
    <Box flexDirection="column">
      {label && <Text>{label}</Text>}
      <Box>
        <Text color={color}>{filled}</Text>
        <Text color="gray">{empty}</Text>
        {showPercentage && (
          <Text> {clampedValue.toFixed(1)}%</Text>
        )}
      </Box>
    </Box>
  );
};
