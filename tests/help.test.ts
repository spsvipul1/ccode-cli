import { describe, it, expect } from 'vitest';
import { getHelp } from '../src/commands/help';

describe('help command', () => {
  it('shows all commands', () => {
    const h = getHelp();
    expect(h).toContain('login');
    expect(h).toContain('edit');
    expect(h).toContain('help');
  });
  it('shows specific command', () => {
    const h = getHelp('edit');
    expect(h).toMatch(/edit <file>/);
  });
});