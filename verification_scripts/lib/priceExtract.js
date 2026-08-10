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

/**
 * UK trade retailers usually advertise an ex-VAT headline ("£1,095.00 + VAT", "£39.40 +vat")
 * while schema.org JSON-LD / Merchant Center feeds often store the VAT-inclusive figure
 * (£1,314 = £1,095 × 1.20). Prefer the visible ex-VAT amount when the page clearly marks one.
 *
 * Ignores tiny "+ VAT" amounts (shipping/admin fees under £20). Returns the first substantial
 * match in document order - on product pages that is almost always the main unit price.
 * @param {string} html
 * @returns {number | null}
 */
export function extractExVatDisplayPrice(html) {
    if (!html) return null;

    // "£1,095.00 + VAT", "£39.40 +vat", "£916.67 ex VAT", "£100 excluding VAT"
    const re =
        /£\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\+\s*vat|ex\.?\s*vat|excl(?:uding)?\.?\s*vat)/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        const value = parsePriceText(match[1]);
        // Skip postage/admin-style add-ons; real controller/panel unit prices are well above this.
        if (value !== null && value >= 20) return value;
    }
    return null;
}

/**
 * Extracts a price from a retailer page's HTML, trying (in order of reliability):
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
