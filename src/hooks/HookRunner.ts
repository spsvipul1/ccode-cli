type HookHandler = (payload: unknown) => Promise<{ exitCode: number; stdout?: string; stderr?: string }>;

interface RegisteredHook {
  matcher?: Record<string, unknown>;
  handler: HookHandler;
}

export class HookRegistry {
  private registry = new Map<string, RegisteredHook[]>();

  register(event: string, handler: HookHandler, matcher?: Record<string, unknown>) {
    const list = this.registry.get(event) ?? [];
    list.push({ handler, matcher });
    this.registry.set(event, list);
  }

  getHandlers(event: string): RegisteredHook[] {
    return this.registry.get(event) ?? [];
  }
}

export class HookRunner {
  constructor(private registry: HookRegistry) {}

  async run(event: string, payload: unknown): Promise<{ exitCode: number; stdout?: string; stderr?: string }> {
    const handlers = this.registry.getHandlers(event);
    for (const { handler } of handlers) {
      const result = await handler(payload);
      if (result.exitCode !== 0) {
        // Stop on first non-zero
        return result;
      }
    }
    return { exitCode: 0 };
  }
}