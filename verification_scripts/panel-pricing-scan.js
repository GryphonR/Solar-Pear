/**
 * @file panel-pricing-scan.js
 *
 * Updates `price` and `buyLinks` for every panel in `src/data/panels/*.json`, and stamps
 * `priceCheckedAt` with the date each panel was last checked.
 *
 * Shared pipeline lives in `lib/pricingScan.js`. Panel-specific relevance (£ + wattage) and
 * £/W plausibility live in `lib/panelRelevance.js`.
 *
 * Usage:
 *   SERPER_API_KEY=xyz123 node verification_scripts/panel-pricing-scan.js [--force|-f] [--nofetch] [--manufacturer=Trina]
 */

import process from 'process';
import { pathToFileURL } from 'url';
import { loadEnvFile, PANELS_DIR, parsePricingCliFlags, resolveSerperApiKey } from './lib/paths.js';
import { getPanelModel, priceLooksPlausible, titleLooksRelevant } from './lib/panelRelevance.js';
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
export { extractPriceFromHtml, extractExVatDisplayPrice, findPriceInJsonLd, medianPrice, parsePriceText } from './lib/priceExtract.js';
export { extractModelSuffix, priceLooksPlausible, titleLooksRelevant } from './lib/panelRelevance.js';
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
        titleLooksRelevant: (title, panel) => titleLooksRelevant(title, panel),
        priceLooksPlausible: (price, panel) => priceLooksPlausible(price, panel.power),
        formatLabel: (panel) => `${panel.manufacturer} ${panel.model}`,
        formatRejectionNote: (price, panel) =>
            `£${price} for ${panel.power}W is £${(price / panel.power).toFixed(2)}/W, outside the plausible range; previous price kept`,
    });
}

// Only auto-run when executed directly (`node panel-pricing-scan.js`), not when imported
// for unit testing the pure helper functions above.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
