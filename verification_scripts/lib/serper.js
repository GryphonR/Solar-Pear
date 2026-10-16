/**
 * @file serper.js
 * Serper.dev UK shopping + organic search helpers used by pricing scans.
 */

import fs from 'fs/promises';
import { stripTrackingParams, supplierDomain } from './buyLinks.js';
import { isBundleOrAccessoryListing, isMarketplaceLink } from './listingMatch.js';
import { SERPER_SITES_PATH } from './paths.js';
import { isClearanceOrDamagedListing, isGoogleAggregatorLink, isPdfLink } from './urlQuality.js';

export const REQUEST_DELAY_MS = 500;

/**
 * Retailer domains per whitelisted organic query. Google ignores everything after the 32nd word
 * of a query, and each `site:x OR` costs two, so one query over the whole whitelist silently
 * dropped the last retailers. Eight sites plus a quoted model stays well inside the limit.
 */
export const SITES_PER_QUERY = 8;

/** Shopping prices more than this factor from the median are dropped as outliers. */
export const OUTLIER_FACTOR = 1.6;
/** Shopping prices within this fraction of the consensus count as agreeing with it. */
export const AGREEMENT_TOLERANCE = 0.15;

/** @param {number} ms */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Loads the domain whitelist for a catalog key (`panels` or `controllers`).
 * @param {'panels' | 'controllers'} catalogKey
 * @returns {Promise<string[]>}
 */
export async function loadSerperWhitelist(catalogKey) {
    const serperConfig = JSON.parse(await fs.readFile(SERPER_SITES_PATH, 'utf-8'));
    return serperConfig[catalogKey] || [];
}

/**
 * Splits a list into chunks of `size`.
 * @template T
 * @param {T[]} list
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

/**
 * True if at least one "meaningful" (3+ letter) word of the manufacturer name appears in the
 * title, e.g. "Victron" from "Victron Energy". Falls back to the whole name run together when
 * every word is short/generic (e.g. "Q Cells" → "qcells").
 * @param {string} normalizedTitle already-lowercased title
 * @param {string} manufacturer
 */
export function manufacturerMentioned(normalizedTitle, manufacturer) {
    const words = String(manufacturer || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) return false;
    const meaningfulWords = words.filter((w) => w.length >= 3);
    if (meaningfulWords.length > 0) return meaningfulWords.some((w) => normalizedTitle.includes(w));
    return normalizedTitle.includes(words.join(''));
}

/** Median of a numeric list, or null when empty. */
function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A consensus price from several listings: drop anything more than `OUTLIER_FACTOR` from the
 * median, take the median of the rest, and count how many agree with it within
 * `AGREEMENT_TOLERANCE`.
 * @param {number[]} prices
 * @returns {{ price: number | null, used: number[], outliers: number[], agreeing: number }}
 */
export function consensusPrice(prices) {
    const valid = prices.filter((p) => Number.isFinite(p) && p > 0);
    const m = median(valid);
    if (m === null) return { price: null, used: [], outliers: [], agreeing: 0 };
    const used = valid.filter((p) => p <= m * OUTLIER_FACTOR && p >= m / OUTLIER_FACTOR);
    const outliers = valid.filter((p) => !used.includes(p));
    const consensus = Math.round(median(used) * 100) / 100;
    const agreeing = used.filter((p) => Math.abs(p - consensus) / consensus <= AGREEMENT_TOLERANCE).length;
    return { price: consensus, used, outliers, agreeing };
}

/** Whether a result's link can be used as a buy link. */
function usableLink(link, title) {
    return (
        !!link &&
        !isGoogleAggregatorLink(link) &&
        !isPdfLink(link) &&
        !isMarketplaceLink(link) &&
        !isClearanceOrDamagedListing(title, link)
    );
}

const MARKETPLACE_SOURCES = /\b(?:ebay|amazon|onbuy|fruugo|manomano|aliexpress|temu)\b/i;

/**
 * Picks the relevant single-unit listings out of raw Serper shopping results and reduces them to
 * a consensus price (inc VAT: UK Shopping prices include it).
 *
 * @param {Array<{ title?: string, link?: string, source?: string, price?: string }>} results
 * @param {object} item
 * @param {(title: string, item: object, ctx: { url?: string }) => boolean} titleLooksRelevant
 * @returns {{ price: number, samples: Array<{ title: string, source: string, price: number, link: string }>, outliers: number[], agreeing: number, link: string, source: string, hasUsableLink: boolean } | null}
 */
export function pickShoppingResult(results, item, titleLooksRelevant) {
    const samples = [];
    for (const r of results) {
        if (typeof r.price !== 'string' || !r.price.includes('£')) continue;
        if (!titleLooksRelevant(r.title, item, { url: r.link })) continue;
        if (isBundleOrAccessoryListing(r.title, r.link) || isClearanceOrDamagedListing(r.title, r.link)) continue;
        if (MARKETPLACE_SOURCES.test(r.source || '') || isMarketplaceLink(r.link || '')) continue;
        const price = Number(String(r.price).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)?.[1]);
        if (!Number.isFinite(price) || price <= 0) continue;
        samples.push({ title: r.title || '', source: r.source || '', price, link: r.link || '' });
    }
    if (samples.length === 0) return null;

    const { price, used, outliers, agreeing } = consensusPrice(samples.map((s) => s.price));
    if (price === null) return null;

    // Buy link: the inlier with a real merchant link whose price is nearest the consensus.
    const linked = samples
        .filter((s) => used.includes(s.price) && usableLink(s.link, s.title))
        .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))[0];

    return {
        price,
        samples,
        outliers,
        agreeing,
        link: linked ? linked.link : '',
        source: linked ? linked.source || supplierDomain(linked.link) || '' : '',
        hasUsableLink: !!linked,
    };
}

/**
 * Queries Serper's shopping endpoint and returns a consensus price across every relevant
 * single-unit listing (see `pickShoppingResult`).
 *
 * @param {object} item product record
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {(item: object) => string | null | undefined} opts.getModel
 * @param {(title: string, item: object, ctx: { url?: string }) => boolean} opts.titleLooksRelevant
 */
export async function searchShopping(item, opts) {
    const model = opts.getModel(item);
    if (!model) return null;

    try {
        const response = await fetch('https://google.serper.dev/shopping', {
            method: 'POST',
            headers: {
                'X-API-KEY': opts.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Manufacturer name alongside the quoted model sharpens relevance without being
                // so strict that retailers phrasing the SKU slightly differently get excluded.
                q: `${item.manufacturer || ''} "${model}"`.trim(),
                gl: 'uk',
                hl: 'en',
                location: 'United Kingdom',
            }),
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        const results = Array.isArray(data.shopping) ? data.shopping : [];
        return pickShoppingResult(results, item, opts.titleLooksRelevant);
    } catch (error) {
        console.error(`Shopping search failed for ${model}:`, error.message);
        return null;
    }
}

/**
 * Filters organic results down to one relevant product page per retailer domain.
 * @param {Array<{ title?: string, link?: string }>} results
 * @param {object} item
 * @param {(title: string, item: object, ctx: { url?: string }) => boolean} titleLooksRelevant
 * @param {Set<string>} [seenDomains] shared across query batches
 */
export function pickDistributorLinks(results, item, titleLooksRelevant, seenDomains = new Set()) {
    const usableLinks = [];
    for (const r of results) {
        if (!usableLink(r.link, r.title)) continue;
        if (!titleLooksRelevant(r.title, item, { url: r.link })) continue;
        if (isBundleOrAccessoryListing(r.title, r.link)) continue;
        const domain = supplierDomain(r.link);
        if (!domain || seenDomains.has(domain)) continue;
        seenDomains.add(domain);
        usableLinks.push({ title: r.title || '', link: stripTrackingParams(r.link), source: domain });
    }
    return usableLinks;
}

/**
 * Organic Serper search restricted to known UK retailer domains for genuine buy links. The
 * whitelist is searched in batches of `SITES_PER_QUERY` so every retailer is covered. Returns
 * every distinct-domain match that clears the relevance + quality gates.
 *
 * @param {object} item
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {'panels' | 'controllers'} opts.catalogKey
 * @param {(item: object) => string | null | undefined} opts.getModel
 * @param {(title: string, item: object, ctx: { url?: string }) => boolean} opts.titleLooksRelevant
 * @returns {Promise<Array<{ title: string, link: string, source: string }>>}
 */
export async function searchDistributorLink(item, opts) {
    const model = opts.getModel(item);
    if (!model) return [];

    const whitelist = await loadSerperWhitelist(opts.catalogKey);
    const seenDomains = new Set();
    const links = [];
    for (const sites of chunk(whitelist, SITES_PER_QUERY)) {
        try {
            const siteFilterString = `(${sites.map((domain) => `site:${domain}`).join(' OR ')})`;
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': opts.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: `"${model}" ${siteFilterString}`,
                    gl: 'uk',
                    hl: 'en',
                }),
            });
            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }
            const data = await response.json();
            const results = Array.isArray(data.organic) ? data.organic : [];
            links.push(...pickDistributorLinks(results, item, opts.titleLooksRelevant, seenDomains));
        } catch (error) {
            console.error(`Distributor link search failed for ${model} (${sites[0]}…):`, error.message);
        }
        await sleep(REQUEST_DELAY_MS);
    }
    return links;
}
