/**
 * @file listingMatch.js
 * Shared helpers for deciding whether a search result or retailer page is the exact product:
 * normalised identifier matching, sibling-model rejection, and bundle / multipack / accessory
 * listing filters. Used by both catalogue-specific relevance modules.
 */

/**
 * Lowercased alphanumerics, so "JAM54D41-450/LB", "jam54d41 450lb" and the URL slug
 * "jam54d41-450-lb" all compare equal. A separator between two digits is kept as "|", so
 * "75/15" stays distinct from "7515" and from the start of "75/150".
 * @param {string} text
 */
export function compact(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/(\d)[^a-z0-9]+(?=\d)/g, '$1|')
        .replace(/[^a-z0-9|]+/g, '');
}

/**
 * Text to match against: the result title plus the URL path, with URL separators turned into
 * spaces so slugs read like titles ("inverter-with-5-12kwh-battery" → "inverter with 5 12kwh battery").
 * @param {string} title
 * @param {string} [url]
 */
export function listingHaystack(title, url = '') {
    let pathText = '';
    if (url) {
        try {
            pathText = decodeURIComponent(new URL(url).pathname);
        } catch {
            pathText = String(url);
        }
    }
    return `${title || ''} ${pathText.replace(/[-_/+.]+/g, ' ')}`.toLowerCase();
}

/**
 * True when the identifier (model or order code) appears in the haystack once both are
 * compacted. Identifiers shorter than 5 characters are too weak to count on their own.
 * @param {string} haystack
 * @param {string} identifier
 */
export function containsIdentifier(haystack, identifier) {
    const id = compact(identifier);
    if (id.length < 5) return false;
    const h = compact(haystack);
    const isDigit = (ch) => ch >= '0' && ch <= '9';
    // A digit at either end of the identifier must not run on into more digits ("75|15" is not
    // in "75|150", "450" is not in "1450").
    for (let at = h.indexOf(id); at !== -1; at = h.indexOf(id, at + 1)) {
        const before = h[at - 1];
        const after = h[at + id.length];
        if (isDigit(id[0]) && before && isDigit(before)) continue;
        if (isDigit(id[id.length - 1]) && after && isDigit(after)) continue;
        return true;
    }
    return false;
}

/**
 * Model identifiers to look for: the model itself, plus the model without a leading
 * manufacturer prefix ("AIKO-A450-MAH54Mb" → "A450-MAH54Mb"), which retailers often drop.
 * @param {string} model
 * @param {string} manufacturer
 * @returns {string[]}
 */
export function modelVariants(model, manufacturer) {
    const variants = [model];
    const m = compact(model);
    for (const word of String(manufacturer || '').toLowerCase().split(/\s+/)) {
        const w = compact(word);
        if (w.length >= 3 && m.startsWith(w) && m.length - w.length >= 5) {
            variants.push(m.slice(w.length));
        }
    }
    return variants.filter(Boolean);
}

/**
 * True when the haystack names a sibling's identifier but not ours, i.e. the listing is
 * explicitly for a different catalogue product. A sibling identifier that is itself contained
 * in ours (e.g. "SCC110020" inside "SCC110020060R") is ignored.
 * @param {string} haystack
 * @param {string[]} ownIds
 * @param {string[]} siblingIds
 */
export function namesSiblingInstead(haystack, ownIds, siblingIds) {
    if (ownIds.some((id) => containsIdentifier(haystack, id))) return false;
    const own = ownIds.map(compact);
    return siblingIds.some((sib) => {
        const s = compact(sib);
        if (own.some((o) => o.includes(s))) return false;
        return containsIdentifier(haystack, sib);
    });
}

/**
 * Which catalogue product a listing names, judged by identifiers alone:
 *   - 'own'     our identifier is present, and no longer sibling identifier that contains it is
 *               ("X-400" is inside "X-400-BLK");
 *   - 'sibling' a sibling's identifier is present and ours is not, or a longer sibling's is;
 *   - 'none'    neither, so the caller decides on weaker cues.
 * @param {string} haystack
 * @param {string[]} ownIds
 * @param {string[]} siblingIds
 * @returns {'own' | 'sibling' | 'none'}
 */
export function identityVerdict(haystack, ownIds, siblingIds) {
    const own = ownIds.map(compact).filter((o) => o.length >= 5);
    const ownFound = ownIds.some((id) => containsIdentifier(haystack, id));
    if (ownFound) {
        const longerSibling = siblingIds.some(
            (sib) => own.some((o) => compact(sib).includes(o) && compact(sib) !== o) && containsIdentifier(haystack, sib)
        );
        return longerSibling ? 'sibling' : 'own';
    }
    return namesSiblingInstead(haystack, ownIds, siblingIds) ? 'sibling' : 'none';
}

// Manufacturer order codes such as Victron's "SCC115085411" / "ORI121217050": three letters
// then six or more digits, sometimes with a trailing revision letter.
const ORDER_CODE = /\b([a-z]{3})(\d{6,})[a-z]?\b/g;

/**
 * True when the listing quotes an order code from the same family as ours (same letter prefix)
 * that isn't ours, e.g. a listing for SCC115085511 (MC4) when we are SCC115085411 (Tr).
 * Ignores the trailing revision letter, which retailers often drop.
 * @param {string} haystack lowercased
 * @param {string} modelNumber
 */
export function quotesOtherOrderCode(haystack, modelNumber) {
    const own = String(modelNumber || '').toLowerCase().match(/^([a-z]{3})(\d{6,})[a-z]?$/);
    if (!own) return false;
    for (const [, prefix, digits] of haystack.matchAll(ORDER_CODE)) {
        if (prefix === own[1] && digits !== own[2]) return true;
    }
    return false;
}

// Pallets, multipacks and kits: the price is for more than one unit, or for other goods too.
const BUNDLE_PATTERNS = [
    /\bpallets?\b/,
    /\bpack of \d+\b/,
    /\b\d+\s*(?:x|×)\s*\d{2,4}\s*w\b/, // "10 x 450W"
    /\b(?:x|×)\s*\d+\s*(?:panels?|pcs|pieces|units)\b/, // "x 36 panels"
    /\b\d+\s*(?:pcs|pieces|panels|units)\b/, // "36 panels", "2 pcs"
    /\b\d+\s*(?:pack|pk)\b/, // "2 pack"
    /\bbundle\b/,
    /\bkits?\b/,
    /\bcombo\b/,
    // "inverter with 5.12kWh battery" (slug "with 5 12kwh"), "inverter + 9.5kWh". Not plain
    // "with lithium batteries", which describes what a charger supports.
    /\bwith\b.{0,30}\b\d+(?:[.\s]\d+)?\s*kwh\b/,
    /(?:\band\b|\+|&)\s*\d+(?:[.\s]\d+)?\s*kwh\b/,
];

// Accessories that share the product's name in their titles. Only phrased as "X for …" (or
// words that never describe the product itself), because product titles routinely mention
// "MC4 connectors", "1.2 m cables" or "lead acid".
const ACCESSORY_PATTERNS = [
    /\b(?:cables?|leads?|brackets?|clamps?|connectors?|adapt[eo]rs?|covers?|mounts?)\s+(?:for|to suit)\b/,
    /\bdongle\b/,
    /\bspares?\b/,
    /\breplacement\b/,
    /\b(?:end|mid)\s*clamps?\b/,
];

/**
 * True for a listing whose price is not for one unit of the product: a pallet, multipack,
 * kit or bundle, or an accessory for it.
 * @param {string} title
 * @param {string} [url]
 */
export function isBundleOrAccessoryListing(title, url = '') {
    const haystack = listingHaystack(title, url);
    return (
        BUNDLE_PATTERNS.some((re) => re.test(haystack)) || ACCESSORY_PATTERNS.some((re) => re.test(haystack))
    );
}

// Marketplaces: third-party sellers, unstable listings, and (Amazon) price-display rules that
// are still undecided (roadmap 6.4). Never used as buy links or price sources.
const MARKETPLACE_DOMAINS = ['ebay.', 'amazon.', 'onbuy.', 'fruugo.', 'manomano.', 'aliexpress.', 'temu.', 'wish.'];

/** @param {string} url */
export function isMarketplaceLink(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return MARKETPLACE_DOMAINS.some((d) => host.includes(d));
    } catch {
        return false;
    }
}
