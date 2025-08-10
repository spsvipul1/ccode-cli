import { describe, it, expect } from 'vitest';
import { DefaultPermissionResolver } from '../src/permissions/PermissionResolver';
describe('PermissionResolver', () => {
    const resolver = new DefaultPermissionResolver();
    const tools = ['fs.read', 'fs.write', 'bash.run', 'web.fetch'];
    it('applies precedence CLI > project > user > defaults', () => {
        const out = resolver.resolve({
            toolUniverse: tools,
            defaults: { allow: ['*'], defaultMode: 'allow' },
            user: { deny: ['bash.run'] },
            project: { allow: ['bash.run'] },
            cli: { deny: ['bash.run'] }
        });
        expect(out.reasons['bash.run'].source).toBe('cli');
        expect(out.reasons['bash.run'].decision).toBe('deny');
    });
    it('denies over allow at same precedence', () => {
        const out = resolver.resolve({
            toolUniverse: tools,
            defaults: { allow: ['bash.run'], deny: ['bash.run'], defaultMode: 'prompt' }
        });
        expect(out.reasons['bash.run'].source).toBe('defaults');
        expect(out.reasons['bash.run'].decision).toBe('deny');
    });
    it('wildcards: exact outranks subtree, subtree outranks *', () => {
        const out = resolver.resolve({
            toolUniverse: tools,
            defaults: { allow: ['*', 'fs.*'], deny: ['fs.read'] }
        });
        expect(out.reasons['fs.read'].decision).toBe('deny');
        expect(out.reasons['fs.write'].decision).toBe('allow');
        expect(out.reasons['web.fetch'].decision).toBe('allow');
    });
    it('produces reasons map for each tool', () => {
        const out = resolver.resolve({
            toolUniverse: tools,
            defaults: { defaultMode: 'prompt' }
        });
        for (const t of tools) {
            expect(out.reasons[t]).toBeTruthy();
            expect(['allow', 'deny', 'prompt']).toContain(out.reasons[t].decision);
        }
    });
    it('bypassPermissions allows everything', () => {
        const out = resolver.resolve({
            toolUniverse: tools,
            cli: { bypassPermissions: true }
        });
        expect(out.allowedTools.sort()).toEqual(tools.sort());
        expect(out.promptsRequired.length).toBe(0);
    });
});
