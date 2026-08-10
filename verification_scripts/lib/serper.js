/**
 * @file serper.js
 * Serper.dev UK shopping + organic search helpers used by pricing scans.
 */

import fs from 'fs/promises';
import { stripTrackingParams, supplierDomain } from './buyLinks.js';
import { SERPER_SITES_PATH } from './paths.js';
import { isClearanceOrDamagedListing, isGoogleAggregatorLink, isPdfLink } from './urlQuality.js';

export const REQUEST_DELAY_MS = 500;

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

/**
 * Queries Serper's shopping endpoint and returns the best-ranked result that passes currency
 * (£) and the caller's relevance gate. Prefer a result with a usable merchant link.
 *
 * @param {object} item product record
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {(item: object) => string | null | undefined} opts.getModel
 * @param {(title: string, item: object) => boolean} opts.titleLooksRelevant
 * @returns {Promise<{ title: string, link: string, source: string, priceText: string, hasUsableLink: boolean } | null>}
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

        const trustedMatches = results.filter(
            (r) => typeof r.price === 'string' && r.price.includes('£') && opts.titleLooksRelevant(r.title, item)
        );
        if (trustedMatches.length === 0) return null;

        const withUsableLink = trustedMatches.find(
            (r) =>
                r.link &&
                !isGoogleAggregatorLink(r.link) &&
                !isPdfLink(r.link) &&
                !isClearanceOrDamagedListing(r.title, r.link)
        );
        const best = withUsableLink || trustedMatches[0];

        return {
            title: best.title || '',
            link: withUsableLink ? best.link : '',
            source: best.source || (withUsableLink ? new URL(best.link).hostname.replace('www.', '') : ''),
            priceText: best.price || '',
            hasUsableLink: !!withUsableLink,
        };
    } catch (error) {
        console.error(`Shopping search failed for ${model}:`, error.message);
        return null;
    }
}

/**
 * Organic Serper search restricted to known UK retailer domains for genuine buy links.
 * Returns every distinct-domain match that clears the relevance + quality gates.
 *
 * @param {object} item
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {'panels' | 'controllers'} opts.catalogKey
 * @param {(item: object) => string | null | undefined} opts.getModel
 * @param {(title: string, item: object) => boolean} opts.titleLooksRelevant
 * @returns {Promise<Array<{ title: string, link: string, source: string }>>}
 */
export async function searchDistributorLink(item, opts) {
    const model = opts.getModel(item);
    if (!model) return [];

    try {
        const whitelist = await loadSerperWhitelist(opts.catalogKey);
        if (whitelist.length === 0) return [];

        const siteFilterString = `(${whitelist.map((domain) => `site:${domain}`).join(' OR ')})`;

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

        const seenDomains = new Set();
        const usableLinks = [];
        for (const r of results) {
            if (
                !r.link ||
                !opts.titleLooksRelevant(r.title, item) ||
                isPdfLink(r.link) ||
                isGoogleAggregatorLink(r.link) ||
                isClearanceOrDamagedListing(r.title, r.link)
            ) {
                continue;
            }
            const domain = supplierDomain(r.link);
            if (!domain || seenDomains.has(domain)) continue;
            seenDomains.add(domain);
            usableLinks.push({ title: r.title || '', link: stripTrackingParams(r.link), source: domain });
        }
        return usableLinks;
    } catch (error) {
        console.error(`Distributor link search failed for ${model}:`, error.message);
        return [];
    }
}
