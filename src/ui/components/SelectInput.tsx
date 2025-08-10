import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

interface SelectInputProps {
  options: SelectOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  selectedColor?: string;
  unselectedColor?: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  options,
  onSelect,
  placeholder = 'Select an option',
  selectedColor = 'blue',
  unselectedColor = 'gray'
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
    return <Text color="gray">{placeholder}</Text>;
  }

  return (
    <Box flexDirection="column">
      {options.map((option, index) => (
        <Box key={option.value} flexDirection="column">
          <Box>
            <Text color={index === selectedIndex ? selectedColor : unselectedColor}>
              {index === selectedIndex ? '▶ ' : '  '}
              {option.label}
            </Text>
          </Box>
          {option.description && index === selectedIndex && (
            <Box marginLeft={4}>
              <Text color="gray" dimColor>
                {option.description}
              </Text>
            </Box>
          )}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ↑↓ to navigate, Enter to select
        </Text>
      </Box>
    </Box>
  );
};
