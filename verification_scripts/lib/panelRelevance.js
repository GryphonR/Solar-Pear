/**
 * @file panelRelevance.js
 * Panel-specific shopping relevance and £/W plausibility gates for the pricing scan.
 */

import { manufacturerMentioned } from './serper.js';

// Calibrated against the catalogue's actual spread: prices with a corroborating buy link never
// go below ~£0.12/W, and the lowest *unverified* ("PRICE ONLY") result seen that wasn't already
// a known bad match was £0.097/W - so 0.08 gives that a little room without accepting accessory
// / sample / wrong-product prices well below it.
export const MIN_PRICE_PER_WATT = 0.08;
export const MAX_PRICE_PER_WATT = 1.2;

/**
 * Extracts the short variant code after the last "/" in a model number, e.g. "MB" from
 * "JAM54D40-435/MB". Used when same-wattage siblings need disambiguation.
 * @param {string} model
 * @returns {string | null}
 */
export function extractModelSuffix(model) {
    const match = String(model || '').match(/\/([A-Za-z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Shopping/organic title must mention manufacturer and wattage. Optional siblingSuffixes
 * require this panel's own model suffix when same-wattage siblings exist.
 * @param {string} title
 * @param {{ manufacturer?: string, power?: number, model?: string }} panel
 * @param {string[]} [siblingSuffixes]
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
 * True if `price` is a plausible amount for a single panel of the given wattage.
 * @param {number} price
 * @param {number} power
 */
export function priceLooksPlausible(price, power) {
    if (!power) return true; // nothing to sanity-check a ratio against
    const perWatt = price / power;
    return perWatt >= MIN_PRICE_PER_WATT && perWatt <= MAX_PRICE_PER_WATT;
}

/** @param {object} panel */
export function getPanelModel(panel) {
    return panel?.model;
}
