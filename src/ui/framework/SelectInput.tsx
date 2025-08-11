import React, { useState } from 'react';
import { useInput } from 'ink';
import { Box } from './Box.js';
import { Text } from './Text.js';

interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

interface SelectInputProps {
  options: SelectOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  options,
  onSelect,
  placeholder = 'Select an option'
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(options[selectedIndex].value);
    }
  });

  if (options.length === 0) {
    return <Text color="textSecondary">{placeholder}</Text>;
  }

  return (
    <Box flexDirection="column">
      {options.map((option, index) => (
        <Box key={option.value} flexDirection="column">
          <Box>
            <Text color={index === selectedIndex ? 'primary' : 'text'}>
              {index === selectedIndex ? '▶ ' : '  '}
              {option.label}
            </Text>
          </Box>
          {option.description && index === selectedIndex && (
            <Box marginLeft={4}>
              <Text color="textSecondary" dimColor>
                {option.description}
              </Text>
            </Box>
          )}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="textSecondary" dimColor>
          Use ↑↓ to navigate, Enter to select
        </Text>
      </Box>
    </Box>
  );
};
