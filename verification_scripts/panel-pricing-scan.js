/**
 * @file panel-pricing-scan.js
 *
 * Updates `price` and `buyLinks` for every panel in `src/data/panels/*.json`, and stamps
 * `priceCheckedAt` with the date each panel was last checked.
 *
 * Shared pipeline lives in `lib/pricingScan.js`. Panel-specific relevance (model, or wattage +
 * series when no sibling shares the wattage) and £/W plausibility live in `lib/panelRelevance.js`.
 *
 * Usage:
 *   SERPER_API_KEY=xyz123 node verification_scripts/panel-pricing-scan.js [--force|-f] [--nofetch] [--manufacturer=Trina]
 */

import process from 'process';
import { pathToFileURL } from 'url';
import { loadEnvFile, PANELS_DIR, parsePricingCliFlags, resolveSerperApiKey } from './lib/paths.js';
import {
    getPanelModel,
    panelSiblings,
    priceRejectionReason,
    seriesPricePerWatt,
    titleLooksRelevant,
} from './lib/panelRelevance.js';
import { needsPriceCheck as needsPriceCheckCore, runPricingScan } from './lib/pricingScan.js';

// Re-export pure helpers so existing unit tests keep importing from this entry file.
export {
    isClearanceOrDamagedListing,
    isGoogleAggregatorLink,
    isPdfLink,
    isSoftErrorPageUrl,
    looksLikeSoftErrorHtml,
} from './lib/urlQuality.js';
export { stripTrackingParams, supplierDomain, upsertBuyLinkByDomain } from './lib/buyLinks.js';
export {
    extractExVatDisplayPrice,
    extractPriceDetails,
    extractPriceFromHtml,
    findPriceInJsonLd,
    medianPrice,
    pageIdentityText,
    parsePriceText,
} from './lib/priceExtract.js';
export {
    extractModelSuffix,
    panelSiblings,
    priceLooksPlausible,
    priceRejectionReason,
    seriesPricePerWatt,
    titleLooksRelevant,
    wattageMentioned,
} from './lib/panelRelevance.js';
export { sleep } from './lib/serper.js';

loadEnvFile();

const apiKey = resolveSerperApiKey();
const { forceRecheck, skipStage2, manufacturerFilter, priceStaleDays } = parsePricingCliFlags();

/**
 * A panel is due for a re-check if it has never been checked, has no recorded price, or its
 * last check is older than PRICE_STALE_DAYS. Honours `--force` from the CLI.
 * @param {{ price: number, priceCheckedAt: string }} panel
 */
export function needsPriceCheck(panel) {
    return needsPriceCheckCore(panel, { forceRecheck, staleDays: priceStaleDays });
}

export async function run() {
    await runPricingScan({
        dataDir: PANELS_DIR,
        catalogKey: 'panels',
        logPrefix: 'panel_pricing_check_log',
        productLabel: 'panel',
        apiKey,
        forceRecheck,
        skipStage2,
        manufacturerFilter,
        priceStaleDays,
        getModel: getPanelModel,
        getKey: (panel) => panel.model,
        getSiblings: panelSiblings,
        titleLooksRelevant,
        priceRejectionReason: (price, panel, { catalogue }) =>
            priceRejectionReason(price, panel, { seriesPerWatt: seriesPricePerWatt(panel, catalogue) }),
        formatLabel: (panel) => `${panel.manufacturer} ${panel.model}`,
        sharedPriceGroup: (panel) => `${panel.manufacturer}|${panel.power}`,
    });
}

// Only auto-run when executed directly (`node panel-pricing-scan.js`), not when imported
// for unit testing the pure helper functions above.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
