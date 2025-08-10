import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManagerImpl } from '../src/core/ConfigManager';
describe('ConfigManager', () => {
    const mgr = new ConfigManagerImpl();
    const envBackup = process.env;
    beforeEach(() => {
        process.env = { ...envBackup };
        delete process.env.CLAUDE_CODE_TELEMETRY;
        delete process.env.CLAUDE_CODE_BYPASS_PERMISSIONS;
    });
    it('merges precedence defaults < user < project < cli', async () => {
        const out = await mgr.merge({
            defaults: { permissions: { allow: ['fs.*'] }, telemetry: { exporter: 'off' } },
            user: { permissions: { deny: ['bash.run'] } },
            project: { permissions: { allow: ['web.*'] } },
            cli: { permissions: { allow: ['bash.run'] }, telemetry: { exporter: 'prometheus' } }
        });
        expect(out.effective.permissions.allow).toContain('fs.*');
        expect(out.effective.permissions.allow).toContain('web.*');
        expect(out.effective.permissions.allow).toContain('bash.run');
        expect(out.effective.permissions.deny).toContain('bash.run');
        expect(out.effective.telemetry.exporter).toBe('prometheus');
    });
    it('applies env overlays', async () => {
        process.env.CLAUDE_CODE_TELEMETRY = 'otlp';
        process.env.CLAUDE_CODE_BYPASS_PERMISSIONS = 'true';
        const out = await mgr.merge({ defaults: {} });
        expect(out.effective.telemetry.exporter).toBe('otlp');
        expect(out.effective.permissions.bypass).toBe(true);
    });
    it('validates shape', () => {
        const ok = mgr.validate({ permissions: {}, telemetry: {}, ui: {}, tools: {}, http: {}, web: {}, memoryPolicy: {} });
        expect(ok.valid).toBe(true);
        const bad = mgr.validate({ permissions: 1 });
        expect(bad.valid).toBe(false);
    });
});
