/**
 * @file pricingQuality.test.mjs
 * Tests for the pricing scan's match, price and review rules. Most cases are taken from the
 * 2026-08 scan logs, where a wrong listing or a wrong price got through.
 */

import { describe, expect, it } from 'vitest';
import {
    conflictingVariant,
    controllerPriceBand,
    priceLooksPlausible as controllerPriceOk,
    titleLooksRelevant as controllerMatches,
} from './lib/controllerRelevance.js';
import {
    compact,
    containsIdentifier,
    isBundleOrAccessoryListing,
    isMarketplaceLink,
    quotesOtherOrderCode,
} from './lib/listingMatch.js';
import {
    priceRejectionReason,
    seriesPricePerWatt,
    titleLooksRelevant as panelMatches,
    wattageMentioned,
} from './lib/panelRelevance.js';
import { extractExVatDisplayPrice, extractPriceDetails, pageIdentityText, stockState } from './lib/priceExtract.js';
import {
    choosePrice,
    cleanExistingBuyLinks,
    findSharedPrices,
    formatReviewReport,
    needsPriceCheck,
    probeCandidate,
    recordBuyLink,
} from './lib/pricingScan.js';
import { chunk, consensusPrice, pickDistributorLinks, pickShoppingResult } from './lib/serper.js';

const aiko = (model, series) => ({ manufacturer: 'AIKO', model, power: 450, 'panel-series': series });
const aikoMb = aiko('AIKO-A450-MAH54Mb', 'NeoStar 2S');
const aikoMw = aiko('AIKO-A450-MAH54Mw', 'Neostar 2P');

describe('identifier matching', () => {
    it('ignores punctuation but keeps numbers apart', () => {
        expect(compact('JAM54D41-450/LB')).toBe(compact('jam54d41 450lb'));
        expect(containsIdentifier('ja solar jam54d41-450lb', 'JAM54D41-450/LB')).toBe(true);
        expect(containsIdentifier('smartsolar mppt 75/150', 'SmartSolar MPPT 75/15')).toBe(false);
        expect(containsIdentifier('panel 1450', '450')).toBe(false); // too short to count anyway
    });

    it('spots a different order code from the same family', () => {
        expect(quotesOtherOrderCode('victron mppt 15085 mc4 vecan scc115085511', 'SCC115085411')).toBe(true);
        expect(quotesOtherOrderCode('victron mppt 75/15 scc075015060', 'SCC075015060R')).toBe(false);
        expect(quotesOtherOrderCode('victron orion ori121217050', 'SCC075015060R')).toBe(false);
    });
});

describe('panel matching', () => {
    it('reads wattage only as a number of its own', () => {
        expect(wattageMentioned('ja solar 435w', 435)).toBe(true);
        expect(wattageMentioned('jam54s31-435/lr', 435)).toBe(true);
        expect(wattageMentioned('1435mm frame', 435)).toBe(false);
        expect(wattageMentioned('4350mah', 435)).toBe(false);
        expect(wattageMentioned('only £435', 435)).toBe(false);
    });

    it('needs the model when a sibling shares the wattage and series cannot tell them apart', () => {
        // 2026-08: the Mb and Mw were both priced £141.41 from one generic listing.
        expect(panelMatches('AIKO 450W All Black Solar Panel', aikoMw, { siblings: [aikoMb] })).toBe(false);
        expect(panelMatches('AIKO A450-MAH54Mw 450W', aikoMw, { siblings: [aikoMb] })).toBe(true);
    });

    it('rejects a listing that names a sibling model instead', () => {
        expect(panelMatches('AIKO AIKO-A450-MAH54Mb 450W', aikoMw, { siblings: [aikoMb] })).toBe(false);
    });

    it('accepts a distinctive series name, from the title or the URL', () => {
        expect(
            panelMatches('AIKO 450W All Black', aikoMb, {
                siblings: [aikoMw],
                url: 'https://www.segen.co.uk/product/aiko-neostar-2s-450w-all-black/',
            })
        ).toBe(true);
    });

    it('does not let a shorter series name pick out a panel from a longer sibling series', () => {
        const dv = { manufacturer: 'Jinko', model: 'JKM470N-48QL6-DV', power: 470, 'panel-series': 'Tiger Neo 3.0' };
        const bdv = { manufacturer: 'Jinko', model: 'JKM470N-48QL6-BDV', power: 470, 'panel-series': 'Tiger Neo 3.0 Bifacial' };
        expect(panelMatches('Jinko Tiger Neo 3.0 470W', dv, { siblings: [bdv] })).toBe(false);
        expect(panelMatches('Jinko Tiger Neo 3.0 Bifacial 470W', bdv, { siblings: [dv] })).toBe(true);
    });

    it('rejects our model when the title names a longer sibling model that contains it', () => {
        const plain = { manufacturer: 'Acme', model: 'AC-400M', power: 400 };
        const black = { manufacturer: 'Acme', model: 'AC-400M-BLK', power: 400 };
        expect(panelMatches('Acme AC-400M-BLK 400W', plain, { siblings: [black] })).toBe(false);
        expect(panelMatches('Acme AC-400M 400W', plain, { siblings: [black] })).toBe(true);
    });
});

describe('panel price bands', () => {
    it('uses a tighter ceiling for mainstream panels', () => {
        // 2026-08: £212.23 for a 540 W JA panel (£0.39/W) was accepted under the old £1.20/W cap.
        expect(priceRejectionReason(212.23, { manufacturer: 'JA Solar', power: 540 })).toBeNull();
        expect(priceRejectionReason(400, { manufacturer: 'JA Solar', power: 540 })).toMatch(/outside/);
    });

    it('allows premium and small panels more per watt', () => {
        expect(priceRejectionReason(295, { manufacturer: 'Maxeon', power: 425 })).toBeNull();
        expect(priceRejectionReason(130, { manufacturer: 'Renogy', power: 100 })).toBeNull();
        expect(priceRejectionReason(10, { manufacturer: 'Renogy', power: 100 })).toMatch(/outside/);
    });

    it('rejects a price far from the rest of its series', () => {
        const catalogue = [
            { manufacturer: 'AIKO', 'panel-series': 'NeoStar 2S', power: 460, price: 92 },
            { manufacturer: 'AIKO', 'panel-series': 'NeoStar 2S', power: 465, price: 95 },
            { manufacturer: 'AIKO', 'panel-series': 'Neostar 2S', power: 470, price: 97 },
        ];
        const panel = { manufacturer: 'AIKO', 'panel-series': 'NeoStar 2S', power: 450, price: 0 };
        const seriesPerWatt = seriesPricePerWatt(panel, catalogue);
        expect(seriesPerWatt).toBeCloseTo(0.204, 2);
        expect(priceRejectionReason(95, panel, { seriesPerWatt })).toBeNull();
        expect(priceRejectionReason(200, panel, { seriesPerWatt })).toMatch(/rest of its series/);
    });
});

describe('controller matching', () => {
    const victron = (name, modelNumber, extra = {}) => ({ manufacturer: 'Victron Energy', name, modelNumber, ...extra });

    it('rejects a listing quoting another order code (2026-08: 100/20 took the 48 V variant)', () => {
        const c = victron('SmartSolar MPPT 100/20', 'SCC110020060R');
        expect(
            controllerMatches('Victron SmartSolar MPPT 100/20', c, {
                url: 'https://www.tradesparky.com/victron/victron-smartsolar-mppt-10020-to-48v-scc110020160',
            })
        ).toBe(false);
    });

    it('rejects the MC4 variant for a Tr record, and vice versa', () => {
        const tr = victron('SmartSolar MPPT 150/85-Tr VE.Can', 'SCC115085411');
        expect(controllerMatches('Victron SmartSolar MPPT 150/85 MC4 VE.Can', tr)).toBe(false);
        expect(controllerMatches('Victron SmartSolar MPPT 150/85-Tr VE.Can', tr)).toBe(true);
        expect(conflictingVariant('smartsolar mppt 150/85 mc4', 'smartsolar mppt 150/85-tr')).toBe(true);
    });

    it('rejects an added VE.Can or GX that our record lacks', () => {
        const c = victron('SmartSolar MPPT 150/35', 'SCC115035210');
        expect(controllerMatches('Victron SmartSolar MPPT 150/35 VE.Can', c)).toBe(false);
    });

    it('rejects a rating that merely starts with ours', () => {
        const c = victron('SmartSolar MPPT 75/15', 'SCC075015060R');
        expect(controllerMatches('Victron SmartSolar MPPT 75/150', c)).toBe(false);
    });

    it('accepts the order code without its revision letter, and a run-together rating', () => {
        const c = victron('SmartSolar MPPT 75/15', 'SCC075015060R');
        expect(controllerMatches('Victron SmartSolar charge controller SCC075015060', c)).toBe(true);
        expect(controllerMatches('Victron SmartSolar MPPT 7515', c)).toBe(true);
    });

    it('rejects a sibling whose name contains ours', () => {
        const c = victron('SmartSolar MPPT 100/20', 'SCC110020060R');
        const sib = victron('SmartSolar MPPT 100/20-48V', 'SCC110020160R');
        expect(controllerMatches('Victron SmartSolar MPPT 100/20-48V', c, { siblings: [sib] })).toBe(false);
    });
});

describe('controller price bands', () => {
    it('scales charger bands with charge current (2026-08: the RS 450/200 at £1,458 was rejected)', () => {
        expect(controllerPriceBand({ type: 'charger', maxChargeCurrent: 200 })).toEqual({ min: 200, max: 2400 });
        expect(controllerPriceOk(1457.99, { type: 'charger', maxChargeCurrent: 200 }, { hasBuyLink: true })).toBe(true);
        expect(controllerPriceOk(39.98, { type: 'charger', maxChargeCurrent: 10 }, { hasBuyLink: true })).toBe(true);
        expect(controllerPriceOk(400, { type: 'charger', maxChargeCurrent: 10 }, { hasBuyLink: true })).toBe(false);
    });

    it('has bands for DC-DC chargers and inverter-chargers', () => {
        expect(controllerPriceOk(219.49, { type: 'dc-dc-charger' }, { hasBuyLink: true })).toBe(true);
        expect(controllerPriceOk(2500, { type: 'dc-dc-charger' }, { hasBuyLink: true })).toBe(false);
        expect(controllerPriceBand({ type: 'inverter_charger' }).min).toBe(250);
    });
});

describe('listing filters', () => {
    it('flags bundles, multipacks and pallets', () => {
        // 2026-08: the GivEnergy AC 3.0 was priced from an inverter + battery bundle.
        expect(
            isBundleOrAccessoryListing(
                'GivEnergy 3.0kW AC Coupled',
                'https://www.segen.co.uk/product/givenergy-3-0kw-ac-coupled-inverter-with-5-12kwh-battery-50-off-inverter-promotion/'
            )
        ).toBe(true);
        expect(isBundleOrAccessoryListing('JA Solar 435W x 36 panels pallet')).toBe(true);
        expect(isBundleOrAccessoryListing('Pack of 2 Trina 450W')).toBe(true);
        expect(isBundleOrAccessoryListing('10 x 450W Trina panels')).toBe(true);
    });

    it('flags accessories sold under the product name', () => {
        expect(isBundleOrAccessoryListing('Victron VE.Direct Bluetooth Smart Dongle')).toBe(true);
        expect(isBundleOrAccessoryListing('MC4 cable for Victron SmartSolar MPPT 100/30')).toBe(true);
    });

    it('leaves ordinary product titles alone', () => {
        expect(isBundleOrAccessoryListing('JA Solar 435W panel with MC4 connectors')).toBe(false);
        expect(isBundleOrAccessoryListing('SmartSolar MPPT 100/30 for lead acid and lithium batteries')).toBe(false);
        expect(isBundleOrAccessoryListing('Solis 5kW hybrid inverter with DC isolator')).toBe(false);
    });

    it('recognises marketplaces', () => {
        expect(isMarketplaceLink('https://www.ebay.co.uk/itm/123')).toBe(true);
        expect(isMarketplaceLink('https://www.amazon.co.uk/dp/B0')).toBe(true);
        expect(isMarketplaceLink('https://www.bimblesolar.com/x')).toBe(false);
    });

    it('drops marketplace links already on a record', () => {
        const item = {
            buyLinks: [
                { Supplier: 'eBay', URL: 'https://www.ebay.co.uk/itm/1', isAffiliate: false, Checked: false },
                { Supplier: 'Segen', URL: 'https://www.segen.co.uk/p/a', isAffiliate: false, Checked: false },
            ],
        };
        expect(cleanExistingBuyLinks(item)).toBe(true);
        expect(item.buyLinks.map((l) => l.Supplier)).toEqual(['Segen']);
    });
});

describe('shopping consensus', () => {
    it('drops outliers and takes the median of the rest', () => {
        const c = consensusPrice([92, 95, 90, 212, 30]);
        expect(c.price).toBe(92);
        expect(c.outliers.sort()).toEqual([212, 30].sort());
        expect(c.agreeing).toBe(3);
    });

    it('uses every relevant listing, not just the first, and skips marketplaces and bundles', () => {
        const relevant = (title) => title.includes('A450-MAH54Mb');
        const results = [
            { title: 'AIKO A450-MAH54Mb', price: '£141.41', source: 'Shop A', link: 'https://www.google.com/x' },
            { title: 'AIKO A450-MAH54Mb', price: '£92.00', source: 'Shop B', link: 'https://shopb.example/p' },
            { title: 'AIKO A450-MAH54Mb', price: '£95.00', source: 'Shop C', link: 'https://shopc.example/p' },
            { title: 'AIKO A450-MAH54Mb', price: '£90.00', source: 'eBay', link: 'https://www.ebay.co.uk/itm/1' },
            { title: 'AIKO A450-MAH54Mb pallet of 36', price: '£3,000', source: 'Shop D', link: 'https://shopd.example/p' },
            { title: 'Something else', price: '£10', source: 'Shop E', link: 'https://shope.example/p' },
        ];
        const picked = pickShoppingResult(results, aikoMb, relevant);
        expect(picked.samples).toHaveLength(3);
        expect(picked.price).toBe(95);
        expect(picked.link).toBe('https://shopc.example/p');
    });

    it('filters organic retailer results by URL as well as title', () => {
        const relevant = (title, item, ctx) => !String(ctx.url).includes('wrong');
        const links = pickDistributorLinks(
            [
                { title: 'x', link: 'https://www.segen.co.uk/product/wrong-model/' },
                { title: 'x', link: 'https://www.segen.co.uk/product/right-model/?srsltid=1' },
                { title: 'x', link: 'https://www.segen.co.uk/product/another/' },
            ],
            {},
            relevant
        );
        expect(links).toEqual([{ title: 'x', link: 'https://www.segen.co.uk/product/right-model/', source: 'segen.co.uk' }]);
    });

    it('splits the whitelist into query-sized batches', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
});

describe('extractPriceDetails', () => {
    it('converts an ex-VAT headline to inc VAT and confirms it against JSON-LD', () => {
        const html = `<h1>Inverter</h1><p>£1,095.00 + VAT</p>
            <script type="application/ld+json">{ "@type": "Product", "name": "Inverter", "offers": { "price": "1314", "priceCurrency": "GBP" } }</script>`;
        const d = extractPriceDetails(html);
        expect(d.price).toBe(1314);
        expect(d.conflict).toBe(false);
    });

    it('treats JSON-LD equal to the ex-VAT headline as ex VAT', () => {
        const html = `<h1>Panel</h1><p>£100.00 ex VAT</p>
            <script type="application/ld+json">{ "@type": "Product", "offers": { "price": "100" } }</script>`;
        expect(extractPriceDetails(html).price).toBe(120);
    });

    it('flags a JSON-LD price that disagrees with the headline', () => {
        const html = `<h1>Panel</h1><p>£100.00 + VAT</p>
            <script type="application/ld+json">{ "@type": "Product", "offers": { "price": "160" } }</script>`;
        expect(extractPriceDetails(html).conflict).toBe(true);
    });

    it('honours valueAddedTaxIncluded: false', () => {
        const html = `<script type="application/ld+json">{ "@type": "Product", "offers": { "price": "50",
            "priceSpecification": { "price": "50", "valueAddedTaxIncluded": false } } }</script>`;
        expect(extractPriceDetails(html).price).toBe(60);
    });

    it('picks our Product out of several, and gives up when none is ours', () => {
        const html = `<script type="application/ld+json">[
            { "@type": "Product", "name": "Cable", "offers": { "price": "9.99" } },
            { "@type": "Product", "name": "SmartSolar MPPT 100/30", "sku": "SCC110030210", "offers": { "price": "93.99", "availability": "https://schema.org/InStock" } }
        ]</script><meta itemprop="price" content="9.99" />`;
        const ours = extractPriceDetails(html, { matchesProduct: (t) => t.includes('SCC110030210') });
        expect(ours.price).toBe(93.99);
        expect(ours.stock).toBe('in-stock');
        expect(extractPriceDetails(html, { matchesProduct: () => false })).toBeNull();
    });

    it('skips a delivery threshold and reads only from the product heading on', () => {
        const html = `<header>Free delivery on orders over £300 + VAT</header>
            <h1>Trina 455W</h1><p>Free delivery over £500 ex VAT</p><p>£62.00 + VAT</p>`;
        expect(extractExVatDisplayPrice(html)).toBe(62);
    });

    it('reads stock states', () => {
        expect(stockState('https://schema.org/OutOfStock')).toBe('out-of-stock');
        expect(stockState('http://schema.org/Discontinued')).toBe('discontinued');
        expect(stockState('InStock')).toBe('in-stock');
        expect(stockState('')).toBeNull();
    });

    it('collects the page identity from title, heading and JSON-LD', () => {
        const html = `<title>Buy | Shop</title><h1>Victron <b>SmartSolar</b> 100/30</h1>
            <script type="application/ld+json">{ "@type": "Product", "name": "SmartSolar", "sku": "SCC110030210", "offers": {"price": "1"} }</script>`;
        const text = pageIdentityText(html);
        expect(text).toContain('Victron SmartSolar 100/30');
        expect(text).toContain('SCC110030210');
    });
});

describe('probeCandidate', () => {
    const page = (html, extra = {}) => async () => ({ ok: true, status: 200, finalUrl: 'https://shop.example/p', html, ...extra });
    const isOurs = (text) => text.includes('A450-MAH54Mb');
    const info = { link: 'https://shop.example/p', source: 'shop.example' };

    it('rejects a page for a different product', async () => {
        const r = await probeCandidate(info, isOurs, page('<h1>AIKO A450-MAH54Mw</h1>'));
        expect(r.verdict).toBe('other-product');
    });

    it('reads price and stock from the right page', async () => {
        const html = `<h1>AIKO A450-MAH54Mb</h1><script type="application/ld+json">{ "@type": "Product",
            "offers": { "price": "110", "availability": "https://schema.org/OutOfStock" } }</script>`;
        const r = await probeCandidate(info, isOurs, page(html));
        expect(r).toMatchObject({ verdict: 'ok', price: 110, inStock: false });
    });

    it('keeps but does not trust a blocked page, and drops dead or discontinued ones', async () => {
        expect((await probeCandidate(info, isOurs, page('', { ok: false, status: 403 }))).verdict).toBe('unverified');
        expect((await probeCandidate(info, isOurs, page('', { ok: false, status: 404 }))).verdict).toBe('dead');
        const gone = `<h1>AIKO A450-MAH54Mb</h1><script type="application/ld+json">{ "@type": "Product",
            "offers": { "price": "110", "availability": "https://schema.org/Discontinued" } }</script>`;
        expect((await probeCandidate(info, isOurs, page(gone))).verdict).toBe('discontinued');
    });
});

describe('choosePrice', () => {
    it('prefers retailer pages and flags disagreement with Shopping', () => {
        const r = choosePrice({ pagePrices: [100, 104], shopping: { price: 150, agreeing: 3 }, hasBuyLink: true });
        expect(r.price).toBe(102);
        expect(r.reviewFlags.join()).toMatch(/disagree/);
    });

    it('flags a single unconfirmed source', () => {
        const r = choosePrice({ pagePrices: [100], shopping: null, hasBuyLink: true });
        expect(r.reviewFlags).toContain('single source');
    });

    it('needs three agreeing listings for a price with no retailer page', () => {
        expect(choosePrice({ pagePrices: [], shopping: { price: 80, agreeing: 2 }, hasBuyLink: false }).price).toBeNull();
        expect(choosePrice({ pagePrices: [], shopping: { price: 80, agreeing: 3 }, hasBuyLink: false }).price).toBe(80);
    });
});

describe('scan bookkeeping', () => {
    it('skips a product scanned recently even when it has no price', () => {
        const today = new Date().toISOString().slice(0, 10);
        expect(needsPriceCheck({ price: 0, priceCheckedAt: '' }, { lastScannedAt: today })).toBe(false);
        expect(needsPriceCheck({ price: 0, priceCheckedAt: '' }, { lastScannedAt: '2020-01-01' })).toBe(true);
        expect(needsPriceCheck({ price: 0, priceCheckedAt: '' }, { lastScannedAt: today, forceRecheck: true })).toBe(true);
    });

    it('records per-retailer price and stock without touching affiliate entries', () => {
        const affiliate = {
            Supplier: 'Bimble',
            URL: 'https://www.bimblesolar.com/a',
            affiliateUrl: 'https://aff.example/x',
            isAffiliate: true,
            Checked: true,
        };
        const links = [{ ...affiliate }];
        recordBuyLink(links, { source: 'segen.co.uk', link: 'https://www.segen.co.uk/p', price: 99, inStock: true });
        recordBuyLink(links, { source: 'bimblesolar.com', link: 'https://www.bimblesolar.com/a', price: 50, inStock: false });
        expect(links[0]).toEqual(affiliate);
        expect(links[1]).toMatchObject({ URL: 'https://www.segen.co.uk/p', price: 99, inStock: true });
        expect(links[1].priceCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('finds siblings that came out at the same price', () => {
        const a = { item: { manufacturer: 'AIKO', power: 450, model: 'Mb', price: 141.41 }, label: 'Mb' };
        const b = { item: { manufacturer: 'AIKO', power: 450, model: 'Mw', price: 141.41 }, label: 'Mw' };
        const c = { item: { manufacturer: 'AIKO', power: 460, model: 'X', price: 141.41 }, label: 'X' };
        const groups = findSharedPrices([a, b, c], (i) => `${i.manufacturer}|${i.power}`, (i) => i.model);
        expect(groups).toEqual([[a, b]]);
    });

    it('writes a review report listing only flagged products', () => {
        const md = formatReviewReport('Panel pricing review', [{ label: 'AIKO Mw', flags: ['single source'], lines: ['Shopping: £90'] }], {
            checked: 5,
            updated: 2,
            skippedFresh: 1,
        });
        expect(md).toContain('## AIKO Mw');
        expect(md).toContain('⚠ single source');
        expect(md).toContain('1 product(s) need review');
    });
});
