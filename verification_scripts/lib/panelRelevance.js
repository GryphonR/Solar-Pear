/**
 * @file panelRelevance.js
 * Panel-specific shopping relevance and £/W plausibility gates for the pricing scan.
 */

import { compact, identityVerdict, listingHaystack, modelVariants } from './listingMatch.js';
import { manufacturerMentioned } from './serper.js';

// £/W bands (inc VAT). Mainstream modules sell at roughly £0.10–0.30/W; the ceiling leaves room
// for consumer retailers and small orders without accepting multipacks. Premium brands and
// small (leisure) panels cost far more per watt, so they get their own bands.
export const MIN_PRICE_PER_WATT = 0.08;
export const MAX_PRICE_PER_WATT = 0.6;
export const PREMIUM_MAX_PRICE_PER_WATT = 1.0;
export const SMALL_PANEL_MAX_WATTS = 300;
export const SMALL_PANEL_PRICE_PER_WATT = { min: 0.2, max: 2.0 };
const PREMIUM_MANUFACTURERS = ['maxeon', 'sunpower', 'rec', 'meyer burger', 'viridian'];

/** A new price this far from the rest of its series' £/W (either way) is treated as a mismatch. */
export const SERIES_DEVIATION_FACTOR = 1.8;

/**
 * Extracts the short variant code after the last "/" in a model number, e.g. "MB" from
 * "JAM54D40-435/MB".
 * @param {string} model
 * @returns {string | null}
 */
export function extractModelSuffix(model) {
    const match = String(model || '').match(/\/([A-Za-z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
}

/**
 * True when the wattage appears as a number of its own: "435W" or "JAM54S31-435/LR" count, but
 * not "1435", "4350mAh", "435.5" or a "£435" price.
 * @param {string} haystack lowercased
 * @param {number} power
 */
export function wattageMentioned(haystack, power) {
    if (!power) return false;
    return new RegExp(`(?<![\\d.£])${power}(?!\\.?\\d)`).test(haystack);
}

/**
 * Whether a series name can tell this panel apart from its same-wattage siblings: it must not
 * equal, or be contained in, any sibling's series (so "Tiger Neo 3.0" doesn't pick out the DV
 * from "Tiger Neo 3.0 Bifacial", and "Neostar 3S" can't be told from "Neostar 3S+").
 * @param {object} panel
 * @param {object[]} siblings
 */
function distinctiveSeries(panel, siblings) {
    const own = compact(panel['panel-series']);
    if (own.length < 4) return null;
    const clash = siblings.some((s) => compact(s['panel-series']).includes(own));
    return clash ? null : own;
}

/**
 * Whether a search result (title, plus its URL when known) is for this exact panel.
 *
 *   - It must name the manufacturer.
 *   - Our model number (with or without the brand prefix) is decisive.
 *   - A result naming a same-wattage sibling's model instead of ours is rejected.
 *   - Otherwise manufacturer + wattage is enough only when no sibling shares the wattage; when
 *     one does, the title must also carry a series name that only this panel has.
 *
 * @param {string} title
 * @param {{ manufacturer?: string, power?: number, model?: string, 'panel-series'?: string }} panel
 * @param {{ url?: string, siblings?: object[] }} [ctx] siblings: other catalogue panels from the
 *   same manufacturer with the same wattage
 */
export function titleLooksRelevant(title, panel, ctx = {}) {
    if (!title) return false;
    const siblings = Array.isArray(ctx.siblings) ? ctx.siblings : [];
    const haystack = listingHaystack(title, ctx.url);
    const compactHaystack = compact(haystack);

    const brandNamed =
        manufacturerMentioned(haystack, panel.manufacturer) ||
        (compact(panel.manufacturer).length >= 3 && compactHaystack.includes(compact(panel.manufacturer)));
    if (!brandNamed) return false;

    const ownIds = modelVariants(panel.model, panel.manufacturer);
    const siblingIds = siblings.flatMap((s) => modelVariants(s.model, s.manufacturer));
    const verdict = identityVerdict(haystack, ownIds, siblingIds);
    if (verdict !== 'none') return verdict === 'own';

    if (!wattageMentioned(haystack, panel.power)) return false;
    if (siblings.length === 0) return true;

    const series = distinctiveSeries(panel, siblings);
    return !!series && compactHaystack.includes(series);
}

/** @param {string} manufacturer */
function isPremium(manufacturer) {
    const m = String(manufacturer || '').toLowerCase();
    return PREMIUM_MANUFACTURERS.some((p) => m.includes(p));
}

/**
 * The £/W band for a panel.
 * @param {{ power?: number, manufacturer?: string }} panel
 */
export function pricePerWattBand(panel) {
    if (panel.power && panel.power < SMALL_PANEL_MAX_WATTS) return SMALL_PANEL_PRICE_PER_WATT;
    if (isPremium(panel.manufacturer)) return { min: MIN_PRICE_PER_WATT, max: PREMIUM_MAX_PRICE_PER_WATT };
    return { min: MIN_PRICE_PER_WATT, max: MAX_PRICE_PER_WATT };
}

/**
 * Why a price is not plausible for one panel, or null when it is.
 * @param {number} price inc VAT
 * @param {{ power?: number, manufacturer?: string }} panel
 * @param {{ seriesPerWatt?: number | null }} [ctx] median £/W of the other priced panels in the series
 * @returns {string | null}
 */
export function priceRejectionReason(price, panel, ctx = {}) {
    if (!Number.isFinite(price) || price <= 0) return 'not a positive price';
    if (!panel.power) return null; // nothing to sanity-check a ratio against
    const perWatt = price / panel.power;
    const band = pricePerWattBand(panel);
    if (perWatt < band.min || perWatt > band.max) {
        return `£${price} for ${panel.power}W is £${perWatt.toFixed(2)}/W, outside £${band.min}–${band.max}/W`;
    }
    const seriesPerWatt = ctx.seriesPerWatt;
    if (seriesPerWatt && seriesPerWatt > 0) {
        const ratio = perWatt / seriesPerWatt;
        if (ratio > SERIES_DEVIATION_FACTOR || ratio < 1 / SERIES_DEVIATION_FACTOR) {
            return `£${perWatt.toFixed(2)}/W is ${ratio.toFixed(1)}× the rest of its series (£${seriesPerWatt.toFixed(2)}/W)`;
        }
    }
    return null;
}

/**
 * True if `price` is a plausible amount for a single panel. Accepts the panel record, or just
 * its wattage.
 * @param {number} price
 * @param {number | { power?: number, manufacturer?: string }} panelOrPower
 * @param {{ seriesPerWatt?: number | null }} [ctx]
 */
export function priceLooksPlausible(price, panelOrPower, ctx = {}) {
    const panel = typeof panelOrPower === 'object' && panelOrPower ? panelOrPower : { power: panelOrPower };
    return priceRejectionReason(price, panel, ctx) === null;
}

/** @param {object} panel */
export function getPanelModel(panel) {
    return panel?.model;
}

/**
 * Same manufacturer and wattage, excluding the panel itself.
 * @param {object} panel
 * @param {object[]} catalogue
 */
export function panelSiblings(panel, catalogue) {
    return catalogue.filter(
        (p) => p !== panel && p.model !== panel.model && p.manufacturer === panel.manufacturer && p.power === panel.power
    );
}

/**
 * Median £/W of the other priced panels in the same manufacturer + series, or null when fewer
 * than two are priced.
 * @param {object} panel
 * @param {object[]} catalogue
 */
export function seriesPricePerWatt(panel, catalogue) {
    const series = compact(panel['panel-series']);
    if (!series) return null;
    const perWatt = catalogue
        .filter(
            (p) =>
                p !== panel &&
                p.manufacturer === panel.manufacturer &&
                compact(p['panel-series']) === series &&
                p.price > 0 &&
                p.power > 0
        )
        .map((p) => p.price / p.power)
        .sort((a, b) => a - b);
    if (perWatt.length < 2) return null;
    const mid = Math.floor(perWatt.length / 2);
    return perWatt.length % 2 ? perWatt[mid] : (perWatt[mid - 1] + perWatt[mid]) / 2;
}
