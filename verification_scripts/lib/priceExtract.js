/**
 * @file priceExtract.js
 * GBP price parsing from shopping snippets and retailer HTML (JSON-LD / meta tags).
 */

import { FETCH_TIMEOUT_MS, isSoftErrorPageUrl, looksLikeSoftErrorHtml } from './urlQuality.js';

/**
 * Parses a price string like "£1,234.56" or "GBP 199.99" into a plain number.
 * Returns null if no numeric value could be extracted.
 * @param {string} priceText
 */
export function parsePriceText(priceText) {
    if (!priceText) return null;
    const match = String(priceText).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) ? value : null;
}

/**
 * Recursively searches a parsed JSON-LD object/array for the first `Offer`-shaped price,
 * covering the common `Product.offers`, `Product.offers[]` and `@graph` shapes.
 *
 * Currency-aware: if an offer explicitly declares `priceCurrency` and it isn't GBP, that
 * offer is skipped - the scan target is UK pricing.
 * @param {unknown} node
 * @returns {number | null}
 */
export function findPriceInJsonLd(node) {
    if (!node || typeof node !== 'object') return null;

    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findPriceInJsonLd(item);
            if (found !== null) return found;
        }
        return null;
    }

    // Direct offer: { price: "199.99", priceCurrency: "GBP", ... }
    // or nested: { priceSpecification: { price: "199.99", priceCurrency: "GBP" } }
    const directPrice = node.price ?? node.priceSpecification?.price;
    const currency = node.priceCurrency ?? node.priceSpecification?.priceCurrency;
    const isNonGbp = currency && String(currency).toUpperCase() !== 'GBP';
    if (directPrice !== undefined && !isNonGbp) {
        const parsed = parsePriceText(String(directPrice));
        if (parsed !== null) return parsed;
    }

    // Product wrapping one offer or an array of offers.
    if (node.offers) {
        const found = findPriceInJsonLd(node.offers);
        if (found !== null) return found;
    }

    // JSON-LD graphs bundle multiple typed nodes under "@graph".
    if (node['@graph']) {
        const found = findPriceInJsonLd(node['@graph']);
        if (found !== null) return found;
    }

    return null;
}

// Each entry pairs a price meta tag with its matching currency meta tag, so the currency can
// be checked before the price is trusted (mirrors the currency-awareness in findPriceInJsonLd).
const META_PRICE_PATTERNS = [
    {
        price: /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
        currency: /<meta[^>]+itemprop=["']priceCurrency["'][^>]+content=["']([^"']+)["']/i,
    },
    {
        price: /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
        currency: /<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i,
    },
    {
        price: /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
        currency: /<meta[^>]+property=["']og:price:currency["'][^>]+content=["']([^"']+)["']/i,
    },
];

/** UK standard VAT rate. Catalogue prices are stored inc VAT. */
export const VAT_RATE = 0.2;

/** @param {number} exVat */
export function toIncVat(exVat) {
    return Math.round(exVat * (1 + VAT_RATE) * 100) / 100;
}

// Words just before a "£X + VAT" figure that mean it isn't the unit price: delivery thresholds
// ("free delivery on orders over £300 ex VAT"), savings, RRPs and "from" prices.
const NON_UNIT_PRICE_CONTEXT =
    /\b(?:over|orders?|spend|delivery|postage|shipping|carriage|save|saving|was|rrp|from|finance)\b[^£]{0,30}$/i;

/** Where the main product sits: from the first <h1> onwards, if the page has one. */
function productRegion(html) {
    const h1 = html.search(/<h1[\s>]/i);
    return h1 === -1 ? html : html.slice(h1, h1 + 30000);
}

/**
 * UK trade retailers usually advertise an ex-VAT headline ("£1,095.00 + VAT", "£39.40 +vat")
 * while schema.org JSON-LD / Merchant Center feeds often store the VAT-inclusive figure
 * (£1,314 = £1,095 × 1.20). Returns that visible ex-VAT amount when the page marks one.
 *
 * Looks only from the page's first <h1> (the product) onwards, skips figures introduced as a
 * delivery threshold, saving, RRP or "from" price, and ignores tiny amounts (postage, fees).
 * Returns the first match left - on product pages that is almost always the unit price.
 * @param {string} html
 * @returns {number | null}
 */
export function extractExVatDisplayPrice(html) {
    if (!html) return null;
    const region = productRegion(html);

    // "£1,095.00 + VAT", "£39.40 +vat", "£916.67 ex VAT", "£100 excluding VAT"
    const re =
        /£\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\+\s*vat|ex\.?\s*vat|excl(?:uding)?\.?\s*vat)/gi;
    let match;
    while ((match = re.exec(region)) !== null) {
        const before = region.slice(Math.max(0, match.index - 60), match.index).replace(/<[^>]*>/g, ' ');
        if (NON_UNIT_PRICE_CONTEXT.test(before)) continue;
        const value = parsePriceText(match[1]);
        // Skip postage/admin-style add-ons; real controller/panel unit prices are well above this.
        if (value !== null && value >= 20) return value;
    }
    return null;
}

const LD_JSON_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Every schema.org Product node in the page's JSON-LD blocks (including `@graph` members and
 * `hasVariant` children).
 * @param {string} html
 * @returns {object[]}
 */
export function jsonLdProducts(html) {
    const products = [];
    const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        const types = [].concat(node['@type'] || []);
        if (types.some((t) => /^(?:Product|ProductModel|IndividualProduct)$/i.test(String(t)))) products.push(node);
        if (node['@graph']) visit(node['@graph']);
        if (node.hasVariant) visit(node.hasVariant);
    };
    for (const [, block] of String(html || '').matchAll(LD_JSON_BLOCK)) {
        try {
            visit(JSON.parse(block.trim()));
        } catch {
            // Malformed/partial JSON-LD is common in the wild - just skip this block.
        }
    }
    return products;
}

/** First GBP (or currency-less) offer of a Product node, with its VAT flag and availability. */
function productOffer(product) {
    const offers = [].concat(product.offers || []).flatMap((o) => (o && Array.isArray(o.offers) ? o.offers : [o]));
    for (const offer of offers) {
        if (!offer || typeof offer !== 'object') continue;
        const spec = Array.isArray(offer.priceSpecification) ? offer.priceSpecification[0] : offer.priceSpecification;
        const raw = offer.price ?? offer.lowPrice ?? spec?.price;
        const currency = offer.priceCurrency ?? spec?.priceCurrency;
        if (raw === undefined || (currency && String(currency).toUpperCase() !== 'GBP')) continue;
        const amount = parsePriceText(String(raw));
        if (amount === null) continue;
        const vatFlag = spec?.valueAddedTaxIncluded ?? offer.valueAddedTaxIncluded;
        return {
            amount,
            incVat: !(vatFlag === false || vatFlag === 'false'),
            availability: String(offer.availability || ''),
        };
    }
    return null;
}

/** @param {object} product */
function productIdentity(product) {
    return [product.name, product.sku, product.mpn, product.model].filter((v) => typeof v === 'string').join(' ');
}

/**
 * Stock state from a schema.org availability value.
 * @param {string} availability e.g. "https://schema.org/OutOfStock"
 * @returns {'in-stock' | 'out-of-stock' | 'discontinued' | null}
 */
export function stockState(availability) {
    const a = String(availability || '').toLowerCase();
    if (!a) return null;
    if (a.includes('discontinued')) return 'discontinued';
    if (a.includes('outofstock') || a.includes('soldout')) return 'out-of-stock';
    if (/instock|limitedavailability|onlineonly|instoreonly|preorder|presale|backorder/.test(a)) return 'in-stock';
    return null;
}

/**
 * The visible identity of a product page: <title>, og:title, the first <h1> and the JSON-LD
 * Product names / SKUs / MPNs. Used to check a fetched page is the product we searched for.
 * @param {string} html
 */
export function pageIdentityText(html) {
    if (!html) return '';
    const strip = (t) =>
        String(t || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const ld = jsonLdProducts(html).map(productIdentity);
    return [title, og, h1, ...ld].map(strip).filter(Boolean).join(' | ');
}

/**
 * Price details from a retailer page, normalised to inc VAT.
 *
 *   1. JSON-LD Product offers. When the page has several Products (related items, variants),
 *      only one that `matchesProduct` accepts is used; a single Product is used as is. Assumed
 *      inc VAT unless the offer says `valueAddedTaxIncluded: false`.
 *   2. The visible "£X + VAT" headline (`extractExVatDisplayPrice`), converted to inc VAT.
 *   3. `itemprop="price"` / `product:price:amount` / `og:price:amount` meta tags (assumed inc VAT),
 *      used only when the page doesn't carry several unmatched Products.
 *
 * When 1 and 2 both exist they are cross-checked: JSON-LD ≈ headline × 1.2 means JSON-LD is inc
 * VAT; JSON-LD ≈ headline means JSON-LD was ex VAT after all. Anything else is reported as a
 * `conflict` (for review) and the JSON-LD figure is used.
 *
 * @param {string} html
 * @param {{ matchesProduct?: (identity: string) => boolean }} [opts]
 * @returns {{ price: number, source: string, conflict: boolean, stock: string | null, raw: string } | null}
 */
export function extractPriceDetails(html, opts = {}) {
    if (!html) return null;

    const products = jsonLdProducts(html).filter((p) => productOffer(p));
    let chosen = null;
    if (products.length === 1) chosen = products[0];
    else if (products.length > 1 && opts.matchesProduct) {
        chosen = products.find((p) => opts.matchesProduct(productIdentity(p))) || null;
    }
    const ld = chosen ? productOffer(chosen) : null;
    const exVat = extractExVatDisplayPrice(html);
    const stock = ld ? stockState(ld.availability) : null;
    const ldInc = ld ? (ld.incVat ? ld.amount : toIncVat(ld.amount)) : null;

    if (ld && exVat !== null) {
        const near = (a, b, tol) => Math.abs(a - b) / b <= tol;
        const raw = `JSON-LD £${ld.amount}, page £${exVat} + VAT`;
        if (near(ld.amount, toIncVat(exVat), 0.03)) {
            return { price: ld.amount, source: 'JSON-LD (inc VAT, matches the ex-VAT headline)', conflict: false, stock, raw };
        }
        if (near(ld.amount, exVat, 0.01)) {
            return { price: toIncVat(exVat), source: 'ex-VAT headline × 1.2', conflict: false, stock, raw };
        }
        return { price: ldInc, source: 'JSON-LD (disagrees with the page headline)', conflict: true, stock, raw };
    }
    if (ld) {
        return {
            price: ldInc,
            source: ld.incVat ? 'JSON-LD' : 'JSON-LD ex VAT × 1.2',
            conflict: false,
            stock,
            raw: `JSON-LD £${ld.amount}`,
        };
    }
    if (exVat !== null) {
        return { price: toIncVat(exVat), source: 'ex-VAT headline × 1.2', conflict: false, stock: null, raw: `page £${exVat} + VAT` };
    }
    // Several Products and none of them ours: the meta tags are just as ambiguous.
    if (products.length > 1) return null;

    for (const { price, currency } of META_PRICE_PATTERNS) {
        const priceMatch = html.match(price);
        if (!priceMatch) continue;
        const currencyMatch = html.match(currency);
        if (currencyMatch && currencyMatch[1].toUpperCase() !== 'GBP') continue;
        const parsed = parsePriceText(priceMatch[1]);
        if (parsed !== null) {
            return { price: parsed, source: 'meta price tag', conflict: false, stock: null, raw: `meta £${parsed}` };
        }
    }
    return null;
}

/**
 * The raw advertised price on a retailer page, basis not normalised (the scan uses
 * `extractPriceDetails`). Tries, in order of reliability:
 *   1. Visible UK trade ex-VAT headline ("£X + VAT") - see `extractExVatDisplayPrice`
 *   2. schema.org JSON-LD `<script type="application/ld+json">` blocks
 *   3. `<meta itemprop="price">` / `product:price:amount` / `og:price:amount` meta tags
 * Paths 2–3 reject an explicit non-GBP currency rather than trusting it.
 * @param {string} html
 * @returns {number | null}
 */
export function extractPriceFromHtml(html) {
    // Trade sites: trust the advertised ex-VAT figure over JSON-LD's often-inc-VAT Offer.price.
    const exVat = extractExVatDisplayPrice(html);
    if (exVat !== null) return exVat;

    const ldJsonBlocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const [, block] of ldJsonBlocks) {
        try {
            const parsed = JSON.parse(block.trim());
            const price = findPriceInJsonLd(parsed);
            if (price !== null) return price;
        } catch {
            // Malformed/partial JSON-LD is common in the wild - just skip this block.
        }
    }

    for (const { price, currency } of META_PRICE_PATTERNS) {
        const priceMatch = html.match(price);
        if (!priceMatch) continue;

        const currencyMatch = html.match(currency);
        if (currencyMatch && currencyMatch[1].toUpperCase() !== 'GBP') continue; // explicit non-GBP - skip

        const parsed = parsePriceText(priceMatch[1]);
        if (parsed !== null) return parsed;
    }

    return null;
}

/**
 * Fetches a merchant page and reports whether it is a usable product page (vs a hard HTTP
 * failure or a soft-error document like City Plumbing's `/error-500` redirect target).
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, status: number | string, finalUrl: string, html: string }>}
 */
export async function fetchMerchantPage(url, opts = {}) {
    if (!url) return { ok: false, status: 'No URL', finalUrl: '', html: '' };

    const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const html = await response.text();
        const finalUrl = response.url || url;
        // Soft-error path/HTML wins over status: City Plumbing redirects dead SKUs to
        // /error-500 and the final document can still look "successful" to a naive check.
        const softError = isSoftErrorPageUrl(finalUrl) || looksLikeSoftErrorHtml(html);
        return {
            ok: response.ok && !softError,
            status: softError ? `soft-error (${response.status})` : response.status,
            finalUrl,
            html,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return { ok: false, status: 'Timeout', finalUrl: url, html: '' };
        }
        return { ok: false, status: `Fetch Error: ${error.message || 'Unknown'}`, finalUrl: url, html: '' };
    }
}

/**
 * Median of a non-empty numeric list (average of the two middle values when even-length).
 * @param {number[]} values
 * @returns {number | null}
 */
export function medianPrice(values) {
    const sorted = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    // Average of the two middle values, rounded to pence so we don't store £1085.095.
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

/**
 * Fetches a retailer page and attempts to extract a precise price from it.
 * @param {string} url
 */
export async function fetchPagePrice(url) {
    const page = await fetchMerchantPage(url);
    if (!page.ok) return null;
    return extractPriceFromHtml(page.html);
}
