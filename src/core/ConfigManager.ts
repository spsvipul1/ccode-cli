import type { ConfigManager } from "../interfaces";

type Json = any;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base: Json, override: Json): Json {
  if (!isObject(base)) return deepClone(override);
  const out: Record<string, unknown> = deepClone(base);
  if (isObject(override)) {
    for (const [k, v] of Object.entries(override)) {
      const bv = (out as any)[k];
      if (Array.isArray(bv) && Array.isArray(v)) {
        // Union arrays by string value
        const set = new Set<string>([...bv.map(String), ...v.map(String)]);
        (out as any)[k] = Array.from(set);
      } else if (isObject(bv) && isObject(v)) {
        (out as any)[k] = deepMerge(bv, v);
      } else {
        (out as any)[k] = deepClone(v);
      }
    }
  } else {
    return deepClone(override);
  }
  return out;
}

export class ConfigManagerImpl implements ConfigManager {
  async loadGlobalConfig(): Promise<Json> {
    // Stub; extend to read global defaults if needed
    return {};
  }
  async loadUserConfig(): Promise<Json> {
    // Stub; extend to read from user path
    return {};
  }
  async loadProjectConfig(_cwd: string): Promise<Json> {
    // Stub; extend to read from project path
    return {};
  }

  async merge(configs: { defaults: Json; user?: Json; project?: Json; cli?: Json }): Promise<Json> {
    const { defaults = {}, user = {}, project = {}, cli = {} } = configs;

    // Start with defaults, then user, project, then cli (highest precedence)
    const effective = [user, project, cli].reduce((acc, cur) => deepMerge(acc, cur), deepClone(defaults));

    // Apply environment overlays (selected keys per Playbook/API docs)
    const env = process.env;
    if (env.CLAUDE_CODE_TELEMETRY) {
      effective.telemetry = effective.telemetry ?? {};
      effective.telemetry.exporter = env.CLAUDE_CODE_TELEMETRY;
    }
    if (env.CLAUDE_CODE_BYPASS_PERMISSIONS) {
      effective.permissions = effective.permissions ?? {};
      // Represent as a convenience override flag in the effective tree
      (effective.permissions as any).bypass = env.CLAUDE_CODE_BYPASS_PERMISSIONS === 'true';
    }

    return { defaults, user, project, cli, effective };
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!isObject(config)) return { valid: false, errors: ['config must be an object'] };
    const c = config as Record<string, unknown>;

    if (c.permissions && !isObject(c.permissions)) errors.push('permissions must be an object');
    if (c.telemetry && !isObject(c.telemetry)) errors.push('telemetry must be an object');
    if (c.ui && !isObject(c.ui)) errors.push('ui must be an object');
    if (c.tools && !isObject(c.tools)) errors.push('tools must be an object');
    if (c.http && !isObject(c.http)) errors.push('http must be an object');
    if (c.web && !isObject(c.web)) errors.push('web must be an object');
    if (c.memoryPolicy && !isObject(c.memoryPolicy)) errors.push('memoryPolicy must be an object');

    return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
  }
}