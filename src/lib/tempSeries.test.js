import { describe, it, expect } from 'vitest';
import { computeTempSeries, buildTempRange } from './tempSeries';

describe('computeTempSeries', () => {
    const panel = {
        voc: 40,
        isc: 10,
        power: 400,
        tempCoefVoc: -0.3,
        tempCoefIsc: 0.05,
        tempCoefPmax: -0.35,
    };

    it('builds a continuous temperature range', () => {
        const temps = buildTempRange();
        expect(temps[0]).toBe(-40);
        expect(temps[temps.length - 1]).toBe(85);
    });

    it('computes series Voc at STC for valid wiring', () => {
        const { temps, vocSeries } = computeTempSeries(
            panel,
            { count: 4, parallelStrings: 1 },
            null,
            null
        );
        const idx25 = temps.indexOf(25);
        expect(vocSeries[idx25]).toBeCloseTo(40 * 4);
    });

    it('returns null electrical series for invalid wiring', () => {
        const { vocSeries, iscSeries } = computeTempSeries(
            panel,
            { count: 5, parallelStrings: 2 },
            null,
            null
        );
        expect(vocSeries).toBeNull();
        expect(iscSeries).toBeNull();
    });
});
