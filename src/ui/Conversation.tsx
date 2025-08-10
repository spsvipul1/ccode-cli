import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export type Event =
  | { token: { text: string; is_final?: boolean } }
  | { notification: { level: 'info'|'warn'|'error'; message: string } };

function renderLines(text: string) {
  const parts = text.split(/```/);
  if (parts.length === 1) return <Text>{text}</Text>;
  const nodes: React.ReactNode[] = [];
  for (let i=0; i<parts.length; i++) {
    if (i % 2 === 0) nodes.push(<Text key={`t-${i}`}>{parts[i]}</Text>);
    else nodes.push(
      <Box key={`c-${i}`} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>{parts[i]}</Text>
      </Box>
    );
  }
  return <>{nodes}</>;
}

export function Conversation({ stream }: { stream: AsyncIterable<Event> }) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for await (const ev of stream) {
        if (cancelled) break;
        if ('token' in ev) {
          setLines((prev) => [...prev, ev.token.text]);
        } else if ('notification' in ev) {
          setStatus(`${ev.notification.level.toUpperCase()}: ${ev.notification.message}`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [stream]);

  return (
    <Box flexDirection="column">
      <Box>
        {renderLines(lines.join(''))}
      </Box>
      <Box>
        <Text color="yellow">{status}</Text>
      </Box>
    </Box>
  );
}