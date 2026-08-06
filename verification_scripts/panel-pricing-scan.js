/**
 * @file panel-pricing-scan.js
 *
 * Updates `price` and `buyLinks` for every panel in `src/data/panels/*.json`, and stamps
 * `priceCheckedAt` with the date each panel was last checked.
 *
 * This is a plain script, not an AI agent step - it costs Serper API credits, not LLM/chat
 * tokens, so it stays cheap to re-run regardless of how large the panel database grows.
 *
 * Price and buy-link discovery are deliberately split into two different searches, because
 * they have different reliability trade-offs:
 *   Stage 1 (price)      - Serper "shopping" search for `<manufacturer> "<model>"`, with no
 *     supplier/domain restriction, gated on currency ("£" only) and relevance (title must
 *     mention both the manufacturer and the wattage - a bare SKU search can coincidentally
 *     match an unrelated product; a real example matched a "MAX-3" spray-gun listing instead
 *     of a Maxeon 3 panel). In practice, Google's shopping vertical almost always returns its
 *     own multi-seller "compare prices" page as `link` here rather than a specific merchant
 *     page, so this stage's link is opportunistic at best - the price is the reliable part.
 *   Stage 1b (buy link)  - only runs when stage 1's own link wasn't usable. A Serper organic
 *     search restricted to the known-UK-retailer domain whitelist (same list and `site:`
 *     approach as `panel-availability-scan.js`, from `data-admin/config/serper-sites.json`),
 *     also gated on relevance and on not being a damaged/clearance listing of the right panel
 *     (a real, working retailer page, but not the standard product - see
 *     `isClearanceOrDamagedListing`). This is a much more reliable source of an actual "buy
 *     this" page, since it's only searching real retailer sites rather than Google's own
 *     aggregator.
 *   Stage 2 (precision)  - only runs when stage 1 or 1b found a real page (not a Google
 *     aggregator page, not a PDF). Fetches that page and looks for a structured price
 *     (schema.org JSON-LD `Offer.price`, or an Open Graph / microdata price meta tag), also
 *     rejecting an explicit non-GBP `priceCurrency`. A successful, GBP-confirmed stage-2 read
 *     overrides whichever stage supplied the price.
 *
 * Multiple suppliers: every distinct-domain match the whitelist search turns up is kept (not
 * just the first), so a panel can end up with several `buyLinks` entries - but only *one*
 * entry per supplier domain. If a new link is found for a domain that already has an entry,
 * the new URL replaces the old one (retailers often rename product slugs; keeping both would
 * leave a stale path sitting next to the live one). Any query string is stripped from every
 * URL before it's stored or compared - it's almost always click-tracking (Google's `srsltid`,
 * UTM params, etc.), never something needed to reach the actual page.
 *
 * Plausibility gate: whatever price the two stages settle on is checked against the panel's
 * wattage (see `priceLooksPlausible`) before it's written - a "PRICE ONLY" result in particular
 * has no buy link to cross-check it against, so a bulk/pallet price or a wrong-product match
 * can otherwise sail straight into `price` unchallenged. A rejected price leaves the panel's
 * previous price untouched; any buy links found are still added regardless.
 *
 * Self-healing: every panel with a `model` also has its *existing* buyLinks normalised - a
 * Google aggregator link, a straight PDF (e.g. an MCS certificate or datasheet), a
 * damaged/clearance listing, or a soft-error URL path (e.g. City Plumbing's `/error-500`) is
 * dropped entirely, regardless of which past script wrote it, and any surviving link has its
 * tracking query string stripped. `panel-availability-scan.js`'s organic search has no such
 * filter and has historically picked up certificate PDFs and tracked links from whitelisted
 * domains. Path-based cleanup runs even for panels skipped as price-fresh (no API cost). Soft
 * errors that only appear *after* a redirect (dead product URL → `/error-500`) are caught when
 * stage 2 fetches the page, and that dead URL is then removed from `buyLinks`.
 *
 * Cost control:
 *   - A panel's *price* is skipped if it was checked within the last `PRICE_STALE_DAYS` days
 *     (default 30), so repeat runs only spend API credits on stale/new panels. Pass --force (or
 *     -f) to ignore this and re-check every panel with a `model` regardless of staleness.
 *   - Pass --manufacturer=<name> (case-insensitive substring match) to restrict the whole run to
 *     one manufacturer - handy for testing changes to this script without burning through the
 *     full catalog's worth of Serper searches.
 *   - Pass --nofetch to skip stage 2 (Serper-only, faster, good for a quick nightly top-up run).
 *
 * Usage:
 *   SERPER_API_KEY=xyz123 node verification_scripts/panel-pricing-scan.js [--force|-f] [--nofetch] [--manufacturer=Trina]
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PANELS_DIR = path.join(ROOT, 'src/data/panels');
const LOGS_DIR = path.join(ROOT, 'logs');
// Same whitelist/file used by panel-availability-scan.js, reused here for stage 1b only (the
// buy-link search) - stage 1 (price) deliberately does NOT use this restriction.
const SERPER_SITES_PATH = path.join(ROOT, 'data-admin/config/serper-sites.json');

// Load ./.env into process.env if present (Node's built-in loader - no dotenv dependency).
// Safe to skip silently: CI/shells that already export SERPER_API_KEY won't have a .env file.
try {
    process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
    // No .env file - fall back to whatever is already in the shell environment.
}

// Prefer env var so the key is not stored in shell history; --api= remains as a fallback.
const apiArg = process.argv.find((arg) => arg.startsWith('--api='));
const SERPER_API_KEY = process.env.SERPER_API_KEY || (apiArg ? apiArg.split('=')[1] : null);

const FORCE_RECHECK = process.argv.includes('--force') || process.argv.includes('-f');
const SKIP_STAGE_2 = process.argv.includes('--nofetch');

// Restricts the run to one manufacturer (case-insensitive substring match), so this script can
// be tested/tuned against a handful of panels instead of the whole catalog's worth of searches.
const manufacturerArg = process.argv.find((arg) => arg.startsWith('--manufacturer='));
const MANUFACTURER_FILTER = manufacturerArg ? manufacturerArg.split('=')[1].toLowerCase() : null;

// How long a price stays "fresh" before it's worth re-checking. Overridable for testing/tuning
// without editing the script.
const PRICE_STALE_DAYS = Number(process.env.PRICE_STALE_DAYS) || 30;

const FETCH_TIMEOUT_MS = 10000;
const REQUEST_DELAY_MS = 500; // be polite to Serper and to retailer sites alike

// A price/wattage ratio outside this range almost certainly isn't a single panel's price - it's
// a bulk/pallet listing, a wrong-product match, or a mis-extracted number sharing the page with
// the real price. Calibrated against the catalogue's actual spread: prices with a corroborating
// buy link never go below ~£0.12/W, and the lowest *unverified* ("PRICE ONLY") result seen that
// wasn't already a known bad match was £0.097/W - so 0.08 gives that a little room without
// accepting the kind of accessory/sample/wrong-product price that would sit well below it (a
// real example: a 510W panel search once returned "£29.82", i.e. £0.058/W, for a panel that
// actually costs around £110). See `priceLooksPlausible`.
const MIN_PRICE_PER_WATT = 0.08;
const MAX_PRICE_PER_WATT = 1.2;

/** @param {number} ms */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- STAGE 1: SERPER SHOPPING SEARCH ---

/**
 * A URL that resolves back onto Google itself (its own "compare prices across sellers" page,
 * e.g. `google.com/search?ibp=oshop&...`) rather than a specific merchant's page. Serper's
 * shopping API returns these as the `link` whenever Google didn't resolve a single distinct
 * seller landing page - they are never a usable "where to buy this" link.
 * @param {string} url
 */
export function isGoogleAggregatorLink(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'google.com' || host.endsWith('.google.com') || host === 'google.co.uk' || host.endsWith('.google.co.uk');
    } catch {
        return true; // unparseable URL is equally unusable
    }
}

/** @param {string} url */
export function isPdfLink(url) {
    try {
        return /\.pdf(?:[?#]|$)/i.test(new URL(url).pathname);
    } catch {
        return true;
    }
}

/**
 * A listing for damaged, clearance, ex-display, or otherwise non-standard stock of a panel -
 * not the panel itself. These are real, working merchant pages (so `isPdfLink` and
 * `isGoogleAggregatorLink` don't catch them), but they still shouldn't stand in for a panel's
 * normal "buy this" link: they're typically discounted stock rather than the standard product,
 * so a price and link sourced from one would be misleading even if genuinely relevant to the
 * right model. A real example: a search for a 460W AIKO panel returned a
 * "midsummerwholesale.co.uk/buy/damaged-panels/..." listing from an otherwise-legitimate,
 * whitelisted retailer.
 * @param {string} title
 * @param {string} url
 */
export function isClearanceOrDamagedListing(title, url) {
    const haystack = `${title || ''} ${url || ''}`.toLowerCase();
    return /\b(damaged|clearance|b-?grade|reject|seconds|refurbished|ex-display|surplus|salvage)\b/.test(haystack);
}

/**
 * True when a URL's *path* is itself a retailer soft-error page (e.g. City Plumbing's
 * `/error-500`). Some merchants redirect dead product URLs here and still serve a full HTML
 * document - occasionally even with a 200 - so a bare `response.ok` check is not enough; the
 * final URL after redirects has to be inspected too.
 * @param {string} url
 */
export function isSoftErrorPageUrl(url) {
    try {
        return /\/error-\d+/i.test(new URL(url).pathname);
    } catch {
        return false;
    }
}

/**
 * True when page HTML looks like a branded soft-error / "something went wrong" document
 * rather than a product listing. Used together with `isSoftErrorPageUrl` for the case where a
 * merchant serves the error page at a normal-looking path (or with a 200 status).
 * @param {string} html
 */
export function looksLikeSoftErrorHtml(html) {
    if (!html) return false;
    // Cap the scan - error chrome is always near the top; no need to walk a 500KB product page.
    const sample = html.slice(0, 80000).toLowerCase();
    const hasInternalServerError = sample.includes('internal server error');
    const hasSomethingWentWrong = sample.includes('something went wrong');
    // City Plumbing's /error-500 page carries both phrases; either alone is too weak on a
    // normal product page that might mention "sorry" in shipping copy.
    if (hasInternalServerError && hasSomethingWentWrong) return true;
    return /<title[^>]*>\s*(?:error\s*500|500\s*error|internal server error)/i.test(html);
}

/**
 * Drops the query string and fragment from a URL, e.g. turning
 * `.../product/123?srsltid=AfmBOo...` into `.../product/123`. Every buy link this script
 * stores or compares goes through here first - the query string on a retailer link is almost
 * always click-tracking (Google's `srsltid`, UTM params, affiliate click IDs), not something
 * needed to reach the product page, and leaving it in would also cause the same page to be
 * treated as a "new" link every time Google mints a fresh tracking token for it.
 * @param {string} url
 */
export function stripTrackingParams(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return url; // unparseable - leave as-is rather than losing it
    }
}

/**
 * Normalised supplier hostname for a URL (`www.` stripped), used to decide whether two buy
 * links are from the "same website" and should replace rather than accumulate.
 * @param {string} url
 * @returns {string | null}
 */
export function supplierDomain(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

/**
 * Inserts `newLink` into `buyLinks`, replacing any existing entry from the same supplier
 * domain. Same exact URL is a no-op. Returns whether the list changed.
 * @param {Array<{ Supplier: string, URL: string, isAffiliate?: boolean, Checked?: boolean }>} buyLinks
 * @param {{ Supplier: string, URL: string, isAffiliate?: boolean, Checked?: boolean }} newLink
 * @returns {boolean}
 */
export function upsertBuyLinkByDomain(buyLinks, newLink) {
    const domain = supplierDomain(newLink.URL);
    if (!domain) {
        // Unparseable URL - fall back to exact-URL append so we don't silently drop it.
        if (buyLinks.some((link) => link.URL === newLink.URL)) return false;
        buyLinks.push(newLink);
        return true;
    }

    const existingIndex = buyLinks.findIndex((link) => supplierDomain(link.URL) === domain);
    if (existingIndex === -1) {
        buyLinks.push(newLink);
        return true;
    }

    // Same domain already present: replace unless the URL is already identical (avoids flipping
    // Checked/Supplier fields on a no-op re-discovery of the same page).
    if (buyLinks[existingIndex].URL === newLink.URL) return false;
    buyLinks[existingIndex] = newLink;
    return true;
}

/**
 * True if at least one "meaningful" (3+ letter) word of the manufacturer name appears in the
 * title, e.g. "Victron" from "Victron Energy", or "Maxeon" from "Maxeon". Falls back to
 * requiring the whole manufacturer name run together when every word is short/generic
 * (e.g. "Q Cells" -> "q" alone is too weak a signal, so "qcells" is required instead).
 * @param {string} normalizedTitle already-lowercased title
 * @param {string} manufacturer
 */
function manufacturerMentioned(normalizedTitle, manufacturer) {
    const words = String(manufacturer || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;
    const meaningfulWords = words.filter((w) => w.length >= 3);
    if (meaningfulWords.length > 0) return meaningfulWords.some((w) => normalizedTitle.includes(w));
    return normalizedTitle.includes(words.join(''));
}

/**
 * Extracts the short variant code after the last "/" in a model number, e.g. "MB" from
 * "JAM54D40-435/MB" or "LR" from "JAM54S31-435/LR". Manufacturers frequently reuse this suffix
 * to distinguish otherwise same-wattage SKUs (different cell tech, glass, frame colour) - see
 * `titleLooksRelevant`'s `siblingSuffixes` parameter for why this matters.
 * @param {string} model
 * @returns {string | null}
 */
export function extractModelSuffix(model) {
    const match = String(model || '').match(/\/([A-Za-z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Rough relevance guard: a shopping result's title must mention both the manufacturer and the
 * panel's wattage before it's trusted as the right product. A bare SKU search (e.g.
 * "SPR-MAX3-410-BLK") can coincidentally match an unrelated product with a similar-looking
 * code - a real example seen in practice matched a "MAX-3" spray-gun/airbrush listing instead
 * of the Maxeon 3 panel. Retail titles rarely repeat the full internal SKU verbatim, so this
 * checks the two facts a listing for the right product will almost always state instead.
 *
 * `siblingSuffixes` covers a narrower but real failure mode: a manufacturer's own line-up can
 * have two *different* panels sharing one wattage (a real example: JA Solar's Deepblue 3.0 Pro
 * sells both a PERC/single-glass "435/LR" and an unrelated TOPCon/bifacial "435/MB" at the same
 * 435W headline figure - manufacturer + wattage alone matches either one). When the caller
 * knows about such siblings, this also requires the title mention *this* panel's own suffix
 * (see `extractModelSuffix`), so an ambiguous generic "435W" listing is correctly treated as
 * not-a-match for either sibling rather than confidently mismatched to both.
 * @param {string} title
 * @param {{ manufacturer?: string, power?: number, model?: string }} panel
 * @param {string[]} [siblingSuffixes] other same-manufacturer, same-wattage panels' suffixes
 */
export function titleLooksRelevant(title, panel, siblingSuffixes = []) {
    if (!title) return false;
    const normalizedTitle = title.toLowerCase();
    const mentionsWattage = panel.power ? normalizedTitle.includes(String(panel.power)) : false;
    if (!mentionsWattage || !manufacturerMentioned(normalizedTitle, panel.manufacturer)) return false;

    if (siblingSuffixes.length > 0) {
        const suffix = extractModelSuffix(panel.model);
        if (!suffix || !normalizedTitle.includes(suffix)) return false;
    }
    return true;
}

/**
 * Queries Serper's shopping endpoint for a panel and returns the best-ranked result that
 * passes the currency and relevance gates documented at the top of this file. In practice
 * Google's shopping vertical almost always returns its own aggregator page as `link` rather
 * than a specific merchant page, so `hasUsableLink` is frequently false - `run()` then falls
 * back to `searchDistributorLink` (stage 1b) for the actual buy link.
 * @param {{ model: string, manufacturer?: string, power?: number }} panel
 * @returns {Promise<{ title: string, link: string, source: string, priceText: string, hasUsableLink: boolean } | null>}
 */
export async function searchShopping(panel) {
    const model = panel?.model;
    if (!model) return null;

    try {
        const response = await fetch('https://google.serper.dev/shopping', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Manufacturer name alongside the quoted model sharpens relevance without being
                // so strict that retailers phrasing the SKU slightly differently get excluded.
                q: `${panel.manufacturer || ''} "${model}"`.trim(),
                gl: 'uk', // Geolocation: UK
                hl: 'en',
                location: 'United Kingdom', // More specific geo hint than `gl` alone
            }),
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        const results = Array.isArray(data.shopping) ? data.shopping : [];

        // Gate 1 (currency) + Gate 2 (relevance): both must pass before a result is trusted
        // for a price at all.
        const trustedMatches = results.filter(
            (r) => typeof r.price === 'string' && r.price.includes('£') && titleLooksRelevant(r.title, panel)
        );
        if (trustedMatches.length === 0) return null;

        // Gate 3 (link quality): prefer whichever trusted match also has a real merchant link
        // for the standard product (not a Google aggregator page, a PDF, or damaged/clearance
        // stock of the right panel).
        const withUsableLink = trustedMatches.find(
            (r) => r.link && !isGoogleAggregatorLink(r.link) && !isPdfLink(r.link) && !isClearanceOrDamagedListing(r.title, r.link)
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

// --- STAGE 1b: WHITELISTED RETAILER SEARCH (BUY LINK ONLY) ---

/**
 * Serper's shopping API almost always hands back its own aggregator page rather than a real
 * merchant page (see file header), so genuine "buy this" links are instead found via a plain
 * Serper search restricted to known UK solar retailer domains - the same domains and `site:`
 * technique `panel-availability-scan.js` uses. Still gated on relevance so an off-topic page
 * on a whitelisted domain isn't mistaken for the right product.
 *
 * Returns every result that clears the gates, not just the best one - a panel is genuinely
 * available from several suppliers at once, and `run()` records all of them. Only the first
 * hit per supplier *domain* is kept, since a search can return two different pages from the
 * same retailer (e.g. a category page and a product page).
 * @param {{ model: string, manufacturer?: string, power?: number }} panel
 * @returns {Promise<Array<{ title: string, link: string, source: string }>>}
 */
export async function searchDistributorLink(panel) {
    const model = panel?.model;
    if (!model) return [];

    try {
        const serperConfig = JSON.parse(await fs.readFile(SERPER_SITES_PATH, 'utf-8'));
        const whitelist = serperConfig.panels || [];
        if (whitelist.length === 0) return [];

        const siteFilterString = `(${whitelist.map((domain) => `site:${domain}`).join(' OR ')})`;

        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
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
                !titleLooksRelevant(r.title, panel) ||
                isPdfLink(r.link) ||
                isGoogleAggregatorLink(r.link) ||
                isClearanceOrDamagedListing(r.title, r.link)
            ) {
                continue;
            }
            const domain = supplierDomain(r.link);
            if (!domain || seenDomains.has(domain)) continue; // already have a link for this supplier
            seenDomains.add(domain);
            usableLinks.push({ title: r.title || '', link: stripTrackingParams(r.link), source: domain });
        }
        return usableLinks;
    } catch (error) {
        console.error(`Distributor link search failed for ${model}:`, error.message);
        return [];
    }
}

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

// --- STAGE 2: RETAILER PAGE PRICE EXTRACTION ---

/**
 * Recursively searches a parsed JSON-LD object/array for the first `Offer`-shaped price,
 * covering the common `Product.offers`, `Product.offers[]` and `@graph` shapes.
 *
 * Currency-aware: if an offer explicitly declares `priceCurrency` and it isn't GBP, that
 * offer is skipped (not just deprioritised) - the scan target is UK pricing, and some
 * retailer pages (e.g. global sites that default to USD) would otherwise silently overwrite
 * a correct stage-1 GBP price with a wrong-country one.
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
 * Extracts a price from a retailer page's HTML, trying (in order of reliability):
 *   1. schema.org JSON-LD `<script type="application/ld+json">` blocks
 *   2. `<meta itemprop="price">` / `product:price:amount` / `og:price:amount` meta tags
 * Both paths reject an explicit non-GBP currency rather than trusting it - see
 * `findPriceInJsonLd` for why this matters.
 * @param {string} html
 * @returns {number | null}
 */
export function extractPriceFromHtml(html) {
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
 * Soft-error pages are treated as dead even when the final response happens to be HTTP 200,
 * because the browser still shows a "Something went wrong" page rather than the product.
 * @param {string} url
 * @returns {Promise<{ ok: boolean, status: number | string, finalUrl: string, html: string }>}
 */
export async function fetchMerchantPage(url) {
    if (!url) return { ok: false, status: 'No URL', finalUrl: '', html: '' };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
 * Fetches a retailer page and attempts to extract a precise price from it. Returns null on
 * any failure (timeout, non-200, soft-error page, no extractable price) so the caller can
 * fall back to the stage-1 shopping snippet price.
 * @param {string} url
 */
export async function fetchPagePrice(url) {
    const page = await fetchMerchantPage(url);
    if (!page.ok) return null;
    return extractPriceFromHtml(page.html);
}

// --- PLAUSIBILITY ---

/**
 * True if `price` is a plausible amount for a single panel of the given wattage, i.e. its
 * implied £/W ratio falls within `MIN_PRICE_PER_WATT`-`MAX_PRICE_PER_WATT`. This is the guard
 * against exactly the failure mode a "PRICE ONLY" result (no buy link to cross-check against)
 * can produce: a real example search for a 410W panel returned "£1664.08" - almost certainly a
 * bulk/pallet price rather than a per-panel one, and nothing else caught it before it was
 * written straight into `price`. Applied to every price this script would write, regardless of
 * whether it came from the shopping snippet or a fetched retailer page - a garbled page
 * extraction can produce the same kind of nonsense number.
 * @param {number} price
 * @param {number} power
 */
export function priceLooksPlausible(price, power) {
    if (!power) return true; // nothing to sanity-check a ratio against
    const perWatt = price / power;
    return perWatt >= MIN_PRICE_PER_WATT && perWatt <= MAX_PRICE_PER_WATT;
}

// --- STALENESS ---

/**
 * A panel is due for a re-check if it has never been checked, has no recorded price, or its
 * last check is older than PRICE_STALE_DAYS.
 * @param {{ price: number, priceCheckedAt: string }} panel
 */
export function needsPriceCheck(panel) {
    if (FORCE_RECHECK) return true;
    if (!panel.priceCheckedAt || !panel.price) return true;

    const checkedAt = new Date(panel.priceCheckedAt);
    if (Number.isNaN(checkedAt.getTime())) return true;

    const ageDays = (Date.now() - checkedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= PRICE_STALE_DAYS;
}

// --- MAIN PROCESS ---

export async function run() {
    if (!SERPER_API_KEY) {
        console.error('ERROR: Provide your Serper.dev API key via SERPER_API_KEY env, or --api=YOUR_KEY as fallback.');
        console.error('Usage: SERPER_API_KEY=xyz123 node panel-pricing-scan.js [--force] [--nofetch]');
        process.exit(1);
    }

    let logOutput = '=== PANEL PRICING CHECK LOG ===\n\n';
    let panelsChecked = 0;
    let panelsUpdated = 0;
    let panelsSkippedFresh = 0;

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `panel_pricing_check_log_${Date.now()}.txt`);

        const files = await fs.readdir(PANELS_DIR);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));

        console.log(
            `Starting pricing check (price search unrestricted, buy-link search uses the UK retailer whitelist, ` +
                `stale after ${PRICE_STALE_DAYS} days${FORCE_RECHECK ? ', --force: staleness ignored' : ''}` +
                `${SKIP_STAGE_2 ? ', stage 2 disabled' : ''}` +
                `${MANUFACTURER_FILTER ? `, manufacturer filter: "${MANUFACTURER_FILTER}"` : ''})...\n`
        );

        for (const file of jsonFiles) {
            const filePath = path.join(PANELS_DIR, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let panels = JSON.parse(fileData);
            let fileModified = false;

            for (let i = 0; i < panels.length; i++) {
                let panel = panels[i];
                if (!panel.model) continue;
                if (MANUFACTURER_FILTER && !String(panel.manufacturer || '').toLowerCase().includes(MANUFACTURER_FILTER)) {
                    continue;
                }

                // Housekeeping runs unconditionally (no API cost): drop any existing buyLinks
                // entry that's a Google aggregator page, a straight PDF, a damaged/clearance
                // listing, or already pointing at a soft-error path (e.g. /error-500),
                // regardless of which past script wrote it - this is what actually cleans up
                // e.g. the MCS-certificate PDFs panel-availability-scan.js has historically
                // picked up from whitelisted domains, since a fresh price/link search wouldn't
                // remove those on its own - and strip tracking query strings from whatever
                // survives. Dead product URLs that only *redirect* to a soft-error page are
                // handled later when stage 2 fetches them (path alone can't see the redirect).
                const linksBefore = panel.buyLinks.length;
                const seenDomains = new Set();
                panel.buyLinks = panel.buyLinks
                    .filter(
                        (link) =>
                            !isPdfLink(link.URL) &&
                            !isGoogleAggregatorLink(link.URL) &&
                            !isClearanceOrDamagedListing(link.Supplier, link.URL) &&
                            !isSoftErrorPageUrl(link.URL)
                    )
                    .map((link) => ({ ...link, URL: stripTrackingParams(link.URL) }))
                    // One entry per supplier domain - keep the first if older runs stacked
                    // duplicates from the same site before replace-on-upsert existed.
                    .filter((link) => {
                        const domain = supplierDomain(link.URL);
                        if (!domain) return true;
                        if (seenDomains.has(domain)) return false;
                        seenDomains.add(domain);
                        return true;
                    });
                if (panel.buyLinks.length !== linksBefore) {
                    logOutput += `[CLEANED] ${panel.manufacturer} ${panel.model} - removed ${linksBefore - panel.buyLinks.length} stale Google/PDF/clearance/soft-error/duplicate-domain buy link(s)\n`;
                    fileModified = true;
                }

                if (!needsPriceCheck(panel)) {
                    panelsSkippedFresh++;
                    continue;
                }

                panelsChecked++;
                process.stdout.write(`Checking ${panel.manufacturer} ${panel.model}... `);

                const stage1 = await searchShopping(panel);
                await sleep(REQUEST_DELAY_MS);

                if (!stage1) {
                    process.stdout.write('Not found.\n');
                    logOutput += `[NOT FOUND] ${panel.manufacturer} ${panel.model}\n`;
                    panel.priceCheckedAt = new Date().toISOString().slice(0, 10);
                    fileModified = true;
                    continue;
                }

                let finalPrice = parsePriceText(stage1.priceText);
                let priceSource = 'stage1 (shopping snippet)';

                // Gather every usable buy link available: the shopping search's own link (rarely
                // usable - see file header) plus every distinct-supplier match from the
                // whitelisted retailer search. A panel is often genuinely stocked by several of
                // the whitelisted retailers at once, so all of them are kept, not just the first.
                process.stdout.write('(searching for retailer buy links) ');
                const distributorLinks = await searchDistributorLink(panel);
                await sleep(REQUEST_DELAY_MS);

                let linkInfos = stage1.hasUsableLink
                    ? [{ link: stripTrackingParams(stage1.link), source: stage1.source }]
                    : [];
                linkInfos = linkInfos.concat(distributorLinks);

                // De-dup by (already tracking-stripped) URL - the shopping link and an organic
                // hit can coincidentally land on the exact same retailer page.
                const seenUrls = new Set();
                linkInfos = linkInfos.filter((info) => {
                    if (seenUrls.has(info.link)) return false;
                    seenUrls.add(info.link);
                    return true;
                });

                // Stage 2 walks candidate buy links until one is a live product page. Soft-error
                // redirects (City Plumbing dead SKUs → /error-500) and hard failures drop that
                // candidate from both this run's linkInfos and the panel's stored buyLinks, then
                // the next supplier is tried. Only the first live page is used for price
                // extraction - unprobed later candidates are kept optimistically (re-checked on
                // a future run if they later go dead).
                let stage2Note;
                let stage2Price = null;
                if (linkInfos.length === 0) {
                    stage2Note = 'skipped - no usable merchant link found (only Google aggregator/PDF results)';
                } else if (SKIP_STAGE_2) {
                    stage2Note = 'skipped (--nofetch)';
                } else {
                    process.stdout.write('(checking retailer page for stage 2) ');
                    const surviving = [];
                    let softErrorsDropped = 0;
                    let foundLivePage = false;

                    for (let i = 0; i < linkInfos.length; i++) {
                        const info = linkInfos[i];

                        // Once we have a live page (and its price attempt), keep the remaining
                        // unprobed candidates without fetching them.
                        if (foundLivePage) {
                            surviving.push(info);
                            continue;
                        }

                        const page = await fetchMerchantPage(info.link);
                        await sleep(REQUEST_DELAY_MS);

                        // Soft-error pages (City Plumbing → /error-500) are genuinely dead and
                        // get removed from stored buyLinks. A plain 403/401 from a bot wall or
                        // trade login is NOT treated as dead - the link may still work for a
                        // human browser, so it stays in surviving/buyLinks, we just can't read
                        // a price from it.
                        const softError =
                            isSoftErrorPageUrl(page.finalUrl) || looksLikeSoftErrorHtml(page.html);
                        if (softError) {
                            softErrorsDropped++;
                            const before = panel.buyLinks.length;
                            panel.buyLinks = panel.buyLinks.filter((link) => link.URL !== info.link);
                            if (panel.buyLinks.length !== before) fileModified = true;
                            continue;
                        }

                        surviving.push(info);
                        if (!page.ok) continue; // keep link, try next candidate for a price

                        foundLivePage = true;
                        stage2Price = extractPriceFromHtml(page.html);
                    }

                    linkInfos = surviving;

                    if (stage2Price !== null) {
                        finalPrice = stage2Price;
                        priceSource = 'stage2 (retailer page)';
                        stage2Note = `confirmed £${stage2Price} on the retailer page`;
                    } else if (linkInfos.length === 0 && softErrorsDropped > 0) {
                        stage2Note = `ran - ${softErrorsDropped} candidate link(s) were dead/soft-error pages; no live merchant page left`;
                    } else {
                        stage2Note = 'ran, but found no confirmed GBP price on the page - kept stage 1 price';
                    }
                    if (softErrorsDropped > 0 && linkInfos.length > 0) {
                        stage2Note += ` (dropped ${softErrorsDropped} dead/soft-error link(s))`;
                    }
                }

                // Sanity gate: a price whose implied £/W ratio is wildly outside what a single
                // panel actually costs is rejected rather than trusted - see
                // `priceLooksPlausible` for the real £1664-for-a-410W-panel case this catches.
                // The panel's previous (presumably sane) price is left untouched.
                if (finalPrice !== null && !priceLooksPlausible(finalPrice, panel.power)) {
                    stage2Note += ` - REJECTED: £${finalPrice} for ${panel.power}W is £${(finalPrice / panel.power).toFixed(2)}/W, outside the plausible range; previous price kept`;
                    finalPrice = null;
                }

                panel.priceCheckedAt = new Date().toISOString().slice(0, 10);

                // Buy links are upserted by supplier domain regardless of whether the price
                // itself was usable - a new URL from the same retailer replaces the old one
                // (slug renames, moved product pages) instead of stacking duplicates. Link
                // quality is validated independently, up in searchShopping/searchDistributorLink.
                for (const info of linkInfos) {
                    const changed = upsertBuyLinkByDomain(panel.buyLinks, {
                        Supplier: info.source,
                        URL: info.link,
                        isAffiliate: false,
                        Checked: false,
                    });
                    if (changed) fileModified = true;
                }

                if (finalPrice !== null) {
                    const outcome = linkInfos.length > 0 ? 'UPDATED' : 'PRICE ONLY (no usable buy link found)';
                    process.stdout.write(
                        `£${finalPrice} via ${priceSource}${linkInfos.length > 0 ? ` (${linkInfos.length} supplier link(s))` : ''}\n`
                    );
                    logOutput +=
                        `[${outcome}] ${panel.manufacturer} ${panel.model}\n` +
                        `  -> Price: £${finalPrice} [${priceSource}]\n` +
                        `  -> Stage 2: ${stage2Note}\n` +
                        linkInfos.map((info) => `  -> URL (${info.source}): ${info.link}\n`).join('') +
                        '\n';

                    panel.price = finalPrice;
                    panel.availableUK = true;
                    panelsUpdated++;
                } else if (linkInfos.length > 0) {
                    // The price was rejected or unreadable, but usable buy links were still
                    // found (and already stored above) - worth recording distinctly rather than
                    // silently dropping the link discovery just because the price failed.
                    process.stdout.write(`Found ${linkInfos.length} buy link(s), but no usable price.\n`);
                    logOutput +=
                        `[LINKS ONLY] ${panel.manufacturer} ${panel.model} - added ${linkInfos.length} buy link(s), price unusable\n` +
                        `  -> Stage 2: ${stage2Note}\n` +
                        linkInfos.map((info) => `  -> URL (${info.source}): ${info.link}\n`).join('') +
                        '\n';
                    panelsUpdated++;
                } else {
                    process.stdout.write('Found listing, but no price could be parsed.\n');
                    logOutput += `[NO PRICE] ${panel.manufacturer} ${panel.model} - listing found but price unreadable\n  -> Stage 2: ${stage2Note}\n\n`;
                }

                fileModified = true;
            }

            if (fileModified) {
                await fs.writeFile(filePath, JSON.stringify(panels, null, 4));
            }
        }

        logOutput += `\n--- SUMMARY ---\nPanels Checked: ${panelsChecked}\nPanels Updated: ${panelsUpdated}\nSkipped (fresh): ${panelsSkippedFresh}\n`;

        await fs.writeFile(LOG_FILE, logOutput);
        console.log(
            `\nProcess complete. ${panelsUpdated} panels updated, ${panelsSkippedFresh} skipped as fresh. Log saved to: ${LOG_FILE}`
        );
    } catch (error) {
        console.error('A fatal error occurred:', error);
    }
}

// Only auto-run when executed directly (`node panel-pricing-scan.js`), not when imported
// for unit testing the pure helper functions above.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
