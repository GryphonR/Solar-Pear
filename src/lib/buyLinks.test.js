import { describe, it, expect } from 'vitest';
import { resolveBuyLinks } from './buyLinks';
import { sanitizeBuyLinks } from './backupValidation';

const canonical = 'https://www.bimblesolar.com/victron-smartsolar-100-30';
const tracked = 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Fwww.bimblesolar.com%2Fx';

describe('resolveBuyLinks (roadmap 4.3)', () => {
    it('sends the user to the affiliateUrl and labels it, keeping the supplier name', () => {
        const [link] = resolveBuyLinks([
            { Supplier: 'Bimble Solar', URL: canonical, affiliateUrl: tracked, network: 'awin', isAffiliate: true },
        ]);
        expect(link).toMatchObject({ supplier: 'Bimble Solar', url: tracked, isAffiliate: true });
    });

    it('discloses an affiliateUrl even when isAffiliate was left off', () => {
        const [link] = resolveBuyLinks([{ Supplier: 'S', URL: canonical, affiliateUrl: tracked }]);
        expect(link.isAffiliate).toBe(true);
    });

    it('uses the canonical URL for an ordinary link', () => {
        const [link] = resolveBuyLinks([{ Supplier: 'Segen', URL: 'https://www.segen.co.uk/p/a', isAffiliate: false }]);
        expect(link).toMatchObject({ url: 'https://www.segen.co.uk/p/a', isAffiliate: false });
    });

    it('falls back to the canonical URL, unlabelled, when the affiliateUrl is unsafe', () => {
        const [link] = resolveBuyLinks([{ Supplier: 'S', URL: canonical, affiliateUrl: 'javascript:alert(1)' }]);
        expect(link).toMatchObject({ url: canonical, isAffiliate: false });
    });

    it('drops entries with no safe URL and reads the legacy object format', () => {
        expect(resolveBuyLinks([{ Supplier: 'Bad', URL: 'javascript:evil()' }, null])).toEqual([]);
        expect(resolveBuyLinks({ Shop: canonical, Bad: 'data:x' })).toEqual([
            { key: `0-Shop-${canonical}`, supplier: 'Shop', url: canonical, isAffiliate: false },
        ]);
        expect(resolveBuyLinks(undefined)).toEqual([]);
    });
});

describe('sanitizeBuyLinks with affiliate URLs', () => {
    it('keeps a safe affiliateUrl and removes an unsafe one', () => {
        const [good, bad] = sanitizeBuyLinks([
            { Supplier: 'A', URL: canonical, affiliateUrl: tracked },
            { Supplier: 'B', URL: canonical, affiliateUrl: 'javascript:evil()' },
        ]);
        expect(good.affiliateUrl).toBe(tracked);
        expect(bad).not.toHaveProperty('affiliateUrl');
        expect(bad.URL).toBe(canonical);
    });
});
