import { describe, it, expect } from 'vitest';
import { submitFeedback } from '../src/commands/feedback';

describe('feedback command', () => {
  it('submits feedback and returns an id', async () => {
    const res = await submitFeedback('great tool', 'me@example.com');
    expect(res.ok).toBe(true);
    expect(res.id).toMatch(/^fb_/);
  });
});