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
 *   - Plausibility: type-aware absolute GBP bands; PRICE ONLY (no buy link) is rejected
 *
 * Usage:
 *   SERPER_API_KEY=xyz123 node verification_scripts/controller-pricing-scan.js [--force|-f] [--nofetch] [--manufacturer=Victron]
 */

import process from 'process';
import { pathToFileURL } from 'url';
import {
    getControllerModel,
    priceLooksPlausible,
    titleLooksRelevant,
} from './lib/controllerRelevance.js';
import { CONTROLLERS_DIR, loadEnvFile, parsePricingCliFlags, resolveSerperApiKey } from './lib/paths.js';
import { needsPriceCheck as needsPriceCheckCore, runPricingScan } from './lib/pricingScan.js';

export {
    getControllerModel,
    identifierLooksRelevant,
    modelTokens,
    priceLooksPlausible,
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
        titleLooksRelevant: (title, controller) => titleLooksRelevant(title, controller),
        priceLooksPlausible: (price, controller, ctx) => priceLooksPlausible(price, controller, ctx),
        formatLabel: (controller) => {
            const name = controller.name || '';
            const model = controller.modelNumber || '';
            // Show both when they differ (order code vs display name) for clearer logs.
            if (name && model && name !== model) {
                return `${controller.manufacturer} ${name} [${model}]`;
            }
            return `${controller.manufacturer} ${name || model}`.trim();
        },
        formatRejectionNote: (price, controller, ctx) => {
            if (!ctx?.hasBuyLink) {
                return `£${price} is PRICE ONLY (no corroborating buy link); previous price kept`;
            }
            return `£${price} outside the plausible band for type "${controller.type || 'unknown'}"; previous price kept`;
        },
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
