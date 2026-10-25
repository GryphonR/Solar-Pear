/**
 * @file pricingScan.js
 * Shared multi-stage pricing + buy-link scan used by panel and controller entry scripts.
 *
 * Stages:
 *   1  - Serper shopping: every relevant single-unit £ listing, reduced to a consensus price
 *   1b - Whitelisted organic search (in batches) for real retailer product pages
 *   2  - Fetch each candidate page (optional via --nofetch): check it is this product, read its
 *        stock state and its price (normalised to inc VAT), and take the median across retailers
 *
 * All prices are stored inc VAT. `priceCheckedAt` is stamped only when a price is written; every
 * scan, priced or not, is recorded in `pricing-scan-state.json` so unpriced products aren't
 * re-searched every run. Anything uncertain goes into a review report (`logs/<label>-pricing-review.md`).
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { isAffiliateLink, stripTrackingParams, supplierDomain, upsertBuyLinkByDomain } from './buyLinks.js';
import { isMarketplaceLink } from './listingMatch.js';
import { LOGS_DIR, PRICING_STATE_PATH } from './paths.js';
import { extractPriceDetails, fetchMerchantPage, pageIdentityText } from './priceExtract.js';
import { consensusPrice, REQUEST_DELAY_MS, searchDistributorLink, searchShopping, sleep } from './serper.js';
import {
    isClearanceOrDamagedListing,
    isGoogleAggregatorLink,
    isPdfLink,
    isSoftErrorPageUrl,
    looksLikeSoftErrorHtml,
} from './urlQuality.js';

/** A price-only result (no retailer page) needs at least this many agreeing listings. */
export const MIN_AGREEING_FOR_PRICE_ONLY = 3;
/** Review flag thresholds. */
export const PRICE_CHANGE_REVIEW_FRACTION = 0.25;
export const SOURCE_DISAGREEMENT_FRACTION = 0.25;

const today = () => new Date().toISOString().slice(0, 10);

/** @param {string} isoDate */
function ageDays(isoDate) {
    const t = new Date(isoDate).getTime();
    return Number.isNaN(t) ? Infinity : (Date.now() - t) / (1000 * 60 * 60 * 24);
}

/**
 * A product is due for a re-check if it has never been checked, has no recorded price, or its
 * last check is older than `staleDays`. A recent entry in the scan state (`lastScannedAt`)
 * counts as checked too, so a product that wasn't found isn't searched again every run.
 * @param {{ price: number, priceCheckedAt: string }} item
 * @param {{ forceRecheck?: boolean, staleDays?: number, lastScannedAt?: string }} [opts]
 */
export function needsPriceCheck(item, opts = {}) {
    if (opts.forceRecheck) return true;
    const staleDays = opts.staleDays ?? 30;
    if (opts.lastScannedAt && ageDays(opts.lastScannedAt) < staleDays) return false;
    if (!item.priceCheckedAt || !item.price) return true;
    return ageDays(item.priceCheckedAt) >= staleDays;
}

/**
 * Drops known-bad existing buyLinks (PDF, Google aggregator, marketplace, clearance, soft-error
 * path, duplicate domains) and strips tracking params. Affiliate entries are left exactly as they
 * are (roadmap 4.4), and when a domain has both, the affiliate entry is the one kept. Returns
 * whether the list changed.
 * @param {object} item
 */
export function cleanExistingBuyLinks(item) {
    if (!Array.isArray(item.buyLinks)) {
        item.buyLinks = [];
        return false;
    }
    const before = JSON.stringify(item.buyLinks);
    const affiliateDomains = new Set(
        item.buyLinks.filter(isAffiliateLink).map((link) => supplierDomain(link.URL)).filter(Boolean)
    );
    const seenDomains = new Set();
    item.buyLinks = item.buyLinks
        .filter(
            (link) =>
                isAffiliateLink(link) ||
                (!isPdfLink(link.URL) &&
                    !isGoogleAggregatorLink(link.URL) &&
                    !isMarketplaceLink(link.URL) &&
                    !isClearanceOrDamagedListing(link.Supplier, link.URL) &&
                    !isSoftErrorPageUrl(link.URL))
        )
        .map((link) => (isAffiliateLink(link) ? link : { ...link, URL: stripTrackingParams(link.URL) }))
        .filter((link) => {
            if (isAffiliateLink(link)) return true;
            const domain = supplierDomain(link.URL);
            if (!domain) return true;
            if (affiliateDomains.has(domain) || seenDomains.has(domain)) return false;
            seenDomains.add(domain);
            return true;
        });
    return JSON.stringify(item.buyLinks) !== before;
}

/**
 * Upserts a scanned link and records what the page said about it (per-retailer price, stock),
 * leaving affiliate entries untouched. Returns whether the list changed.
 * @param {object[]} buyLinks
 * @param {{ source: string, link: string, price?: number | null, inStock?: boolean | null }} info
 */
export function recordBuyLink(buyLinks, info) {
    let changed = upsertBuyLinkByDomain(buyLinks, {
        Supplier: info.source,
        URL: info.link,
        isAffiliate: false,
        Checked: false,
    });
    const entry = buyLinks.find((l) => l.URL === info.link && !isAffiliateLink(l));
    if (!entry) return changed;
    if (Number.isFinite(info.price) && info.price > 0 && entry.price !== info.price) {
        entry.price = info.price;
        entry.priceCheckedAt = today();
        changed = true;
    }
    if (typeof info.inStock === 'boolean' && entry.inStock !== info.inStock) {
        entry.inStock = info.inStock;
        changed = true;
    }
    return changed;
}

/**
 * Probes one candidate page: is it live, is it this product, is it still sold, and what does it
 * charge (inc VAT)?
 * @param {{ link: string, source: string }} info
 * @param {(text: string, ctx?: { url?: string }) => boolean} isThisProduct
 * @returns {Promise<{ verdict: 'dead' | 'other-product' | 'discontinued' | 'unverified' | 'ok', price?: number | null, details?: object | null, inStock?: boolean | null, identity?: string, status?: string | number }>}
 */
export async function probeCandidate(info, isThisProduct, fetchPage = fetchMerchantPage) {
    const page = await fetchPage(info.link);
    if (isSoftErrorPageUrl(page.finalUrl) || looksLikeSoftErrorHtml(page.html)) return { verdict: 'dead' };
    if (typeof page.status === 'number' && (page.status === 404 || page.status === 410)) return { verdict: 'dead' };
    // Blocked (403), timed out or otherwise unreadable: the search result already passed the
    // title check, so keep the link, but don't trust a price we couldn't read.
    if (!page.ok) return { verdict: 'unverified', status: page.status };

    const identity = pageIdentityText(page.html);
    if (identity && !isThisProduct(identity, { url: page.finalUrl })) {
        return { verdict: 'other-product', identity };
    }
    const details = extractPriceDetails(page.html, { matchesProduct: (text) => isThisProduct(text) });
    if (details?.stock === 'discontinued') return { verdict: 'discontinued' };
    return {
        verdict: identity ? 'ok' : 'unverified',
        price: details?.price ?? null,
        details,
        inStock: details?.stock ? details.stock === 'in-stock' : null,
        identity,
    };
}

/**
 * Decides the price to write from the page samples and the shopping consensus.
 * @param {{ pagePrices: number[], shopping: { price: number, agreeing: number } | null, hasBuyLink: boolean }} input
 * @returns {{ price: number | null, source: string, reviewFlags: string[], rejected?: string }}
 */
export function choosePrice({ pagePrices, shopping, hasBuyLink }) {
    const reviewFlags = [];
    if (pagePrices.length > 0) {
        const pages = consensusPrice(pagePrices);
        const source =
            pagePrices.length > 1
                ? `median of ${pages.used.length} retailer page(s) [${pagePrices.map((p) => `£${p}`).join(', ')}]`
                : `retailer page £${pagePrices[0]}`;
        if (pages.outliers.length > 0) reviewFlags.push(`ignored outlier page price(s) ${pages.outliers.map((p) => `£${p}`).join(', ')}`);
        const shoppingAgrees = shopping && Math.abs(shopping.price - pages.price) / pages.price <= SOURCE_DISAGREEMENT_FRACTION;
        if (shopping && !shoppingAgrees) {
            reviewFlags.push(`retailer pages (£${pages.price}) and Google Shopping (£${shopping.price}) disagree`);
        }
        if (pages.used.length === 1 && !shoppingAgrees) reviewFlags.push('single source');
        return { price: pages.price, source, reviewFlags };
    }
    if (!shopping) return { price: null, source: 'none', reviewFlags };

    const source = `Google Shopping consensus (${shopping.agreeing} agreeing listing(s))`;
    if (!hasBuyLink && shopping.agreeing < MIN_AGREEING_FOR_PRICE_ONLY) {
        return {
            price: null,
            source,
            reviewFlags,
            rejected: `£${shopping.price} is PRICE ONLY with ${shopping.agreeing} agreeing listing(s) (need ${MIN_AGREEING_FOR_PRICE_ONLY})`,
        };
    }
    if (shopping.agreeing < 2) reviewFlags.push('single source');
    return { price: shopping.price, source, reviewFlags };
}

/**
 * Products that share a price with a same-group sibling after this run: usually the same listing
 * matched to two catalogue records.
 * @param {Array<{ item: object, label: string }>} updated items whose price this run wrote
 * @param {(item: object) => string} groupKey
 * @param {(item: object) => string} identity
 */
export function findSharedPrices(updated, groupKey, identity) {
    const byGroupPrice = new Map();
    for (const u of updated) {
        const key = `${groupKey(u.item)}|${u.item.price}`;
        if (!byGroupPrice.has(key)) byGroupPrice.set(key, []);
        byGroupPrice.get(key).push(u);
    }
    const shared = [];
    for (const group of byGroupPrice.values()) {
        if (new Set(group.map((u) => identity(u.item))).size > 1) shared.push(group);
    }
    return shared;
}

/**
 * Markdown review report: one section per product that needs a human or agent to look.
 * @param {string} title
 * @param {Array<{ label: string, flags: string[], lines: string[] }>} entries
 * @param {{ checked: number, updated: number, skippedFresh: number }} totals
 */
export function formatReviewReport(title, entries, totals) {
    let out = `# ${title}\n\n`;
    out += `Checked ${totals.checked}, prices written ${totals.updated}, skipped as fresh ${totals.skippedFresh}. `;
    out += entries.length === 0 ? 'Nothing needs review.\n' : `**${entries.length} product(s) need review.**\n`;
    for (const e of entries) {
        out += `\n## ${e.label}\n\n`;
        out += e.flags.map((f) => `- ⚠ ${f}\n`).join('');
        out += e.lines.map((l) => `- ${l}\n`).join('');
    }
    return out;
}

async function loadState() {
    try {
        return JSON.parse(await fs.readFile(PRICING_STATE_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

/**
 * Runs the shared pricing scan over a catalog directory.
 *
 * @param {object} config
 * @param {string} config.dataDir
 * @param {'panels' | 'controllers'} config.catalogKey
 * @param {string} config.logPrefix e.g. `panel_pricing_check_log`
 * @param {string} config.productLabel singular, e.g. `panel` / `controller`
 * @param {string} config.apiKey
 * @param {boolean} config.forceRecheck
 * @param {boolean} config.skipStage2
 * @param {string | null} config.manufacturerFilter
 * @param {number} config.priceStaleDays
 * @param {(item: object) => string | null | undefined} config.getModel search identity
 * @param {(item: object) => string} config.getKey stable record key for the scan state
 * @param {(item: object, catalogue: object[]) => object[]} config.getSiblings records a listing could be confused with
 * @param {(title: string, item: object, ctx: { url?: string, siblings?: object[] }) => boolean} config.titleLooksRelevant
 * @param {(price: number, item: object, ctx: { hasBuyLink: boolean, catalogue: object[] }) => string | null} config.priceRejectionReason
 * @param {(item: object) => string} config.formatLabel human-readable id for logs
 * @param {(item: object) => string} config.sharedPriceGroup records in one group shouldn't share a price
 */
export async function runPricingScan(config) {
    const {
        dataDir,
        catalogKey,
        logPrefix,
        productLabel,
        apiKey,
        forceRecheck,
        skipStage2,
        manufacturerFilter,
        priceStaleDays,
        getModel,
        getKey,
        getSiblings,
        titleLooksRelevant,
        priceRejectionReason,
        formatLabel,
        sharedPriceGroup,
    } = config;

    if (!apiKey) {
        console.error('ERROR: Provide your Serper.dev API key via SERPER_API_KEY env, or --api=YOUR_KEY as fallback.');
        console.error(
            `Usage: SERPER_API_KEY=xyz123 node verification_scripts/${productLabel}-pricing-scan.js [--force] [--nofetch]`
        );
        process.exit(1);
    }

    const plural = `${productLabel}s`;
    let logOutput = `=== ${productLabel.toUpperCase()} PRICING CHECK LOG ===\n\nAll prices inc VAT.\n\n`;
    const totals = { checked: 0, updated: 0, skippedFresh: 0 };
    const review = [];
    const updatedItems = [];

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `${logPrefix}_${Date.now()}.txt`);
        const REVIEW_FILE = path.join(LOGS_DIR, `${productLabel}-pricing-review.md`);

        const state = await loadState();
        state[catalogKey] = state[catalogKey] || {};
        const scanState = state[catalogKey];

        const jsonFiles = (await fs.readdir(dataDir)).filter((f) => f.endsWith('.json'));
        const files = [];
        for (const file of jsonFiles) {
            const filePath = path.join(dataDir, file);
            files.push({ filePath, items: JSON.parse(await fs.readFile(filePath, 'utf-8')), modified: false });
        }
        // The whole catalogue, for sibling matching and series price checks.
        const catalogue = files.flatMap((f) => f.items);

        console.log(
            `Starting pricing check (prices inc VAT, buy-link search uses the UK retailer whitelist, ` +
                `stale after ${priceStaleDays} days${forceRecheck ? ', --force: staleness ignored' : ''}` +
                `${skipStage2 ? ', stage 2 disabled' : ''}` +
                `${manufacturerFilter ? `, manufacturer filter: "${manufacturerFilter}"` : ''})...\n`
        );

        for (const file of files) {
            for (const item of file.items) {
                if (!getModel(item)) continue;
                if (manufacturerFilter && !String(item.manufacturer || '').toLowerCase().includes(manufacturerFilter)) {
                    continue;
                }
                const label = formatLabel(item);
                const key = getKey(item);

                // Housekeeping runs unconditionally (no API cost).
                if (cleanExistingBuyLinks(item)) {
                    logOutput += `[CLEANED] ${label} - removed stale Google/PDF/marketplace/clearance/soft-error/duplicate-domain buy link(s)\n`;
                    file.modified = true;
                }

                if (
                    !needsPriceCheck(item, {
                        forceRecheck,
                        staleDays: priceStaleDays,
                        lastScannedAt: scanState[key]?.lastScannedAt,
                    })
                ) {
                    totals.skippedFresh++;
                    continue;
                }

                totals.checked++;
                process.stdout.write(`Checking ${label}... `);

                const siblings = getSiblings(item, catalogue);
                const relevant = (title, it, ctx = {}) => titleLooksRelevant(title, it, { ...ctx, siblings });
                const isThisProduct = (text, ctx = {}) => relevant(text, item, ctx);
                const searchOpts = { apiKey, catalogKey, getModel, titleLooksRelevant: relevant };
                const flags = [];
                const lines = [];

                const shopping = await searchShopping(item, searchOpts);
                await sleep(REQUEST_DELAY_MS);
                if (shopping) {
                    lines.push(
                        `Shopping: £${shopping.price} from ${shopping.samples.length} listing(s) [${shopping.samples
                            .map((s) => `${s.source || '?'} £${s.price}`)
                            .join(', ')}]`
                    );
                    if (shopping.outliers.length > 0) {
                        lines.push(`Shopping outliers ignored: ${shopping.outliers.map((p) => `£${p}`).join(', ')}`);
                    }
                }

                process.stdout.write('(searching retailers) ');
                const distributorLinks = await searchDistributorLink(item, searchOpts);

                let candidates = shopping?.hasUsableLink
                    ? [{ link: stripTrackingParams(shopping.link), source: supplierDomain(shopping.link) || shopping.source }]
                    : [];
                candidates = candidates.concat(distributorLinks);
                const seenUrls = new Set();
                candidates = candidates.filter((c) => !seenUrls.has(c.link) && seenUrls.add(c.link));

                // Stage 2: verify every candidate page.
                const kept = [];
                const pagePrices = [];
                if (candidates.length > 0 && !skipStage2) {
                    process.stdout.write('(checking retailer pages) ');
                    for (const info of candidates) {
                        const probe = await probeCandidate(info, isThisProduct);
                        await sleep(REQUEST_DELAY_MS);
                        if (probe.verdict === 'dead' || probe.verdict === 'discontinued') {
                            const before = item.buyLinks.length;
                            // Affiliate entries are never removed automatically; link health is checked separately (4.11).
                            item.buyLinks = item.buyLinks.filter((l) => l.URL !== info.link || isAffiliateLink(l));
                            if (item.buyLinks.length !== before) file.modified = true;
                            lines.push(`Dropped ${info.link} (${probe.verdict === 'dead' ? 'dead page' : 'listed as discontinued'})`);
                            continue;
                        }
                        if (probe.verdict === 'other-product') {
                            flags.push(`${info.source} page is a different product ("${probe.identity.slice(0, 120)}"); link not added`);
                            continue;
                        }
                        kept.push({ ...info, price: probe.price, inStock: probe.inStock });
                        if (probe.verdict === 'unverified') {
                            lines.push(`${info.source}: page not readable (${probe.status ?? 'no title'}); link kept, price not used`);
                            continue;
                        }
                        if (probe.details?.conflict) flags.push(`${info.source}: VAT basis unclear (${probe.details.raw})`);
                        if (probe.inStock === false) lines.push(`${info.source}: out of stock`);
                        if (probe.price !== null) {
                            pagePrices.push(probe.price);
                            lines.push(`${info.source}: £${probe.price} (${probe.details.source})`);
                        } else {
                            lines.push(`${info.source}: no price on the page`);
                        }
                    }
                } else {
                    kept.push(...candidates);
                    if (candidates.length > 0) lines.push('Stage 2 skipped (--nofetch)');
                }

                for (const info of kept) {
                    // The same sanity rules as the product price apply to each retailer's price.
                    const reason = Number.isFinite(info.price) ? priceRejectionReason(info.price, item, { hasBuyLink: true, catalogue }) : null;
                    if (reason) flags.push(`${info.source}: page price £${info.price} not stored on the link (${reason})`);
                    if (recordBuyLink(item.buyLinks, reason ? { ...info, price: null } : info)) file.modified = true;
                }

                const hasBuyLink = kept.length > 0;
                const choice = choosePrice({ pagePrices, shopping, hasBuyLink });
                let finalPrice = choice.price;
                flags.push(...choice.reviewFlags);
                if (choice.rejected) flags.push(`REJECTED: ${choice.rejected}; previous price kept`);
                if (finalPrice !== null) {
                    const reason = priceRejectionReason(finalPrice, item, { hasBuyLink, catalogue });
                    if (reason) {
                        flags.push(`REJECTED: ${reason}; previous price kept`);
                        finalPrice = null;
                    }
                }

                let outcome;
                if (finalPrice !== null) {
                    const oldPrice = Number(item.price) || 0;
                    if (oldPrice > 0 && Math.abs(finalPrice - oldPrice) / oldPrice > PRICE_CHANGE_REVIEW_FRACTION) {
                        flags.push(`price moved ${Math.round(((finalPrice - oldPrice) / oldPrice) * 100)}% (£${oldPrice} → £${finalPrice})`);
                    }
                    item.price = finalPrice;
                    item.priceCheckedAt = today();
                    item.availableUK = true;
                    updatedItems.push({ item, label });
                    totals.updated++;
                    file.modified = true;
                    outcome = hasBuyLink ? 'UPDATED' : 'PRICE ONLY';
                    process.stdout.write(`£${finalPrice} via ${choice.source}${hasBuyLink ? ` (${kept.length} link(s))` : ''}\n`);
                } else if (hasBuyLink) {
                    outcome = 'LINKS ONLY';
                    process.stdout.write(`${kept.length} buy link(s), no usable price.\n`);
                } else if (shopping) {
                    outcome = 'NO PRICE';
                    process.stdout.write('Listing found, but no usable price.\n');
                } else {
                    outcome = 'NOT FOUND';
                    process.stdout.write('Not found.\n');
                }

                scanState[key] = { lastScannedAt: today(), outcome };
                logOutput +=
                    `[${outcome}] ${label}\n` +
                    (finalPrice !== null ? `  -> Price: £${finalPrice} [${choice.source}]\n` : '') +
                    lines.map((l) => `  -> ${l}\n`).join('') +
                    flags.map((f) => `  !! ${f}\n`).join('') +
                    kept.map((info) => `  -> URL (${info.source}): ${info.link}\n`).join('') +
                    '\n';
                if (flags.length > 0) review.push({ label, flags, lines });
            }
        }

        // Two records sharing a fresh price usually means one listing matched both.
        for (const group of findSharedPrices(updatedItems, sharedPriceGroup, getKey)) {
            const names = group.map((u) => u.label).join(', ');
            for (const u of group) {
                const flag = `same price (£${u.item.price}) as a sibling this run: ${names}`;
                const entry = review.find((r) => r.label === u.label);
                if (entry) entry.flags.push(flag);
                else review.push({ label: u.label, flags: [flag], lines: [] });
            }
        }

        for (const file of files) {
            if (file.modified) await fs.writeFile(file.filePath, JSON.stringify(file.items, null, 4));
        }
        await fs.writeFile(PRICING_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);

        const cap = `${plural[0].toUpperCase()}${plural.slice(1)}`;
        logOutput += `\n--- SUMMARY ---\n${cap} Checked: ${totals.checked}\n${cap} Price written: ${totals.updated}\nSkipped (fresh): ${totals.skippedFresh}\nNeed review: ${review.length}\n`;
        await fs.writeFile(LOG_FILE, logOutput);
        await fs.writeFile(REVIEW_FILE, formatReviewReport(`${cap} pricing review`, review, totals));
        console.log(
            `\nProcess complete. ${totals.updated} ${plural} priced, ${totals.skippedFresh} skipped as fresh, ` +
                `${review.length} need review.\nLog: ${LOG_FILE}\nReview: ${REVIEW_FILE}`
        );
    } catch (error) {
        console.error('A fatal error occurred:', error);
        process.exitCode = 1;
    }
}
