import React from 'react';
import { Box as InkBox, BoxProps as InkBoxProps } from 'ink';
import { useTheme } from '../themeContext.js';
import { resolveColor } from '../themes/index.js';

export interface BoxProps extends InkBoxProps {
  borderColor?: string;
  backgroundColor?: string;
}

export const Box: React.FC<BoxProps> = ({ borderColor, backgroundColor, ...props }) => {
  const theme = useTheme();
  const resolvedBorder = borderColor ? resolveColor(borderColor, theme) : undefined;
  const resolvedBg = backgroundColor ? resolveColor(backgroundColor, theme) : undefined;
  return <InkBox {...props} borderColor={resolvedBorder} backgroundColor={resolvedBg}>{props.children}</InkBox>;
};
