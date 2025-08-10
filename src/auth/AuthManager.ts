export interface AuthResult { token: string; provider: 'env'|'oauth'|'apiKey'; expiresAt?: number }

export class AuthManager {
  private token: AuthResult | null = null;

  async authenticateWithOAuth(): Promise<AuthResult> {
    // Try real OAuth if configured via environment; fallback to mock
    const clientId = process.env.CLI_OAUTH_CLIENT_ID;
    const clientSecret = process.env.CLI_OAUTH_CLIENT_SECRET;
    const authUrl = process.env.CLI_OAUTH_AUTH_URL;
    const tokenUrl = process.env.CLI_OAUTH_TOKEN_URL;
    const redirectUri = process.env.CLI_OAUTH_REDIRECT_URI || 'http://localhost:8765/callback';
    const scopes = (process.env.CLI_OAUTH_SCOPES || 'user:profile').split(/[ ,]+/);

    if (clientId && authUrl && tokenUrl) {
      const { OAuthManager } = await import('./OAuthManager.js');
      const om = new OAuthManager({ clientId, clientSecret, authUrl, tokenUrl, redirectUri, scopes, pkce: true });
      const url = await om.startAuthFlow();
      // In a real CLI, we would open the browser automatically; here we print URL
      // eslint-disable-next-line no-console
      console.log('Open this URL in your browser to authenticate:', url);
      // Wait for authenticated event
      const session = await new Promise<any>((resolve, reject) => {
        const onAuth = (s: any) => { om.removeListener('error', onErr); resolve(s); };
        const onErr = (e: any) => { om.removeListener('authenticated', onAuth); reject(e); };
        om.once('authenticated', onAuth);
        om.once('error', onErr);
      });
      const t: AuthResult = { token: session.tokens.accessToken, provider: 'oauth', expiresAt: session.tokens.expiresAt ? session.tokens.expiresAt.getTime() : undefined };
      this.token = t; return t;
    }

    const t: AuthResult = { token: `mock-oauth-${Date.now()}`, provider: 'oauth', expiresAt: Date.now() + 60 * 60 * 1000 };
    this.token = t; return t;
  }

  async authenticateWithAPIKey(key: string): Promise<AuthResult> {
    const t: AuthResult = { token: key, provider: 'apiKey' };
    this.token = t; return t;
  }

  async refreshAuthentication(): Promise<AuthResult> {
    if (!this.token) throw new Error('Not authenticated');
    const t: AuthResult = { token: `${this.token.token}-ref`, provider: this.token.provider, expiresAt: Date.now() + 60 * 60 * 1000 };
    this.token = t; return t;
  }

  async getValidToken(): Promise<string> {
    if (this.token && (!this.token.expiresAt || this.token.expiresAt > Date.now())) return this.token.token;
    // Env provider as fallback
    const ak = process.env.AWS_ACCESS_KEY_ID;
    const sk = process.env.AWS_SECRET_ACCESS_KEY;
    if (ak && sk) {
      const t: AuthResult = { token: `env:${ak}`, provider: 'env', expiresAt: Date.now() + 60 * 60 * 1000 };
      this.token = t; return t.token;
    }
    throw new Error('No valid token');
  }

  async isAuthenticated(): Promise<boolean> {
    try { await this.getValidToken(); return true; } catch { return false; }
  }

  async logout(): Promise<void> { this.token = null; }

  async getCurrentUser(): Promise<{ id: string; provider: string } | null> {
    if (!this.token) return null;
    return { id: this.token.token.slice(0, 12), provider: this.token.provider };
  }
}