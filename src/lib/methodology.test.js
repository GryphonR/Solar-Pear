import { describe, it, expect } from 'vitest';
import engineSource from './arrayAnalysis.js?raw';
import { CHECKS, DOCUMENTED_CODES, DESIGN_ASSUMPTIONS } from './methodology';
import { COLD_TEMP_C, VOC_WARN_FRACTION } from './arrayAnalysis';

/** Issue codes the engine can emit, read from its source: `add('code', …)` and `code: 'code'`. */
function engineCodes() {
    const codes = new Set();
    for (const m of engineSource.matchAll(/\badd\(\s*'([A-Za-z]+)'/g)) codes.add(m[1]);
    for (const m of engineSource.matchAll(/\bcode:\s*'([A-Za-z]+)'/g)) codes.add(m[1]);
    return codes;
}

describe('methodology page (roadmap 6.5)', () => {
    it('documents every check code the engine emits', () => {
        const codes = engineCodes();
        expect(codes.size).toBeGreaterThan(10);
        const missing = [...codes].filter((c) => !DOCUMENTED_CODES.has(c));
        expect(missing).toEqual([]);
    });

    it('does not document codes the engine no longer emits', () => {
        const codes = engineCodes();
        const stale = [...DOCUMENTED_CODES].filter((c) => !codes.has(c));
        expect(stale).toEqual([]);
    });

    it('reads thresholds from the engine constants', () => {
        expect(DESIGN_ASSUMPTIONS[0].value).toBe(`${COLD_TEMP_C} °C`);
        const margin = CHECKS.find((c) => c.codes.includes('vocMargin'));
        expect(margin.rule).toContain(`${Math.round(VOC_WARN_FRACTION * 100)}%`);
    });
});
