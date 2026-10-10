import { describe, it, expect } from 'vitest';
import {
    applyAffiliateRules,
    applyAffiliateRulesToCatalogue,
    buildAffiliateUrl,
    findProgramme,
    validateAffiliateConfig,
} from './affiliateLinks';
import { resolveBuyLinks } from './buyLinks';
import affiliates from '../data/affiliates.json';

const awin = {
    network: 'awin',
    template: 'https://www.awin1.com/cread.php?awinmid=111&awinaffid=222&ued={url}',
};
const amazon = { network: 'amazon', params: { tag: 'solarpear-21' } };
const programmes = {
    'bimblesolar.com': awin,
    'amazon.co.uk': amazon,
    'renogy.com': { ...awin, template: 'https://www.awin1.com/cread.php?awinmid=333&awinaffid=222&ued={url}' },
    'voltaconsolar.com': { ...awin, network: 'paid-on-results', enabled: false },
};

const product = 'https://www.bimblesolar.com/victron-smartsolar-100-30?variant=2';

describe('findProgramme', () => {
    it('matches the domain without www, and parent domains', () => {
        expect(findProgramme(product, programmes)).toBe(awin);
        expect(findProgramme('https://uk.renogy.com/rover-40a', programmes)).toBe(programmes['renogy.com']);
    });

    it('ignores disabled programmes, other domains and bad URLs', () => {
        expect(findProgramme('https://www.voltaconsolar.com/p', programmes)).toBeNull();
        expect(findProgramme('https://www.segen.co.uk/p', programmes)).toBeNull();
        expect(findProgramme('https://notbimblesolar.com/p', programmes)).toBeNull();
        expect(findProgramme('not a url', programmes)).toBeNull();
    });
});

describe('buildAffiliateUrl', () => {
    it('fills a deeplink template with the encoded product URL', () => {
        expect(buildAffiliateUrl(product, awin)).toBe(
            `https://www.awin1.com/cread.php?awinmid=111&awinaffid=222&ued=${encodeURIComponent(product)}`
        );
    });

    it('adds query parameters to the product URL, keeping its own', () => {
        expect(buildAffiliateUrl('https://www.amazon.co.uk/dp/B07?th=1', amazon)).toBe(
            'https://www.amazon.co.uk/dp/B07?th=1&tag=solarpear-21'
        );
    });

    it('refuses unusable input', () => {
        expect(buildAffiliateUrl('javascript:alert(1)', awin)).toBeNull();
        expect(buildAffiliateUrl(product, { network: 'x' })).toBeNull();
        expect(buildAffiliateUrl('http://www.amazon.co.uk/dp/B07', amazon)).toBeNull(); // not https
    });
});

describe('applyAffiliateRules', () => {
    const links = [
        { Supplier: 'Bimble Solar', URL: product, isAffiliate: false, Checked: true },
        { Supplier: 'Segen', URL: 'https://www.segen.co.uk/p', isAffiliate: false, Checked: false },
    ];

    it('adds affiliateUrl, network and isAffiliate on a matching domain only', () => {
        const out = applyAffiliateRules(links, programmes);
        expect(out[0]).toEqual({
            ...links[0],
            affiliateUrl: buildAffiliateUrl(product, awin),
            network: 'awin',
            isAffiliate: true,
        });
        expect(out[1]).toBe(links[1]);
        expect(links[0]).not.toHaveProperty('affiliateUrl'); // input untouched
    });

    it('keeps an affiliateUrl written by hand', () => {
        const manual = { ...links[0], affiliateUrl: 'https://track.example.com/x', network: 'in-house', isAffiliate: true };
        expect(applyAffiliateRules([manual], programmes)[0]).toBe(manual);
    });

    it('returns the same array when nothing applies', () => {
        expect(applyAffiliateRules(links, {})).toBe(links);
        expect(applyAffiliateRules([links[1]], programmes)).toEqual([links[1]]);
        expect(applyAffiliateRules(undefined, programmes)).toBeUndefined();
    });

    it('produces links the buy button sends users to and labels', () => {
        const [link] = resolveBuyLinks(applyAffiliateRules(links, programmes));
        expect(link).toMatchObject({ url: buildAffiliateUrl(product, awin), isAffiliate: true });
    });

    it('keeps catalogue items that have no matching links as the same objects', () => {
        const items = [{ model: 'A', buyLinks: links }, { model: 'B', buyLinks: [links[1]] }, { model: 'C' }];
        const out = applyAffiliateRulesToCatalogue(items, programmes);
        expect(out[0]).not.toBe(items[0]);
        expect(out[0].buyLinks[0].isAffiliate).toBe(true);
        expect(out[2]).toBe(items[2]);
    });
});

describe('validateAffiliateConfig', () => {
    it('accepts the shipped affiliates.json', () => {
        expect(validateAffiliateConfig(affiliates)).toEqual([]);
    });

    it('accepts well-formed template and params programmes', () => {
        expect(validateAffiliateConfig({ programmes })).toEqual([]);
    });

    it('reports malformed programmes', () => {
        const bad = validateAffiliateConfig({
            programmes: {
                'www.shop.com': awin,
                'a.com': { template: awin.template },
                'b.com': { network: 'awin', template: 'https://x.com/?ued={url}', params: { a: 'b' } },
                'c.com': { network: 'awin', template: 'http://x.com/?ued={url}' },
                'd.com': { network: 'awin', template: 'https://x.com/?id=1' },
                'e.com': { network: 'awin', template: 'https://x.com/?mid={awinmid}&ued={url}' },
                'f.com': { network: 'amazon', params: { tag: '' } },
                'g.com': { network: 'awin', enabled: 'yes', params: { tag: 'x' } },
            },
        });
        const text = bad.join('\n');
        for (const domain of ['www.shop.com', 'a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com', 'g.com']) {
            expect(text).toContain(`programmes["${domain}"]`);
        }
        expect(validateAffiliateConfig({})).toHaveLength(1);
    });
});
