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

    it('uses a lighter weight range for flexible panels, which cannot be GSE-compatible', () => {
        expect(checkPanels([{ ...goodPanel, weight: 2 }]).map((f) => f.rule)).toContain('weight');
        const flex = { ...goodPanel, flexible: true, weight: 2, gseCompatibility: 'None' };
        expect(checkPanels([flex])).toEqual([]);
        expect(rules(checkPanels([{ ...flex, weight: 12 }]))).toContain('warning:weight');
        expect(rules(checkPanels([{ ...flex, gseCompatibility: 'Both' }]))).toContain('error:flexible-gse');
    });

    it('warns when a discontinued note is set without the discontinued flag', () => {
        expect(checkPanels([{ ...goodPanel, discontinued: true, discontinuedNote: 'No longer made' }])).toEqual([]);
        expect(rules(checkPanels([{ ...goodPanel, discontinuedNote: 'No longer made' }]))).toContain('warning:discontinued-note');
    });

    it('flags duplicate ids and non-production links', () => {
        const f = checkPanels([
            goodPanel,
            { ...goodPanel, buyLinks: [{ Supplier: 'x', URL: 'https://dev.shop.example.com/p' }] },
        ]);
        expect(rules(f)).toEqual(expect.arrayContaining(['error:duplicate-id', 'error:url-non-production']));
    });

    it('checks the buy link entry fields (roadmap 4.3)', () => {
        const link = { Supplier: 'Shop', URL: 'https://shop.example.com/p', isAffiliate: false, Checked: true };
        const affiliate = {
            ...link,
            affiliateUrl: 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=x',
            network: 'awin',
            isAffiliate: true,
            price: 129.99,
            priceCheckedAt: '2026-10-01',
            inStock: true,
        };
        expect(checkPanels([{ ...goodPanel, buyLinks: [link, affiliate] }])).toEqual([]);

        const linkRules = (l) => rules(checkPanels([{ ...goodPanel, buyLinks: [l] }]));
        expect(linkRules({ ...link, isAffiliate: true })).toContain('error:buy-link-affiliate');
        expect(linkRules({ ...affiliate, isAffiliate: false })).toContain('error:buy-link-affiliate');
        expect(linkRules({ ...affiliate, affiliateUrl: 'http://aff.example.com/x' })).toContain('error:buy-link-affiliate-url');
        expect(linkRules({ ...affiliate, affiliateUrl: 'https://staging.aff.example.com/x' })).toContain('error:url-non-production');
        expect(linkRules({ ...link, network: 'awin' })).toContain('warning:buy-link-network');
        expect(linkRules({ ...link, price: '£10' })).toContain('error:buy-link-price');
        expect(linkRules({ ...link, priceCheckedAt: 'Oct 2026' })).toContain('error:buy-link-price-date');
        expect(linkRules({ ...link, inStock: 'yes' })).toContain('error:buy-link-in-stock');
    });

    it('flags battery charge current stored as PV current, and a bad MPPT window', () => {
        const f = checkControllers([{ ...goodController, maxOperatingI: 50, mpptRangeMax: 120 }]);
        expect(rules(f)).toEqual(expect.arrayContaining(['error:pv-current', 'error:mppt-range']));
    });

    it('checks per-tracker limits (mpptInputs)', () => {
        const c = { ...goodController, maxIsc: 20, maxOperatingI: 12, trackers: 2 };
        expect(checkControllers([{ ...c, mpptInputs: [{ maxIsc: 40, maxOperatingI: 22 }, {}] }])).toEqual([]);
        const bad = checkControllers([
            { ...c, mpptInputs: [{ maxIsc: 15, maxOperatingI: 30 }, { mpptRangeMax: 150 }, { maxIsc: 40 }] },
        ]);
        expect(rules(bad)).toEqual(
            expect.arrayContaining(['error:mppt-inputs', 'error:pv-current', 'error:mppt-range', 'warning:mppt-inputs'])
        );
        expect(rules(checkControllers([{ ...c, mpptInputs: [{ maxIsc: 40, bogus: 1 }] }]))).toContain('error:mppt-inputs');
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
