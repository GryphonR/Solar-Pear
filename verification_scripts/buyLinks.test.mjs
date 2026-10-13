import { describe, expect, it } from 'vitest';
import { isAffiliateLink, upsertBuyLinkByDomain } from './lib/buyLinks.js';
import { cleanExistingBuyLinks } from './lib/pricingScan.js';

// Roadmap 4.4: the pricing scan must never overwrite or drop an affiliate entry.

const affiliate = {
    Supplier: 'Bimble Solar',
    URL: 'https://www.bimblesolar.com/victron-smartsolar-100-30',
    affiliateUrl: 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Fwww.bimblesolar.com%2Fvictron-smartsolar-100-30',
    network: 'awin',
    isAffiliate: true,
    Checked: true,
};

describe('isAffiliateLink', () => {
    it('is true for an entry with an affiliateUrl or the isAffiliate flag', () => {
        expect(isAffiliateLink(affiliate)).toBe(true);
        expect(isAffiliateLink({ URL: 'https://a.example/p', affiliateUrl: 'https://aff.example/x' })).toBe(true);
        expect(isAffiliateLink({ URL: 'https://a.example/p', isAffiliate: true })).toBe(true);
    });

    it('is false for an ordinary entry, a blank affiliateUrl or no entry', () => {
        expect(isAffiliateLink({ URL: 'https://a.example/p', isAffiliate: false })).toBe(false);
        expect(isAffiliateLink({ URL: 'https://a.example/p', affiliateUrl: '  ' })).toBe(false);
        expect(isAffiliateLink(null)).toBe(false);
    });
});

describe('upsertBuyLinkByDomain with affiliate entries', () => {
    it('keeps an affiliate entry when the scan finds another URL on the same domain', () => {
        const buyLinks = [{ ...affiliate }];
        const changed = upsertBuyLinkByDomain(buyLinks, {
            Supplier: 'bimblesolar.com',
            URL: 'https://www.bimblesolar.com/smartsolar-mppt-100-30',
            isAffiliate: false,
            Checked: false,
        });
        expect(changed).toBe(false);
        expect(buyLinks).toEqual([affiliate]);
    });

    it('still adds a non-affiliate link from a different domain alongside it', () => {
        const buyLinks = [{ ...affiliate }];
        const changed = upsertBuyLinkByDomain(buyLinks, {
            Supplier: 'segen.co.uk',
            URL: 'https://www.segen.co.uk/product/a',
            isAffiliate: false,
            Checked: false,
        });
        expect(changed).toBe(true);
        expect(buyLinks).toHaveLength(2);
        expect(buyLinks[0]).toEqual(affiliate);
    });
});

describe('cleanExistingBuyLinks with affiliate entries', () => {
    it('leaves affiliate entries untouched while tidying ordinary ones', () => {
        const item = {
            buyLinks: [
                { ...affiliate, URL: `${affiliate.URL}?variant=2` },
                { Supplier: 'Segen', URL: 'https://www.segen.co.uk/p/a?srsltid=abc', isAffiliate: false, Checked: false },
            ],
        };
        cleanExistingBuyLinks(item);
        expect(item.buyLinks[0]).toEqual({ ...affiliate, URL: `${affiliate.URL}?variant=2` });
        expect(item.buyLinks[1].URL).toBe('https://www.segen.co.uk/p/a');
    });

    it('keeps the affiliate entry, not the ordinary one, when a domain has both', () => {
        const item = {
            buyLinks: [
                { Supplier: 'bimblesolar.com', URL: 'https://www.bimblesolar.com/other-page', isAffiliate: false, Checked: false },
                { ...affiliate },
            ],
        };
        expect(cleanExistingBuyLinks(item)).toBe(true);
        expect(item.buyLinks).toEqual([affiliate]);
    });

    it('does not drop an affiliate entry that a filter would remove from an ordinary link', () => {
        const pdfAffiliate = { ...affiliate, URL: 'https://www.bimblesolar.com/files/sheet.pdf' };
        const item = { buyLinks: [pdfAffiliate] };
        expect(cleanExistingBuyLinks(item)).toBe(false);
        expect(item.buyLinks).toEqual([pdfAffiliate]);
    });
});
