import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import { URL, URLSearchParams } from 'url';
import { randomBytes, createHash } from 'crypto';
import { fetch } from 'undici';

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
  pkce?: boolean;
  state?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  scope?: string;
  expiresAt?: Date;
}

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  organizations?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export interface OAuthSession {
  tokens: OAuthTokens;
  userInfo?: OAuthUserInfo;
  createdAt: Date;
  updatedAt: Date;
}

export class OAuthManager extends EventEmitter {
  private config: OAuthConfig;
  private session: OAuthSession | null = null;
  private server: Server | null = null;
  private codeVerifier?: string;
  private state?: string;

  constructor(config: OAuthConfig) {
    super();
    this.config = config;
  }

  async startAuthFlow(): Promise<string> {
    // Generate PKCE parameters if enabled
    if (this.config.pkce) {
      this.codeVerifier = this.generateCodeVerifier();
    }

    // Generate state parameter for CSRF protection
    this.state = this.config.state || this.generateState();

    // Build authorization URL
    const authUrl = new URL(this.config.authUrl);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: this.state
    });

    if (this.codeVerifier) {
      const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    authUrl.search = params.toString();

    // Start local server to handle callback
    await this.startCallbackServer();

    return authUrl.toString();
  }

  private async startCallbackServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.redirectUri);
      const port = parseInt(url.port) || 8080;

      this.server = createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url!, `http://localhost:${port}`);
          
          if (reqUrl.pathname === url.pathname) {
            const code = reqUrl.searchParams.get('code');
            const state = reqUrl.searchParams.get('state');
            const error = reqUrl.searchParams.get('error');

            if (error) {
              const errorDescription = reqUrl.searchParams.get('error_description');
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`<h1>Authentication Error</h1><p>${error}: ${errorDescription}</p>`);
              this.emit('error', new Error(`OAuth error: ${error} - ${errorDescription}`));
              return;
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication Error</h1><p>No authorization code received</p>');
              this.emit('error', new Error('No authorization code received'));
              return;
            }

            if (state !== this.state) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication Error</h1><p>Invalid state parameter</p>');
              this.emit('error', new Error('Invalid state parameter - possible CSRF attack'));
              return;
            }

            try {
              const tokens = await this.exchangeCodeForTokens(code);
              
              this.session = {
                tokens,
                createdAt: new Date(),
                updatedAt: new Date()
              };

              // Fetch user info if possible
              try {
                this.session.userInfo = await this.fetchUserInfo(tokens.accessToken);
              } catch (userInfoError) {
                // User info fetch failed - that's okay, we still have tokens
                console.warn('Failed to fetch user info:', userInfoError);
              }

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <h1>Authentication Successful</h1>
                <p>You can now close this window and return to the CLI.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              `);

              this.emit('authenticated', this.session);
              
            } catch (tokenError) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(`<h1>Authentication Error</h1><p>Failed to exchange code for tokens</p>`);
              this.emit('error', tokenError);
            }
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Not Found</h1>');
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Internal Server Error</h1>');
          this.emit('error', error);
        } finally {
          // Close server after handling the callback
          setTimeout(() => this.stopCallbackServer(), 1000);
        }
      });

      this.server.on('error', reject);
      
      this.server.listen(port, 'localhost', () => {
        resolve();
      });
    });
  }

  private stopCallbackServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    if (this.codeVerifier) {
      params.append('code_verifier', this.codeVerifier);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json() as any;

    if (tokenData.error) {
      throw new Error(`Token exchange error: ${tokenData.error} - ${tokenData.error_description}`);
    }

    const tokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    };

    if (tokens.expiresIn) {
      tokens.expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    }

    return tokens;
  }

  private async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // This is a generic implementation - specific providers may need custom logic
    const userInfoUrl = this.getUserInfoUrl();
    
    if (!userInfoUrl) {
      throw new Error('User info URL not configured');
    }

    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }

    const userData = await response.json() as any;

    return {
      id: userData.id || userData.sub,
      email: userData.email,
      name: userData.name || userData.display_name,
      picture: userData.picture || userData.avatar_url,
      organizations: userData.organizations || []
    };
  }

  private getUserInfoUrl(): string | null {
    // Provider-specific user info endpoints
    const authDomain = new URL(this.config.authUrl).hostname;
    
    if (authDomain.includes('anthropic.com')) {
      return 'https://api.anthropic.com/v1/me';
    }
    
    if (authDomain.includes('github.com')) {
      return 'https://api.github.com/user';
    }
    
    if (authDomain.includes('google.com') || authDomain.includes('googleapis.com')) {
      return 'https://www.googleapis.com/oauth2/v2/userinfo';
    }
    
    return null;
  }

  async refreshTokens(): Promise<OAuthTokens> {
    if (!this.session?.tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: this.session.tokens.refreshToken
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json() as any;

    const newTokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || this.session.tokens.refreshToken,
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    };

    if (newTokens.expiresIn) {
      newTokens.expiresAt = new Date(Date.now() + newTokens.expiresIn * 1000);
    }

    this.session.tokens = newTokens;
    this.session.updatedAt = new Date();

    this.emit('tokensRefreshed', newTokens);
    return newTokens;
  }

  async ensureValidTokens(): Promise<OAuthTokens> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const tokens = this.session.tokens;

    // Check if tokens are expired or will expire soon (5 minutes buffer)
    if (tokens.expiresAt && tokens.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      if (tokens.refreshToken) {
        return await this.refreshTokens();
      } else {
        throw new Error('Tokens expired and no refresh token available');
      }
    }

    return tokens;
  }

  async revokeTokens(): Promise<void> {
    if (!this.session) {
      return;
    }

    // Try to revoke the tokens if the provider supports it
    const revokeUrl = this.getRevokeUrl();
    
    if (revokeUrl) {
      try {
        const params = new URLSearchParams({
          token: this.session.tokens.accessToken,
          client_id: this.config.clientId
        });

        if (this.config.clientSecret) {
          params.append('client_secret', this.config.clientSecret);
        }

        await fetch(revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
      } catch (error) {
        // Revocation failed - that's okay, we'll clear local session anyway
        console.warn('Token revocation failed:', error);
      }
    }

    this.session = null;
    this.emit('revoked');
  }

  private getRevokeUrl(): string | null {
    const authDomain = new URL(this.config.authUrl).hostname;
    
    if (authDomain.includes('anthropic.com')) {
      return 'https://console.anthropic.com/v1/oauth/revoke';
    }
    
    if (authDomain.includes('github.com')) {
      return 'https://github.com/settings/connections/applications/' + this.config.clientId;
    }
    
    if (authDomain.includes('google.com') || authDomain.includes('googleapis.com')) {
      return 'https://oauth2.googleapis.com/revoke';
    }
    
    return null;
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateState(): string {
    return randomBytes(16).toString('hex');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = createHash('sha256');
    hash.update(verifier);
    return hash.digest('base64url');
  }

  getSession(): OAuthSession | null {
    return this.session;
  }

  isAuthenticated(): boolean {
    return this.session !== null;
  }

  getAccessToken(): string | null {
    return this.session?.tokens.accessToken || null;
  }

  getUserInfo(): OAuthUserInfo | null {
    return this.session?.userInfo || null;
  }

  setSession(session: OAuthSession): void {
    this.session = session;
    this.emit('sessionRestored', session);
  }

  clearSession(): void {
    this.session = null;
    this.emit('sessionCleared');
  }
}