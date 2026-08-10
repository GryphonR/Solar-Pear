/**
 * @file buyLinks.js
 * Normalisation and domain-keyed upsert helpers for product `buyLinks` arrays.
 */

/**
 * Drops the query string and fragment from a URL, e.g. turning
 * `.../product/123?srsltid=AfmBOo...` into `.../product/123`. Retailer query strings are
 * almost always click-tracking (Google `srsltid`, UTM params, affiliate IDs), not needed to
 * reach the product page.
 * @param {string} url
 */
export function stripTrackingParams(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return url; // unparseable - leave as-is rather than losing it
    }
}

/**
 * Normalised supplier hostname for a URL (`www.` stripped), used to decide whether two buy
 * links are from the "same website" and should replace rather than accumulate.
 * @param {string} url
 * @returns {string | null}
 */
export function supplierDomain(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

/**
 * Inserts `newLink` into `buyLinks`, replacing any existing entry from the same supplier
 * domain. Same exact URL is a no-op. Returns whether the list changed.
 * @param {Array<{ Supplier: string, URL: string, isAffiliate?: boolean, Checked?: boolean }>} buyLinks
 * @param {{ Supplier: string, URL: string, isAffiliate?: boolean, Checked?: boolean }} newLink
 * @returns {boolean}
 */
export function upsertBuyLinkByDomain(buyLinks, newLink) {
    const domain = supplierDomain(newLink.URL);
    if (!domain) {
        // Unparseable URL - fall back to exact-URL append so we don't silently drop it.
        if (buyLinks.some((link) => link.URL === newLink.URL)) return false;
        buyLinks.push(newLink);
        return true;
    }

    const existingIndex = buyLinks.findIndex((link) => supplierDomain(link.URL) === domain);
    if (existingIndex === -1) {
        buyLinks.push(newLink);
        return true;
    }

    // Same domain already present: replace unless the URL is already identical (avoids flipping
    // Checked/Supplier fields on a no-op re-discovery of the same page).
    if (buyLinks[existingIndex].URL === newLink.URL) return false;
    buyLinks[existingIndex] = newLink;
    return true;
}

/**
 * Coerces legacy object-shaped buyLinks and fills missing isAffiliate/Checked flags.
 * @param {unknown} buyLinks
 * @returns {Array<{ Supplier: string, URL: string, isAffiliate: boolean, Checked: boolean }>}
 */
export function normalizeBuyLinks(buyLinks) {
    if (Array.isArray(buyLinks)) {
        return buyLinks.map((link) => ({
            ...link,
            isAffiliate: link.isAffiliate || false,
            Checked: Object.prototype.hasOwnProperty.call(link, 'Checked') ? link.Checked : false,
        }));
    }
    if (typeof buyLinks === 'object' && buyLinks !== null) {
        return Object.entries(buyLinks).map(([supplier, url]) => ({
            Supplier: supplier,
            URL: url,
            isAffiliate: false,
            Checked: false,
        }));
    }
    return [];
}
