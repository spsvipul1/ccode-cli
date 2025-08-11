import React from 'react';
import { Text as InkText, TextProps as InkTextProps } from 'ink';
import { useTheme } from '../themeContext.js';
import { resolveColor } from '../themes/index.js';

export interface TextProps extends InkTextProps {
  color?: string;
  backgroundColor?: string;
}

export const Text: React.FC<TextProps> = ({ color, backgroundColor, ...props }) => {
  const theme = useTheme();
  const resolvedColor = color ? resolveColor(color, theme) : undefined;
  const resolvedBg = backgroundColor ? resolveColor(backgroundColor, theme) : undefined;
  return <InkText {...props} color={resolvedColor} backgroundColor={resolvedBg} />;
};
