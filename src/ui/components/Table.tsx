import React from 'react';
import { Box, Text } from 'ink';

interface TableColumn {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

interface TableProps {
  columns: TableColumn[];
  data: Record<string, any>[];
  headerColor?: string;
  borderColor?: string;
  showBorder?: boolean;
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  headerColor = 'blue',
  borderColor = 'gray',
  showBorder = true
}) => {
  const getColumnWidth = (column: TableColumn): number => {
    if (column.width) return column.width;
    
    // Auto-calculate width based on content
    const headerWidth = column.title.length;
    const maxDataWidth = Math.max(
      ...data.map(row => String(row[column.key] || '').length),
      0
    );
    return Math.max(headerWidth, maxDataWidth, 8);
  };

  const formatCell = (content: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string => {
    const trimmed = content.slice(0, width);
    const padded = trimmed.padEnd(width);
    
    switch (align) {
      case 'center':
        const leftPad = Math.floor((width - trimmed.length) / 2);
        const rightPad = width - trimmed.length - leftPad;
        return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
      case 'right':
        return trimmed.padStart(width);
      default:
        return padded;
    }
  };

  const renderBorder = (widths: number[]): string => {
    return '├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
  };

  const columnWidths = columns.map(getColumnWidth);

  return (
    <Box flexDirection="column">
      {/* Top border */}
      {showBorder && (
        <Text color={borderColor}>
          ┌{columnWidths.map(w => '─'.repeat(w + 2)).join('┬')}┐
        </Text>
      )}

      {/* Header */}
      <Box>
        {showBorder && <Text color={borderColor}>│ </Text>}
        {columns.map((column, index) => (
          <React.Fragment key={column.key}>
            <Text color={headerColor} bold>
              {formatCell(column.title, columnWidths[index], column.align)}
            </Text>
            {showBorder && index < columns.length - 1 && <Text color={borderColor}> │ </Text>}
          </React.Fragment>
        ))}
        {showBorder && <Text color={borderColor}> │</Text>}
      </Box>

      {/* Header separator */}
      {showBorder && (
        <Text color={borderColor}>
          {renderBorder(columnWidths)}
        </Text>
      )}

      {/* Data rows */}
      {data.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {showBorder && <Text color={borderColor}>│ </Text>}
          {columns.map((column, colIndex) => (
            <React.Fragment key={column.key}>
              <Text>
                {formatCell(String(row[column.key] || ''), columnWidths[colIndex], column.align)}
              </Text>
              {showBorder && colIndex < columns.length - 1 && <Text color={borderColor}> │ </Text>}
            </React.Fragment>
          ))}
          {showBorder && <Text color={borderColor}> │</Text>}
        </Box>
      ))}

      {/* Bottom border */}
      {showBorder && (
        <Text color={borderColor}>
          └{columnWidths.map(w => '─'.repeat(w + 2)).join('┴')}┘
        </Text>
      )}
    </Box>
  );
};




