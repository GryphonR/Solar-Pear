/**
 * @file urlQuality.js
 * Link-quality filters and HTTP checks shared by review + pricing scanners.
 */

export const FETCH_TIMEOUT_MS = 10000;

/**
 * A URL that resolves back onto Google itself (its own "compare prices across sellers" page)
 * rather than a specific merchant's page.
 * @param {string} url
 */
export function isGoogleAggregatorLink(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'google.com' || host.endsWith('.google.com') || host === 'google.co.uk' || host.endsWith('.google.co.uk');
    } catch {
        return true; // unparseable URL is equally unusable
    }
}

/** @param {string} url */
export function isPdfLink(url) {
    try {
        return /\.pdf(?:[?#]|$)/i.test(new URL(url).pathname);
    } catch {
        return true;
    }
}

/**
 * A listing for damaged, clearance, ex-display, or otherwise non-standard stock - not the
 * standard product. Real merchant pages, but misleading as a normal "buy this" link.
 * @param {string} title
 * @param {string} url
 */
export function isClearanceOrDamagedListing(title, url) {
    const haystack = `${title || ''} ${url || ''}`.toLowerCase();
    return /\b(damaged|clearance|b-?grade|reject|seconds|refurbished|ex-display|surplus|salvage)\b/.test(haystack);
}

/**
 * True when a URL's *path* is itself a retailer soft-error page (e.g. City Plumbing's
 * `/error-500`). Some merchants redirect dead product URLs here and still serve a full HTML
 * document - occasionally even with a 200.
 * @param {string} url
 */
export function isSoftErrorPageUrl(url) {
    try {
        return /\/error-\d+/i.test(new URL(url).pathname);
    } catch {
        return false;
    }
}

/**
 * True when page HTML looks like a branded soft-error / "something went wrong" document
 * rather than a product listing.
 * @param {string} html
 */
export function looksLikeSoftErrorHtml(html) {
    if (!html) return false;
    // Cap the scan - error chrome is always near the top; no need to walk a 500KB product page.
    const sample = html.slice(0, 80000).toLowerCase();
    const hasInternalServerError = sample.includes('internal server error');
    const hasSomethingWentWrong = sample.includes('something went wrong');
    // City Plumbing's /error-500 page carries both phrases; either alone is too weak on a
    // normal product page that might mention "sorry" in shipping copy.
    if (hasInternalServerError && hasSomethingWentWrong) return true;
    return /<title[^>]*>\s*(?:error\s*500|500\s*error|internal server error)/i.test(html);
}

/**
 * Lightweight HEAD/GET status check used by review scripts. Soft-error redirect targets fail
 * even when the final status is HTTP 200.
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, status: number | string }>}
 */
export async function checkUrl(url, opts = {}) {
    if (!url) return { ok: false, status: 'No URL' };

    const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Soft-error redirects (dead product → /error-500) must fail even if status is 200.
        if (isSoftErrorPageUrl(response.url)) {
            return {
                ok: false,
                status: `Soft error page (${response.status}) → ${response.url}`,
            };
        }

        return {
            ok: response.status === 200,
            status: response.status,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return { ok: false, status: `Timeout (${Math.round(timeoutMs / 1000)}s)` };
        }
        return { ok: false, status: `Fetch Error: ${error.message || 'Unknown'}` };
    }
}
