import { describe, it, expect } from 'vitest';
import './setup.js';

describe('Package visibility', () => {
    it('resolves package exports via package name', async () => {
        const mod = await import('@tak-ps/node-tak');
        expect(mod).toBeTruthy();
        expect(mod.default).toBeTruthy();
        expect(typeof mod.default.connect).toBe('function');
        expect(typeof mod.TAKAPI?.init).toBe('function');
    });
});
