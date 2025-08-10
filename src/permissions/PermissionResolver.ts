import type { PermissionResolver } from "../interfaces";

export type Decision = 'allow' | 'deny' | 'prompt';

type ScopeName = 'cli' | 'project' | 'user' | 'defaults' | 'prompt';

interface ScopeConfig {
  allow?: string[];
  deny?: string[];
  defaultMode?: Decision;
}

interface CliScopeConfig {
  allow?: string[];
  deny?: string[];
  bypassPermissions?: boolean;
}

interface ResolveInput {
  defaults?: ScopeConfig;
  user?: ScopeConfig;
  project?: ScopeConfig;
  cli?: CliScopeConfig;
  toolUniverse: string[];
}

interface Reason {
  source: ScopeName;
  pattern: string;
  precedence: number;
  decision: Decision;
}

export class DefaultPermissionResolver implements PermissionResolver {
  resolve(input: ResolveInput) {
    const sources: { name: ScopeName; cfg?: ScopeConfig | CliScopeConfig }[] = [
      { name: 'cli', cfg: input.cli },
      { name: 'project', cfg: input.project },
      { name: 'user', cfg: input.user },
      { name: 'defaults', cfg: input.defaults }
    ];

    // Bypass short-circuit
    if (input.cli?.bypassPermissions) {
      return {
        allowedTools: [...input.toolUniverse],
        promptsRequired: [],
        reasons: Object.fromEntries(
          input.toolUniverse.map((t) => [t, { source: 'cli' as const, pattern: '*', precedence: 0, decision: 'allow' as const }])
        )
      };
    }

    const reasons: Record<string, Reason> = {};
    const allowedTools = new Set<string>();
    const promptsRequired = new Set<string>();

    for (const tool of input.toolUniverse) {
      const decision = this.resolveForTool(tool, sources);
      if (decision.decision === 'allow') allowedTools.add(tool);
      else if (decision.decision === 'prompt') promptsRequired.add(tool);
      reasons[tool] = decision;
    }

    return {
      allowedTools: [...allowedTools],
      promptsRequired: [...promptsRequired],
      reasons
    };
  }

  private resolveForTool(tool: string, sources: { name: ScopeName; cfg?: ScopeConfig | CliScopeConfig }[]): Reason {
    // Precedence: earlier in the array is higher precedence
    for (let precedence = 0; precedence < sources.length; precedence++) {
      const { name, cfg } = sources[precedence];
      if (!cfg) continue;
      const allowPatterns = (cfg as ScopeConfig).allow ?? (cfg as CliScopeConfig).allow ?? [];
      const denyPatterns = (cfg as ScopeConfig).deny ?? (cfg as CliScopeConfig).deny ?? [];

      const allowMatch = this.bestMatch(tool, allowPatterns);
      const denyMatch = this.bestMatch(tool, denyPatterns);

      if (allowMatch && denyMatch) {
        // deny beats allow at same precedence
        return { source: name, pattern: denyMatch, precedence, decision: 'deny' };
      }
      if (denyMatch) {
        return { source: name, pattern: denyMatch, precedence, decision: 'deny' };
      }
      if (allowMatch) {
        return { source: name, pattern: allowMatch, precedence, decision: 'allow' };
      }

      // No explicit match at this precedence; continue
      // If at final source and still no decision, apply defaultMode
      if (precedence === sources.length - 1) {
        const dm = (cfg as ScopeConfig).defaultMode ?? 'prompt';
        return { source: name, pattern: '', precedence, decision: dm };
      }
    }

    // Fallback safety (should not hit): prompt
    return { source: 'defaults', pattern: '', precedence: sources.length, decision: 'prompt' };
  }

  private bestMatch(tool: string, patterns: string[]): string | null {
    // Exact match outranks wildcard; name.* outranks *
    let exact: string | null = null;
    let subtree: string | null = null;
    let star: string | null = null;

    for (const pat of patterns) {
      if (pat === tool) exact = pat;
      else if (pat === '*') star = pat;
      else if (pat.endsWith('.*')) {
        const base = pat.slice(0, -2);
        if (tool === base || tool.startsWith(base + '.')) subtree = pat;
      }
    }
    return exact ?? subtree ?? star ?? null;
  }
}