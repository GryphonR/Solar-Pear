/**
 * @file pricingScan.js
 * Shared multi-stage pricing + buy-link scan used by panel and controller entry scripts.
 *
 * Stages (same trade-offs as the original panel-pricing-scan header docs):
 *   1  - Serper shopping (£ + relevance) for a price snippet
 *   1b - Whitelisted organic search for real retailer buy links
 *   2  - Fetch merchant page for JSON-LD / meta GBP price (optional via --nofetch)
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { stripTrackingParams, supplierDomain, upsertBuyLinkByDomain } from './buyLinks.js';
import { LOGS_DIR } from './paths.js';
import { extractPriceFromHtml, fetchMerchantPage, medianPrice, parsePriceText } from './priceExtract.js';
import { REQUEST_DELAY_MS, searchDistributorLink, searchShopping, sleep } from './serper.js';
import {
    isClearanceOrDamagedListing,
    isGoogleAggregatorLink,
    isPdfLink,
    isSoftErrorPageUrl,
    looksLikeSoftErrorHtml,
} from './urlQuality.js';

/**
 * A product is due for a re-check if it has never been checked, has no recorded price, or its
 * last check is older than `staleDays`.
 * @param {{ price: number, priceCheckedAt: string }} item
 * @param {{ forceRecheck?: boolean, staleDays?: number }} [opts]
 */
export function needsPriceCheck(item, opts = {}) {
    if (opts.forceRecheck) return true;
    if (!item.priceCheckedAt || !item.price) return true;

    const checkedAt = new Date(item.priceCheckedAt);
    if (Number.isNaN(checkedAt.getTime())) return true;

    const staleDays = opts.staleDays ?? 30;
    const ageDays = (Date.now() - checkedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= staleDays;
}

/**
 * Drops known-bad existing buyLinks (PDF, Google aggregator, clearance, soft-error path,
 * duplicate domains) and strips tracking params. Returns whether the list changed.
 * @param {object} item
 */
export function cleanExistingBuyLinks(item) {
    if (!Array.isArray(item.buyLinks)) {
        item.buyLinks = [];
        return false;
    }
    const linksBefore = item.buyLinks.length;
    const seenDomains = new Set();
    item.buyLinks = item.buyLinks
        .filter(
            (link) =>
                !isPdfLink(link.URL) &&
                !isGoogleAggregatorLink(link.URL) &&
                !isClearanceOrDamagedListing(link.Supplier, link.URL) &&
                !isSoftErrorPageUrl(link.URL)
        )
        .map((link) => ({ ...link, URL: stripTrackingParams(link.URL) }))
        .filter((link) => {
            const domain = supplierDomain(link.URL);
            if (!domain) return true;
            if (seenDomains.has(domain)) return false;
            seenDomains.add(domain);
            return true;
        });
    return item.buyLinks.length !== linksBefore;
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
 * @param {(item: object) => string | null | undefined} config.getModel
 * @param {(title: string, item: object) => boolean} config.titleLooksRelevant
 * @param {(price: number, item: object, ctx: { hasBuyLink: boolean }) => boolean} config.priceLooksPlausible
 * @param {(item: object) => string} config.formatLabel human-readable id for logs
 * @param {(price: number, item: object, ctx: { hasBuyLink: boolean }) => string} [config.formatRejectionNote]
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
        titleLooksRelevant,
        priceLooksPlausible,
        formatLabel,
        formatRejectionNote,
    } = config;

    if (!apiKey) {
        console.error('ERROR: Provide your Serper.dev API key via SERPER_API_KEY env, or --api=YOUR_KEY as fallback.');
        console.error(
            `Usage: SERPER_API_KEY=xyz123 node verification_scripts/${productLabel}-pricing-scan.js [--force] [--nofetch]`
        );
        process.exit(1);
    }

    const plural = `${productLabel}s`;
    let logOutput = `=== ${productLabel.toUpperCase()} PRICING CHECK LOG ===\n\n`;
    let checked = 0;
    let updated = 0;
    let skippedFresh = 0;

    const searchOpts = { apiKey, catalogKey, getModel, titleLooksRelevant };

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `${logPrefix}_${Date.now()}.txt`);

        const files = await fs.readdir(dataDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));

        console.log(
            `Starting pricing check (price search unrestricted, buy-link search uses the UK retailer whitelist, ` +
                `stale after ${priceStaleDays} days${forceRecheck ? ', --force: staleness ignored' : ''}` +
                `${skipStage2 ? ', stage 2 disabled' : ''}` +
                `${manufacturerFilter ? `, manufacturer filter: "${manufacturerFilter}"` : ''})...\n`
        );

        for (const file of jsonFiles) {
            const filePath = path.join(dataDir, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let items = JSON.parse(fileData);
            let fileModified = false;

            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                if (!getModel(item)) continue;
                if (manufacturerFilter && !String(item.manufacturer || '').toLowerCase().includes(manufacturerFilter)) {
                    continue;
                }

                // Housekeeping runs unconditionally (no API cost).
                const cleaned = cleanExistingBuyLinks(item);
                if (cleaned) {
                    const label = formatLabel(item);
                    logOutput += `[CLEANED] ${label} - removed stale Google/PDF/clearance/soft-error/duplicate-domain buy link(s)\n`;
                    fileModified = true;
                }

                if (!needsPriceCheck(item, { forceRecheck, staleDays: priceStaleDays })) {
                    skippedFresh++;
                    continue;
                }

                checked++;
                const label = formatLabel(item);
                process.stdout.write(`Checking ${label}... `);

                const stage1 = await searchShopping(item, searchOpts);
                await sleep(REQUEST_DELAY_MS);

                if (!stage1) {
                    process.stdout.write('Not found.\n');
                    logOutput += `[NOT FOUND] ${label}\n`;
                    item.priceCheckedAt = new Date().toISOString().slice(0, 10);
                    fileModified = true;
                    continue;
                }

                let finalPrice = parsePriceText(stage1.priceText);
                let priceSource = 'stage1 (shopping snippet)';

                process.stdout.write('(searching for retailer buy links) ');
                const distributorLinks = await searchDistributorLink(item, searchOpts);
                await sleep(REQUEST_DELAY_MS);

                let linkInfos = stage1.hasUsableLink
                    ? [{ link: stripTrackingParams(stage1.link), source: stage1.source }]
                    : [];
                linkInfos = linkInfos.concat(distributorLinks);

                const seenUrls = new Set();
                linkInfos = linkInfos.filter((info) => {
                    if (seenUrls.has(info.link)) return false;
                    seenUrls.add(info.link);
                    return true;
                });

                let stage2Note;
                let stage2Price = null;
                if (linkInfos.length === 0) {
                    stage2Note = 'skipped - no usable merchant link found (only Google aggregator/PDF results)';
                } else if (skipStage2) {
                    stage2Note = 'skipped (--nofetch)';
                } else {
                    process.stdout.write('(checking retailer page for stage 2) ');
                    const surviving = [];
                    const extractedPrices = [];
                    let softErrorsDropped = 0;

                    // Probe every candidate: soft-error URLs are dropped, live pages contribute a
                    // price sample. Taking the median across suppliers avoids one Merchant-Center
                    // inc-VAT JSON-LD (or one stale page) dominating the recorded unit price.
                    for (let li = 0; li < linkInfos.length; li++) {
                        const info = linkInfos[li];
                        const page = await fetchMerchantPage(info.link);
                        await sleep(REQUEST_DELAY_MS);

                        const softError =
                            isSoftErrorPageUrl(page.finalUrl) || looksLikeSoftErrorHtml(page.html);
                        if (softError) {
                            softErrorsDropped++;
                            const before = item.buyLinks.length;
                            item.buyLinks = item.buyLinks.filter((link) => link.URL !== info.link);
                            if (item.buyLinks.length !== before) fileModified = true;
                            continue;
                        }

                        surviving.push(info);
                        if (!page.ok) continue;

                        const pagePrice = extractPriceFromHtml(page.html);
                        if (pagePrice !== null) extractedPrices.push(pagePrice);
                    }

                    linkInfos = surviving;
                    stage2Price = medianPrice(extractedPrices);

                    if (stage2Price !== null) {
                        finalPrice = stage2Price;
                        priceSource = 'stage2 (retailer page)';
                        const sampleNote =
                            extractedPrices.length > 1
                                ? `median of ${extractedPrices.length} page prices [${extractedPrices
                                      .map((p) => `£${p}`)
                                      .join(', ')}]`
                                : `confirmed £${stage2Price} on the retailer page`;
                        stage2Note = sampleNote;
                    } else if (linkInfos.length === 0 && softErrorsDropped > 0) {
                        stage2Note = `ran - ${softErrorsDropped} candidate link(s) were dead/soft-error pages; no live merchant page left`;
                    } else {
                        stage2Note = 'ran, but found no confirmed GBP price on the page - kept stage 1 price';
                    }
                    if (softErrorsDropped > 0 && linkInfos.length > 0) {
                        stage2Note += ` (dropped ${softErrorsDropped} dead/soft-error link(s))`;
                    }
                }

                const hasBuyLink = linkInfos.length > 0;
                if (finalPrice !== null && !priceLooksPlausible(finalPrice, item, { hasBuyLink })) {
                    const note =
                        formatRejectionNote?.(finalPrice, item, { hasBuyLink }) ||
                        `£${finalPrice} failed the plausibility gate; previous price kept`;
                    stage2Note += ` - REJECTED: ${note}`;
                    finalPrice = null;
                }

                item.priceCheckedAt = new Date().toISOString().slice(0, 10);

                for (const info of linkInfos) {
                    const changed = upsertBuyLinkByDomain(item.buyLinks, {
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
                        `[${outcome}] ${label}\n` +
                        `  -> Price: £${finalPrice} [${priceSource}]\n` +
                        `  -> Stage 2: ${stage2Note}\n` +
                        linkInfos.map((info) => `  -> URL (${info.source}): ${info.link}\n`).join('') +
                        '\n';

                    item.price = finalPrice;
                    item.availableUK = true;
                    updated++;
                } else if (linkInfos.length > 0) {
                    process.stdout.write(`Found ${linkInfos.length} buy link(s), but no usable price.\n`);
                    logOutput +=
                        `[LINKS ONLY] ${label} - added ${linkInfos.length} buy link(s), price unusable\n` +
                        `  -> Stage 2: ${stage2Note}\n` +
                        linkInfos.map((info) => `  -> URL (${info.source}): ${info.link}\n`).join('') +
                        '\n';
                    updated++;
                } else {
                    process.stdout.write('Found listing, but no price could be parsed.\n');
                    logOutput += `[NO PRICE] ${label} - listing found but price unreadable\n  -> Stage 2: ${stage2Note}\n\n`;
                }

                fileModified = true;
            }

            if (fileModified) {
                await fs.writeFile(filePath, JSON.stringify(items, null, 4));
            }
        }

        logOutput += `\n--- SUMMARY ---\n${plural[0].toUpperCase()}${plural.slice(1)} Checked: ${checked}\n${plural[0].toUpperCase()}${plural.slice(1)} Updated: ${updated}\nSkipped (fresh): ${skippedFresh}\n`;

        await fs.writeFile(LOG_FILE, logOutput);
        console.log(
            `\nProcess complete. ${updated} ${plural} updated, ${skippedFresh} skipped as fresh. Log saved to: ${LOG_FILE}`
        );
    } catch (error) {
        console.error('A fatal error occurred:', error);
    }
}
