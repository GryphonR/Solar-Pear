import { safeHttpUrl } from './safeUrl';

/**
 * Turns a product's `buyLinks` into the links users click (roadmap 4.3).
 *
 * Each catalogue entry keeps `URL` as the canonical product page (what the pricing scan checks)
 * and may add an `affiliateUrl`, which is what the user is sent to. An entry with an
 * `affiliateUrl` is always disclosed as an affiliate link, even if `isAffiliate` was left off.
 * Unsafe URLs are dropped; an unsafe `affiliateUrl` falls back to the canonical URL, unlabelled.
 *
 * Accepts the current array format and the legacy `{ supplier: url }` object.
 * @param {unknown} buyLinks
 * @returns {Array<{ key: string, supplier: string, url: string, isAffiliate: boolean }>}
 */
export function resolveBuyLinks(buyLinks) {
    if (!buyLinks || typeof buyLinks !== 'object') return [];

    if (Array.isArray(buyLinks)) {
        return buyLinks
            .map((entry, index) => {
                if (!entry || typeof entry !== 'object') return null;
                const canonical = safeHttpUrl(entry.URL || entry.url);
                const affiliate = safeHttpUrl(entry.affiliateUrl);
                const url = affiliate || canonical;
                if (!url) return null;
                const supplier = entry.Supplier || `Supplier ${index + 1}`;
                return {
                    key: `${index}-${supplier}-${url}`,
                    supplier,
                    url,
                    isAffiliate: affiliate ? true : !!entry.isAffiliate,
                };
            })
            .filter(Boolean);
    }

    return Object.entries(buyLinks)
        .map(([supplier, raw], index) => {
            const url = safeHttpUrl(raw);
            return url ? { key: `${index}-${supplier}-${url}`, supplier, url, isAffiliate: false } : null;
        })
        .filter(Boolean);
}
