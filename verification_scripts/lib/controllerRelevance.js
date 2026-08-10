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

import { manufacturerMentioned } from './serper.js';

/** Absolute GBP bands by controller `type` (min inclusive, max inclusive). */
const TYPE_PRICE_BANDS = {
    charger: { min: 20, max: 800 },
    hybrid_inverter: { min: 200, max: 8000 },
    ac_coupled_inverter: { min: 200, max: 6000 },
    string_inverter: { min: 150, max: 5000 },
    microinverter: { min: 50, max: 500 },
};

/** Fallback band when type is unknown / missing. */
const DEFAULT_PRICE_BAND = { min: 20, max: 8000 };

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

/**
 * True if a single identifier string (display name or order code) is reflected in the title.
 * Prefers an exact substring match; otherwise requires every meaningful token plus *every*
 * distinct digit run (so "75/10" cannot match a "75/15" listing that only shares "75").
 * @param {string} normalizedTitle already-lowercased title
 * @param {string} identifier
 */
export function identifierLooksRelevant(normalizedTitle, identifier) {
    const id = String(identifier || '').trim().toLowerCase();
    if (!id) return false;

    // Exact (case-insensitive) substring - covers order codes pasted into retailer titles/URLs.
    if (normalizedTitle.includes(id)) return true;

    const tokens = modelTokens(id);
    if (tokens.length === 0) return false;
    if (!tokens.every((t) => normalizedTitle.includes(t))) return false;

    // Require every distinct digit run so sibling SKUs that share a prefix (75/10 vs 75/15)
    // cannot match each other on the shared "75" alone.
    const shortNums = [...new Set(id.match(/\d+/g) || [])];
    if (shortNums.length > 0) {
        return shortNums.every((n) => normalizedTitle.includes(n));
    }

    // No digits in the identifier - insist on at least two word tokens to keep the signal strong.
    return tokens.length >= 2;
}

/**
 * Title must mention the manufacturer and match either the display `name` or the `modelNumber`
 * (order code). Either cue is enough - retailers vary which they echo.
 * @param {string} title
 * @param {{ manufacturer?: string, modelNumber?: string, name?: string }} controller
 */
export function titleLooksRelevant(title, controller) {
    if (!title) return false;
    const normalizedTitle = title.toLowerCase();
    if (!manufacturerMentioned(normalizedTitle, controller.manufacturer)) return false;

    const name = String(controller?.name || '').trim();
    const modelNumber = String(controller?.modelNumber || '').trim();
    if (!name && !modelNumber) return false;

    if (name && identifierLooksRelevant(normalizedTitle, name)) return true;
    if (modelNumber && identifierLooksRelevant(normalizedTitle, modelNumber)) return true;
    return false;
}

/**
 * Type-aware absolute band. When `hasBuyLink` is false (PRICE ONLY), reject rather than risk
 * writing a shopping-snippet price with no corroborating merchant page.
 * @param {number} price
 * @param {{ type?: string }} controller
 * @param {{ hasBuyLink?: boolean }} [opts]
 */
export function priceLooksPlausible(price, controller, opts = {}) {
    if (!Number.isFinite(price) || price <= 0) return false;

    // PRICE ONLY with no buy link is too weak a signal for controllers (wide price bands).
    if (!opts.hasBuyLink) return false;

    const band = TYPE_PRICE_BANDS[controller?.type] || DEFAULT_PRICE_BAND;
    return price >= band.min && price <= band.max;
}
