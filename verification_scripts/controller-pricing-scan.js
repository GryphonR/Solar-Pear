/**
 * @file controller-pricing-scan.js
 *
 * Updates `price` and `buyLinks` for every controller in `src/data/controllers/*.json`, and
 * stamps `priceCheckedAt` with the date each controller was last checked.
 *
 * Same multi-stage Serper pipeline as panels (`lib/pricingScan.js`), with controller-specific
 * gates in `lib/controllerRelevance.js`:
 *   - Search query prefers display `name` (UK retailers title by name; `modelNumber` is often
 *     an opaque order code). Relevance accepts a title matching *either* name or modelNumber.
 *   - Plausibility: type-aware GBP bands (chargers scale with charge current); PRICE ONLY
 *     (no buy link) is rejected
 *
 * Usage:
 *   SERPER_API_KEY=xyz123 node verification_scripts/controller-pricing-scan.js [--force|-f] [--nofetch] [--manufacturer=Victron]
 */

import process from 'process';
import { pathToFileURL } from 'url';
import {
    controllerSiblings,
    getControllerModel,
    priceRejectionReason,
    titleLooksRelevant,
} from './lib/controllerRelevance.js';
import { CONTROLLERS_DIR, loadEnvFile, parsePricingCliFlags, resolveSerperApiKey } from './lib/paths.js';
import { needsPriceCheck as needsPriceCheckCore, runPricingScan } from './lib/pricingScan.js';

export {
    conflictingVariant,
    controllerPriceBand,
    controllerSiblings,
    getControllerModel,
    identifierLooksRelevant,
    modelTokens,
    priceLooksPlausible,
    priceRejectionReason,
    titleLooksRelevant,
} from './lib/controllerRelevance.js';

loadEnvFile();

const apiKey = resolveSerperApiKey();
const { forceRecheck, skipStage2, manufacturerFilter, priceStaleDays } = parsePricingCliFlags();

/**
 * @param {{ price: number, priceCheckedAt: string }} controller
 */
export function needsPriceCheck(controller) {
    return needsPriceCheckCore(controller, { forceRecheck, staleDays: priceStaleDays });
}

export async function run() {
    await runPricingScan({
        dataDir: CONTROLLERS_DIR,
        catalogKey: 'controllers',
        logPrefix: 'controller_pricing_check_log',
        productLabel: 'controller',
        apiKey,
        forceRecheck,
        skipStage2,
        manufacturerFilter,
        priceStaleDays,
        getModel: getControllerModel,
        getKey: (controller) => controller.id,
        getSiblings: controllerSiblings,
        titleLooksRelevant,
        priceRejectionReason: (price, controller, { hasBuyLink }) =>
            priceRejectionReason(price, controller, { hasBuyLink }),
        formatLabel: (controller) => {
            const name = controller.name || '';
            const model = controller.modelNumber || '';
            // Show both when they differ (order code vs display name) for clearer logs.
            if (name && model && name !== model) {
                return `${controller.manufacturer} ${name} [${model}]`;
            }
            return `${controller.manufacturer} ${name || model}`.trim();
        },
        sharedPriceGroup: (controller) => `${controller.manufacturer}|${controller.type}`,
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
