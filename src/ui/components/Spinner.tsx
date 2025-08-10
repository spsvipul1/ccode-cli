import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

interface SpinnerProps {
  type?: 'dots' | 'line' | 'bounce' | 'pulse';
  color?: string;
  text?: string;
}

const SPINNER_FRAMES = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '─', '\\'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  pulse: ['●', '○', '●', '○']
};

export const Spinner: React.FC<SpinnerProps> = ({
  type = 'dots',
  color = 'blue',
  text
}) => {
  const [frame, setFrame] = useState(0);
  const frames = SPINNER_FRAMES[type];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 100);

    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <Text color={color}>
      {frames[frame]} {text}
    </Text>
  );
};
