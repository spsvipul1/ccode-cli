import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Conversation, type Event } from '../src/ui/Conversation';

async function* makeStream(): AsyncIterable<Event> {
  yield { token: { text: 'Hello' } };
  yield { token: { text: ' world' } };
  yield { notification: { level: 'info', message: 'ok' } };
}

describe('Conversation UI', () => {
  it('renders streamed tokens and notifications', async () => {
    const { lastFrame, rerender } = render(<Conversation stream={makeStream()} />);
    // Let the async iterator push some events
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain('Hello world');
    expect(lastFrame()).toMatch(/INFO: ok/);
    // Rerender no-op
    rerender(<Conversation stream={makeStream()} />);
  });
});