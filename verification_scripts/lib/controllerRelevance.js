/**
 * @file controllerRelevance.js
 * Controller-specific shopping relevance and absolute-price plausibility gates.
 *
 * Controllers have no panel wattage to key on. UK retailers almost always title products by
 * the human display `name` (e.g. "SmartSolar MPPT 75/15"), while `modelNumber` is often an
 * opaque manufacturer order code (e.g. "SCC075015060R"). Search therefore prefers `name`;
 * relevance accepts a title that matches *either* the display name *or* the order code.
 *
 * Plausibility uses type-aware absolute GBP bands; "PRICE ONLY" results (no corroborating buy
 * link) are rejected outright.
 */

import {
    containsIdentifier,
    identityVerdict,
    listingHaystack,
    quotesOtherOrderCode,
} from './listingMatch.js';
import { manufacturerMentioned } from './serper.js';

/** Absolute GBP bands (inc VAT) by controller `type` (min inclusive, max inclusive). */
const TYPE_PRICE_BANDS = {
    hybrid_inverter: { min: 200, max: 8000 },
    ac_coupled_inverter: { min: 200, max: 6000 },
    string_inverter: { min: 150, max: 6000 },
    microinverter: { min: 50, max: 500 },
    'dc-dc-charger': { min: 30, max: 1000 },
    inverter_charger: { min: 250, max: 6000 },
};

/**
 * Chargers range from a £40 75/10 to a £1,500 RS 450/200, so their band scales with the charge
 * current: roughly £1–£12 per amp, with a floor of £20 and a ceiling of at least £150 for small units.
 */
const CHARGER_PER_AMP = { min: 1, max: 12 };
const CHARGER_FLAT_BAND = { min: 20, max: 2500 };

/** Fallback band when type is unknown / missing. */
const DEFAULT_PRICE_BAND = { min: 20, max: 8000 };

/**
 * The GBP band for a controller.
 * @param {{ type?: string, maxChargeCurrent?: number }} controller
 */
export function controllerPriceBand(controller) {
    if (controller?.type === 'charger') {
        const amps = Number(controller.maxChargeCurrent) || 0;
        if (amps <= 0) return CHARGER_FLAT_BAND;
        return {
            min: Math.max(20, Math.round(amps * CHARGER_PER_AMP.min)),
            max: Math.max(150, Math.round(amps * CHARGER_PER_AMP.max)),
        };
    }
    return TYPE_PRICE_BANDS[controller?.type] || DEFAULT_PRICE_BAND;
}

/**
 * Serper query identity: prefer the human display `name` (how UK retailers title products);
 * fall back to `modelNumber` when name is blank.
 * @param {object} controller
 * @returns {string | null}
 */
export function getControllerModel(controller) {
    const name = String(controller?.name || '').trim();
    if (name) return name;
    const modelNumber = String(controller?.modelNumber || '').trim();
    return modelNumber || null;
}

/**
 * Alphanumeric tokens (≥3 chars) from an identifier, used for rearranged retailer titles.
 * @param {string} identifier
 * @returns {string[]}
 */
export function modelTokens(identifier) {
    return String(identifier || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3);
}

/** A number standing on its own: "15" is in "75/15" but not in "150". */
function numberMentioned(normalizedTitle, digits) {
    return new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(normalizedTitle);
}

/**
 * True if a single identifier string (display name or order code) is reflected in the title.
 * Prefers an exact match (ignoring punctuation); otherwise requires every meaningful token plus
 * *every* distinct number, each standing on its own, so "75/10" cannot match a "75/15" listing
 * and "75/15" cannot match "75/150". Retailers who run the rating together ("7515") also match.
 * @param {string} normalizedTitle already-lowercased title
 * @param {string} identifier
 */
export function identifierLooksRelevant(normalizedTitle, identifier) {
    const id = String(identifier || '').trim().toLowerCase();
    if (!id) return false;

    if (containsIdentifier(normalizedTitle, id)) return true;

    const tokens = modelTokens(id).filter((t) => !/^\d+$/.test(t));
    if (!tokens.every((t) => normalizedTitle.includes(t))) return false;

    const nums = [...new Set(id.match(/\d+/g) || [])];
    if (nums.length > 0) {
        return (
            nums.every((n) => numberMentioned(normalizedTitle, n)) ||
            numberMentioned(normalizedTitle, (id.match(/\d+/g) || []).join(''))
        );
    }

    // No digits in the identifier - insist on at least two word tokens to keep the signal strong.
    return tokens.length >= 2;
}

// Variant markers that tell otherwise identically named products apart. A listing that carries
// a marker our record doesn't (or the opposite marker) is a different product.
const EXCLUSIVE_VARIANTS = [
    ['tr', 'mc4'], // Victron SmartSolar "-Tr" (screw terminals) vs "MC4" connectors
];
const OPTIONAL_VARIANTS = ['vecan', 'gx', 'smart', 'isolated'];

function hasWord(text, word) {
    return new RegExp(`(?:^|[^a-z0-9])${word}(?:[^a-z0-9]|$)`).test(text);
}

/**
 * True when the listing is a differently specified variant: it carries the opposite of one of
 * our exclusive markers, or an optional feature (VE.Can, GX, isolated) that our record lacks.
 * @param {string} haystack lowercased
 * @param {string} ownText our name + modelNumber, lowercased
 */
export function conflictingVariant(haystack, ownText) {
    for (const pair of EXCLUSIVE_VARIANTS) {
        for (const marker of pair) {
            const other = pair.find((m) => m !== marker);
            if (hasWord(ownText, marker) && hasWord(haystack, other) && !hasWord(haystack, marker)) return true;
        }
    }
    const flat = (t) => t.replace(/\./g, '');
    return OPTIONAL_VARIANTS.some((v) => hasWord(flat(haystack), v) && !hasWord(flat(ownText), v));
}

function ownIdentifiers(controller) {
    const ids = [];
    const modelNumber = String(controller?.modelNumber || '').trim();
    const name = String(controller?.name || '').trim();
    if (modelNumber) {
        ids.push(modelNumber);
        // Retailers often drop Victron's trailing revision letter ("SCC075015060R" → "...060").
        if (/^[a-z]{3}\d{6,}[a-z]$/i.test(modelNumber)) ids.push(modelNumber.slice(0, -1));
    }
    if (name) ids.push(name);
    return ids;
}

/**
 * Whether a search result (title, plus its URL when known) is for this exact controller.
 *
 *   - It must name the manufacturer.
 *   - Quoting another order code from our family (SCC115085511 when we are SCC115085411) rejects.
 *   - Naming a sibling's model number or name instead of ours rejects.
 *   - Our exact order code is decisive. Otherwise the display name or model number must match
 *     (tokens and every number), and the listing must not be a conflicting variant (MC4 vs Tr,
 *     an added VE.Can or GX).
 *
 * @param {string} title
 * @param {{ manufacturer?: string, modelNumber?: string, name?: string }} controller
 * @param {{ url?: string, siblings?: object[] }} [ctx] siblings: other catalogue controllers
 *   from the same manufacturer
 */
export function titleLooksRelevant(title, controller, ctx = {}) {
    if (!title) return false;
    const haystack = listingHaystack(title, ctx.url);
    if (!manufacturerMentioned(haystack, controller.manufacturer)) return false;

    const name = String(controller?.name || '').trim();
    const modelNumber = String(controller?.modelNumber || '').trim();
    if (!name && !modelNumber) return false;

    if (quotesOtherOrderCode(haystack, modelNumber)) return false;

    const siblings = Array.isArray(ctx.siblings) ? ctx.siblings : [];
    const ownIds = ownIdentifiers(controller);
    const verdict = identityVerdict(haystack, ownIds, siblings.flatMap((s) => ownIdentifiers(s)));
    if (verdict === 'sibling') return false;

    const codeIds = ownIds.filter((id) => id !== name);
    if (codeIds.some((id) => containsIdentifier(haystack, id))) return true;

    if (conflictingVariant(haystack, `${name} ${modelNumber}`.toLowerCase())) return false;
    if (verdict === 'own') return true;

    if (name && identifierLooksRelevant(haystack, name)) return true;
    if (modelNumber && identifierLooksRelevant(haystack, modelNumber)) return true;
    return false;
}

/**
 * Same manufacturer, excluding the controller itself.
 * @param {object} controller
 * @param {object[]} catalogue
 */
export function controllerSiblings(controller, catalogue) {
    return catalogue.filter(
        (c) => c !== controller && c.id !== controller.id && c.manufacturer === controller.manufacturer
    );
}

/**
 * Why a price is not plausible for this controller, or null when it is. A "PRICE ONLY" result
 * (no corroborating buy link) is always rejected: the bands are too wide to trust a bare
 * shopping snippet.
 * @param {number} price inc VAT
 * @param {{ type?: string, maxChargeCurrent?: number }} controller
 * @param {{ hasBuyLink?: boolean }} [opts]
 * @returns {string | null}
 */
export function priceRejectionReason(price, controller, opts = {}) {
    if (!Number.isFinite(price) || price <= 0) return 'not a positive price';
    if (!opts.hasBuyLink) return `£${price} is PRICE ONLY (no corroborating buy link)`;
    const band = controllerPriceBand(controller);
    if (price < band.min || price > band.max) {
        return `£${price} outside the £${band.min}–£${band.max} band for type "${controller?.type || 'unknown'}"`;
    }
    return null;
}

/**
 * @param {number} price
 * @param {{ type?: string, maxChargeCurrent?: number }} controller
 * @param {{ hasBuyLink?: boolean }} [opts]
 */
export function priceLooksPlausible(price, controller, opts = {}) {
    return priceRejectionReason(price, controller, opts) === null;
}
