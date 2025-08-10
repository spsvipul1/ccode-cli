import { describe, it, expect, beforeEach } from 'vitest';
import { AuthManager } from '../src/auth/AuthManager';

describe('AuthManager', () => {
  const backup = process.env;
  beforeEach(() => {
    process.env = { ...backup };
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it('oauth mock flow', async () => {
    const am = new AuthManager();
    const res = await am.authenticateWithOAuth();
    expect(res.provider).toBe('oauth');
    expect(await am.isAuthenticated()).toBe(true);
  });

  it('env fallback', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
    process.env.AWS_SECRET_ACCESS_KEY = 'SECRET';
    const am = new AuthManager();
    const t = await am.getValidToken();
    expect(t.startsWith('env:')).toBe(true);
  });
});