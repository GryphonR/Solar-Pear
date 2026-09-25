import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkPanels, checkControllers, formatFindings } from './lib/sanityRules.js';
import { PANELS_DIR, CONTROLLERS_DIR } from './lib/paths.js';

const loadDir = (dir) =>
    fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));

const goodPanel = {
    model: 'P1',
    manufacturer: 'M',
    power: 400,
    voc: 37.5,
    vmp: 31.5,
    isc: 13.7,
    imp: 12.7,
    height: 1722,
    width: 1134,
    efficiency: 20.5,
    tempCoefVoc: -0.25,
    tempCoefPmax: -0.29,
    tempCoefIsc: 0.045,
    weight: 21,
    maxSystemVoltage: 1500,
    datasheetUrl: 'https://example.com/ds.pdf',
    buyLinks: [],
};

const goodController = {
    id: 'C1',
    manufacturer: 'M',
    type: 'charger',
    maxV: 100,
    maxIsc: 35,
    maxOperatingI: 0,
    maxChargeCurrent: 30,
    mpptRangeMin: 15,
    mpptRangeMax: 95,
    startupV: 5,
    trackers: 1,
    datasheetUrl: 'https://example.com/c.pdf',
    buyLinks: [],
};

const rules = (findings) => findings.map((f) => `${f.severity}:${f.rule}`);

describe('sanity rules', () => {
    it('passes a consistent panel and controller', () => {
        expect(checkPanels([goodPanel])).toEqual([]);
        expect(checkControllers([goodController])).toEqual([]);
    });

    it('flags impossible panel electricals as errors', () => {
        const f = checkPanels([{ ...goodPanel, voc: 30, imp: 14, tempCoefVoc: 0.1 }]);
        expect(rules(f)).toEqual(expect.arrayContaining(['error:voc-vmp', 'error:isc-imp', 'error:tempCoefVoc']));
    });

    it('flags cell efficiency quoted as module efficiency', () => {
        expect(rules(checkPanels([{ ...goodPanel, efficiency: 23 }]))).toContain('error:efficiency');
        expect(rules(checkPanels([{ ...goodPanel, efficiency: 21.3 }]))).toContain('warning:efficiency');
    });

    it('flags duplicate ids and non-production links', () => {
        const f = checkPanels([
            goodPanel,
            { ...goodPanel, buyLinks: [{ Supplier: 'x', URL: 'https://dev.shop.example.com/p' }] },
        ]);
        expect(rules(f)).toEqual(expect.arrayContaining(['error:duplicate-id', 'error:url-non-production']));
    });

    it('flags battery charge current stored as PV current, and a bad MPPT window', () => {
        const f = checkControllers([{ ...goodController, maxOperatingI: 50, mpptRangeMax: 120 }]);
        expect(rules(f)).toEqual(expect.arrayContaining(['error:pv-current', 'error:mppt-range']));
    });

    it('warns about chargers without a charge current or Isc rating', () => {
        const f = checkControllers([{ ...goodController, maxChargeCurrent: 0, maxIsc: 0 }]);
        expect(rules(f)).toEqual(expect.arrayContaining(['warning:charge-current', 'warning:max-isc']));
    });
});

describe('shipped catalogue', () => {
    it('has no sanity errors (run `npm run verify:sanity` for details and warnings)', () => {
        const findings = [...checkPanels(loadDir(PANELS_DIR)), ...checkControllers(loadDir(CONTROLLERS_DIR))];
        const errors = findings.filter((f) => f.severity === 'error');
        expect(formatFindings(errors)).toEqual([]);
    });
});
