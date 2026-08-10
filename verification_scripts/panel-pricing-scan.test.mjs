import { describe, expect, it } from 'vitest';
import {
    extractPriceFromHtml,
    findPriceInJsonLd,
    isClearanceOrDamagedListing,
    isGoogleAggregatorLink,
    isPdfLink,
    isSoftErrorPageUrl,
    looksLikeSoftErrorHtml,
    needsPriceCheck,
    parsePriceText,
    priceLooksPlausible,
    stripTrackingParams,
    supplierDomain,
    titleLooksRelevant,
    upsertBuyLinkByDomain,
} from './panel-pricing-scan.js';

describe('parsePriceText', () => {
    it('parses a plain GBP price', () => {
        expect(parsePriceText('£199.99')).toBe(199.99);
    });

    it('strips thousands separators', () => {
        expect(parsePriceText('£1,234.56')).toBe(1234.56);
    });

    it('parses a bare number without a currency symbol', () => {
        expect(parsePriceText('249')).toBe(249);
    });

    it('returns null for text with no digits', () => {
        expect(parsePriceText('Contact for price')).toBeNull();
    });

    it('returns null for empty input', () => {
        expect(parsePriceText('')).toBeNull();
        expect(parsePriceText(undefined)).toBeNull();
    });
});

describe('findPriceInJsonLd', () => {
    it('reads price from a single Offer', () => {
        const node = { '@type': 'Product', offers: { '@type': 'Offer', price: '129.99' } };
        expect(findPriceInJsonLd(node)).toBe(129.99);
    });

    it('reads price from an array of offers', () => {
        const node = { offers: [{ price: '89.00' }, { price: '99.00' }] };
        expect(findPriceInJsonLd(node)).toBe(89);
    });

    it('reads price from priceSpecification', () => {
        const node = { offers: { priceSpecification: { price: '55.50' } } };
        expect(findPriceInJsonLd(node)).toBe(55.5);
    });

    it('unwraps an @graph array', () => {
        const node = { '@graph': [{ '@type': 'Article' }, { '@type': 'Product', offers: { price: '10' } }] };
        expect(findPriceInJsonLd(node)).toBe(10);
    });

    it('accepts an offer explicitly marked GBP', () => {
        const node = { offers: { price: '250.00', priceCurrency: 'GBP' } };
        expect(findPriceInJsonLd(node)).toBe(250);
    });

    it('rejects an offer explicitly marked in a non-GBP currency', () => {
        const node = { offers: { price: '250.00', priceCurrency: 'USD' } };
        expect(findPriceInJsonLd(node)).toBeNull();
    });

    it('skips a non-GBP offer but still finds a GBP one elsewhere in the array', () => {
        const node = { offers: [{ price: '199.00', priceCurrency: 'USD' }, { price: '229.00', priceCurrency: 'GBP' }] };
        expect(findPriceInJsonLd(node)).toBe(229);
    });

    it('returns null when nothing matches', () => {
        expect(findPriceInJsonLd({ '@type': 'Article' })).toBeNull();
        expect(findPriceInJsonLd(null)).toBeNull();
    });
});

describe('extractPriceFromHtml', () => {
    it('extracts price from a JSON-LD Product/Offer block', () => {
        const html = `
            <html><head>
            <script type="application/ld+json">
                { "@type": "Product", "offers": { "@type": "Offer", "price": "179.50", "priceCurrency": "GBP" } }
            </script>
            </head></html>
        `;
        expect(extractPriceFromHtml(html)).toBe(179.5);
    });

    it('falls back to an itemprop="price" meta tag when JSON-LD is absent', () => {
        const html = '<meta itemprop="price" content="219.00" />';
        expect(extractPriceFromHtml(html)).toBe(219);
    });

    it('falls back to an og:price:amount meta tag', () => {
        const html = '<meta property="og:price:amount" content="99.99" />';
        expect(extractPriceFromHtml(html)).toBe(99.99);
    });

    it('skips malformed JSON-LD blocks instead of throwing', () => {
        const html = `
            <script type="application/ld+json">{ not valid json </script>
            <meta itemprop="price" content="149.99" />
        `;
        expect(extractPriceFromHtml(html)).toBe(149.99);
    });

    it('rejects a JSON-LD offer explicitly priced in USD', () => {
        const html = `
            <script type="application/ld+json">
                { "@type": "Product", "offers": { "price": "199.99", "priceCurrency": "USD" } }
            </script>
        `;
        expect(extractPriceFromHtml(html)).toBeNull();
    });

    it('rejects a meta price tag paired with a non-GBP currency tag', () => {
        const html = `
            <meta itemprop="price" content="219.00" />
            <meta itemprop="priceCurrency" content="USD" />
        `;
        expect(extractPriceFromHtml(html)).toBeNull();
    });

    it('accepts a meta price tag with no currency tag at all', () => {
        // No currency asserted either way - treated as usable since the page was only
        // reached via an already GBP-confirmed shopping result.
        const html = '<meta itemprop="price" content="219.00" />';
        expect(extractPriceFromHtml(html)).toBe(219);
    });

    it('returns null when no price can be found', () => {
        expect(extractPriceFromHtml('<html><body>No price here</body></html>')).toBeNull();
    });
});

describe('isGoogleAggregatorLink', () => {
    it('flags Google\'s own shopping compare page', () => {
        expect(isGoogleAggregatorLink('https://www.google.com/search?ibp=oshop&q=%22X%22&udm=28')).toBe(true);
    });

    it('flags bare google.com and google.co.uk hosts', () => {
        expect(isGoogleAggregatorLink('https://google.com/something')).toBe(true);
        expect(isGoogleAggregatorLink('https://google.co.uk/something')).toBe(true);
    });

    it('does not flag a genuine merchant domain', () => {
        expect(isGoogleAggregatorLink('https://www.segen.co.uk/product/example')).toBe(false);
    });

    it('treats an unparseable URL as unusable (flagged)', () => {
        expect(isGoogleAggregatorLink('not a url')).toBe(true);
    });
});

describe('isPdfLink', () => {
    it('flags a direct .pdf URL', () => {
        expect(isPdfLink('https://example.com/datasheet.pdf')).toBe(true);
    });

    it('flags a .pdf URL with a query string', () => {
        expect(isPdfLink('https://example.com/datasheet.pdf?v=2')).toBe(true);
    });

    it('does not flag a normal product page', () => {
        expect(isPdfLink('https://example.com/products/panel-410w')).toBe(false);
    });

    it('treats an unparseable URL as unusable (flagged)', () => {
        expect(isPdfLink('not a url')).toBe(true);
    });
});

describe('stripTrackingParams', () => {
    it('drops a Google click-tracking query string', () => {
        expect(stripTrackingParams('https://example.com/product/123?srsltid=AfmBOo123')).toBe(
            'https://example.com/product/123'
        );
    });

    it('drops a UTM/affiliate-style query string', () => {
        expect(stripTrackingParams('https://example.com/p/panel?utm_source=google&utm_medium=cpc')).toBe(
            'https://example.com/p/panel'
        );
    });

    it('drops a URL fragment', () => {
        expect(stripTrackingParams('https://example.com/panel#reviews')).toBe('https://example.com/panel');
    });

    it('leaves a URL with no query string or fragment unchanged', () => {
        expect(stripTrackingParams('https://example.com/panel')).toBe('https://example.com/panel');
    });

    it('returns an unparseable URL unchanged rather than losing it', () => {
        expect(stripTrackingParams('not a url')).toBe('not a url');
    });
});

describe('supplierDomain', () => {
    it('strips www. and lowercases the hostname', () => {
        expect(supplierDomain('https://www.CityPlumbing.co.uk/p/panel/123')).toBe('cityplumbing.co.uk');
    });

    it('returns null for an unparseable URL', () => {
        expect(supplierDomain('not a url')).toBeNull();
    });
});

describe('upsertBuyLinkByDomain', () => {
    it('appends a link from a new supplier domain', () => {
        const buyLinks = [];
        const changed = upsertBuyLinkByDomain(buyLinks, {
            Supplier: 'segen.co.uk',
            URL: 'https://www.segen.co.uk/product/a',
            isAffiliate: false,
            Checked: false,
        });
        expect(changed).toBe(true);
        expect(buyLinks).toHaveLength(1);
    });

    it('replaces an existing link from the same domain with a different URL', () => {
        const buyLinks = [
            {
                Supplier: 'City Plumbing',
                URL: 'https://www.cityplumbing.co.uk/p/old-slug/p/1',
                isAffiliate: false,
                Checked: true,
            },
        ];
        const changed = upsertBuyLinkByDomain(buyLinks, {
            Supplier: 'cityplumbing.co.uk',
            URL: 'https://www.cityplumbing.co.uk/p/new-slug/p/1',
            isAffiliate: false,
            Checked: false,
        });
        expect(changed).toBe(true);
        expect(buyLinks).toHaveLength(1);
        expect(buyLinks[0].URL).toBe('https://www.cityplumbing.co.uk/p/new-slug/p/1');
    });

    it('is a no-op when the exact same URL is rediscovered', () => {
        const buyLinks = [
            {
                Supplier: 'City Plumbing',
                URL: 'https://www.cityplumbing.co.uk/p/panel/p/1',
                isAffiliate: false,
                Checked: true,
            },
        ];
        const changed = upsertBuyLinkByDomain(buyLinks, {
            Supplier: 'cityplumbing.co.uk',
            URL: 'https://www.cityplumbing.co.uk/p/panel/p/1',
            isAffiliate: false,
            Checked: false,
        });
        expect(changed).toBe(false);
        expect(buyLinks[0].Supplier).toBe('City Plumbing'); // left untouched
        expect(buyLinks[0].Checked).toBe(true);
    });

    it('does not replace a link from a different supplier domain', () => {
        const buyLinks = [
            {
                Supplier: 'segen.co.uk',
                URL: 'https://www.segen.co.uk/product/a',
                isAffiliate: false,
                Checked: false,
            },
        ];
        upsertBuyLinkByDomain(buyLinks, {
            Supplier: 'cityplumbing.co.uk',
            URL: 'https://www.cityplumbing.co.uk/p/panel/p/1',
            isAffiliate: false,
            Checked: false,
        });
        expect(buyLinks).toHaveLength(2);
    });
});

describe('isClearanceOrDamagedListing', () => {
    it('flags a "damaged panels" URL slug', () => {
        expect(
            isClearanceOrDamagedListing(
                'AIKO 460W All Black',
                'https://midsummerwholesale.co.uk/buy/damaged-panels/aiko-neostar-2s-460w-all-black'
            )
        ).toBe(true);
    });

    it('flags a clearance/b-grade title even on a normal-looking URL', () => {
        expect(isClearanceOrDamagedListing('AIKO 460W Panel - Clearance Stock', 'https://example.com/product/123')).toBe(true);
        expect(isClearanceOrDamagedListing('Trina 450W B-Grade Panel', 'https://example.com/product/456')).toBe(true);
    });

    it('does not flag a normal product listing', () => {
        expect(isClearanceOrDamagedListing('AIKO Neostar 2S 460W All Black', 'https://www.segen.co.uk/product/aiko-460w')).toBe(
            false
        );
    });
});

describe('isSoftErrorPageUrl', () => {
    it('flags City Plumbing\'s /error-500 soft-error path', () => {
        expect(isSoftErrorPageUrl('https://www.cityplumbing.co.uk/error-500')).toBe(true);
    });

    it('flags other /error-N paths', () => {
        expect(isSoftErrorPageUrl('https://example.com/error-404')).toBe(true);
    });

    it('does not flag a normal product URL', () => {
        expect(isSoftErrorPageUrl('https://www.cityplumbing.co.uk/p/ja-solar-460w-all-black-solar-panel/p/215132')).toBe(
            false
        );
    });
});

describe('looksLikeSoftErrorHtml', () => {
    it('flags City Plumbing-style soft-error markup', () => {
        const html =
            '<html><body><h1>Internal Server Error</h1><p>Something went wrong. Sorry about that.</p></body></html>';
        expect(looksLikeSoftErrorHtml(html)).toBe(true);
    });

    it('flags a title that is explicitly an error 500 page', () => {
        expect(looksLikeSoftErrorHtml('<html><head><title>Error 500</title></head><body></body></html>')).toBe(true);
    });

    it('does not flag a normal product page that happens to mention "sorry"', () => {
        const html = '<html><body><h1>JA Solar 460W</h1><p>Sorry, free delivery only over £50.</p></body></html>';
        expect(looksLikeSoftErrorHtml(html)).toBe(false);
    });
});

describe('titleLooksRelevant', () => {
    it('accepts a title mentioning both manufacturer and wattage', () => {
        const panel = { manufacturer: 'Maxeon', power: 410 };
        expect(titleLooksRelevant('Maxeon 3 410W Black Solar Panel', panel)).toBe(true);
    });

    it('rejects an unrelated product that happens to share SKU-like text', () => {
        // The real false positive this guards against: a "MAX-3" spray gun/airbrush listing
        // matching a search for the Maxeon "SPR-MAX3-410-BLK" panel.
        const panel = { manufacturer: 'Maxeon', power: 410 };
        expect(titleLooksRelevant('Wagner Control MAX-3 HVLP Paint Sprayer', panel)).toBe(false);
    });

    it('rejects a title with the right manufacturer but wrong wattage', () => {
        const panel = { manufacturer: 'Maxeon', power: 410 };
        expect(titleLooksRelevant('Maxeon 3 430W Black Solar Panel', panel)).toBe(false);
    });

    it('accepts a multi-word manufacturer when only one meaningful word is present', () => {
        const panel = { manufacturer: 'Victron Energy', power: 175 };
        expect(titleLooksRelevant('Victron 175W Solar Panel', panel)).toBe(true);
    });

    it('falls back to the full run-together name when every manufacturer word is short', () => {
        const panel = { manufacturer: 'Q Cells', power: 400 };
        expect(titleLooksRelevant('QCells Q.PEAK DUO 400W Solar Panel', panel)).toBe(true);
        expect(titleLooksRelevant('Some Other Brand 400W Solar Panel', panel)).toBe(false);
    });

    it('returns false for an empty title', () => {
        expect(titleLooksRelevant('', { manufacturer: 'Trina', power: 450 })).toBe(false);
    });
});

describe('priceLooksPlausible', () => {
    it('accepts a typical per-panel price', () => {
        expect(priceLooksPlausible(56.74, 410)).toBe(true);
    });

    it('rejects a bulk/pallet-sized price for a single panel', () => {
        // The real case this guards against: a 410W panel search once returned "£1664.08".
        expect(priceLooksPlausible(1664.08, 410)).toBe(false);
    });

    it('rejects an implausibly cheap price', () => {
        expect(priceLooksPlausible(2.5, 475)).toBe(false);
    });

    it('rejects a too-cheap price for a real panel (accessory/sample-priced mismatch)', () => {
        // The real case this guards against: a 510W panel search once returned "£29.82"
        // (£0.058/W) for a panel that actually costs around £110 (£0.216/W).
        expect(priceLooksPlausible(29.82, 510)).toBe(false);
    });

    it('accepts prices at the edge of the plausible range', () => {
        expect(priceLooksPlausible(0.08 * 400, 400)).toBe(true);
        expect(priceLooksPlausible(1.2 * 400, 400)).toBe(true);
    });

    it('is a no-op when wattage is unknown', () => {
        expect(priceLooksPlausible(1664.08, 0)).toBe(true);
        expect(priceLooksPlausible(1664.08, undefined)).toBe(true);
    });
});

describe('needsPriceCheck', () => {
    it('is true when never checked', () => {
        expect(needsPriceCheck({ price: 100, priceCheckedAt: '' })).toBe(true);
    });

    it('is true when there is no recorded price yet', () => {
        const today = new Date().toISOString().slice(0, 10);
        expect(needsPriceCheck({ price: 0, priceCheckedAt: today })).toBe(true);
    });

    it('is false when checked recently and a price exists', () => {
        const today = new Date().toISOString().slice(0, 10);
        expect(needsPriceCheck({ price: 199, priceCheckedAt: today })).toBe(false);
    });

    it('is true when the last check is older than the staleness window', () => {
        const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        expect(needsPriceCheck({ price: 199, priceCheckedAt: old })).toBe(true);
    });

    it('is true for an unparseable date', () => {
        expect(needsPriceCheck({ price: 199, priceCheckedAt: 'not-a-date' })).toBe(true);
    });
});
