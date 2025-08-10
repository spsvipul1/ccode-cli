import React from 'react';
import { Box, Text } from 'ink';

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header';
  content: string;
  lineNumber?: number;
}

interface DiffViewProps {
  diff: string;
  showLineNumbers?: boolean;
  contextLines?: number;
}

export const DiffView: React.FC<DiffViewProps> = ({
  diff,
  showLineNumbers = true,
  contextLines = 3
}) => {
  const parseDiff = (diffText: string): DiffLine[] => {
    const lines = diffText.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
        return { type: 'header', content: line };
      } else if (line.startsWith('+')) {
        return { type: 'added', content: line.slice(1), lineNumber: index };
      } else if (line.startsWith('-')) {
        return { type: 'removed', content: line.slice(1), lineNumber: index };
      } else {
        return { type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, lineNumber: index };
      }
    });
  };

  const diffLines = parseDiff(diff);

  const getLineColor = (type: DiffLine['type']): string => {
    switch (type) {
      case 'added': return 'green';
      case 'removed': return 'red';
      case 'header': return 'blue';
      case 'context': return 'white';
      default: return 'white';
    }
  };

  const getLinePrefix = (type: DiffLine['type']): string => {
    switch (type) {
      case 'added': return '+';
      case 'removed': return '-';
      case 'header': return '';
      case 'context': return ' ';
      default: return ' ';
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Box marginBottom={1}>
        <Text color="blue" bold>Diff View</Text>
      </Box>
      
      {diffLines.map((line, index) => (
        <Box key={index}>
          {showLineNumbers && line.type !== 'header' && (
            <Text color="gray" dimColor>
              {String(index + 1).padStart(4)} │ 
            </Text>
          )}
          
          <Text color={getLineColor(line.type)} backgroundColor={
            line.type === 'added' ? 'greenBright' :
            line.type === 'removed' ? 'redBright' : undefined
          }>
            {getLinePrefix(line.type)}{line.content}
          </Text>
        </Box>
      ))}

      {diffLines.length === 0 && (
        <Text color="gray" dimColor>No differences found</Text>
      )}
    </Box>
  );
};
