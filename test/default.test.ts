import { describe, it, expect } from 'vitest';
import './setup.js';
import TAK, { CoT } from '../index.js';

describe('Ensure Export', () => {
    it('exposes TAK and CoT', () => {
        expect(TAK).toBeTruthy();
        expect(CoT).toBeTruthy();
    });
});
