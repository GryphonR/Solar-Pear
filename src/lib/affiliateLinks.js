/**
 * Affiliate link rewrite rules (roadmap 4.5).
 *
 * `src/data/affiliates.json` maps a retailer domain to the way its affiliate programme builds
 * tracking links. The catalogue JSON keeps only canonical product URLs; when the bundled
 * catalogue is loaded, every buy link on an enabled programme's domain gets a generated
 * `affiliateUrl` (and `network`, `isAffiliate`). The generated links never reach the JSON files,
 * so the pricing scan only ever sees canonical URLs, and changing a network or ID is one edit.
 *
 * A programme is either a deeplink `template`, where `{url}` is replaced by the URL-encoded
 * product URL (Awin, CJ, Impact, Partnerize style), or `params`, query parameters added to the
 * product URL itself (Amazon's `tag`, in-house `?aff=` schemes). An `affiliateUrl` written by
 * hand on a catalogue entry always wins over a rule.
 */

/** Hostname without `www.`, lower-cased, or null for an unparseable URL. */
function hostOf(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

/**
 * The programme for a URL: an exact domain match, else the closest parent domain
 * (`uk.renogy.com` matches `renogy.com`). Disabled programmes are ignored.
 * @param {string} url
 * @param {Record<string, object>} programmes
 */
export function findProgramme(url, programmes) {
    let host = hostOf(url);
    while (host && host.includes('.')) {
        const programme = programmes?.[host];
        if (programme && programme.enabled !== false) return programme;
        host = host.slice(host.indexOf('.') + 1);
    }
    return null;
}

/**
 * Builds the affiliate URL for a canonical product URL, or null if the programme can't.
 * @param {string} url
 * @param {{ template?: string, params?: Record<string, string> }} programme
 * @returns {string | null}
 */
export function buildAffiliateUrl(url, programme) {
    let product;
    try {
        product = new URL(url);
    } catch {
        return null;
    }
    if (product.protocol !== 'https:' && product.protocol !== 'http:') return null;

    let out;
    if (typeof programme.template === 'string') {
        out = programme.template.split('{url}').join(encodeURIComponent(product.href));
    } else if (programme.params && typeof programme.params === 'object') {
        for (const [key, value] of Object.entries(programme.params)) product.searchParams.set(key, String(value));
        out = product.href;
    } else {
        return null;
    }
    try {
        return new URL(out).protocol === 'https:' ? out : null;
    } catch {
        return null;
    }
}

/**
 * Returns `buyLinks` with affiliate URLs filled in from the rules. Entries that already have an
 * `affiliateUrl`, or whose domain has no enabled programme, are returned unchanged.
 * @param {unknown} buyLinks
 * @param {Record<string, object>} programmes
 */
export function applyAffiliateRules(buyLinks, programmes) {
    if (!Array.isArray(buyLinks) || !programmes || Object.keys(programmes).length === 0) return buyLinks;
    let changed = false;
    const out = buyLinks.map((link) => {
        if (!link || typeof link !== 'object' || typeof link.URL !== 'string') return link;
        if (typeof link.affiliateUrl === 'string' && link.affiliateUrl.trim()) return link;
        const programme = findProgramme(link.URL, programmes);
        const affiliateUrl = programme && buildAffiliateUrl(link.URL, programme);
        if (!affiliateUrl) return link;
        changed = true;
        return { ...link, affiliateUrl, network: programme.network, isAffiliate: true };
    });
    return changed ? out : buyLinks;
}

/**
 * Applies the rules to a list of catalogue items (panels or controllers), keeping the original
 * objects where nothing changes.
 * @template T
 * @param {T[]} items
 * @param {Record<string, object>} programmes
 * @returns {T[]}
 */
export function applyAffiliateRulesToCatalogue(items, programmes) {
    return items.map((item) => {
        const buyLinks = applyAffiliateRules(item?.buyLinks, programmes);
        return buyLinks === item?.buyLinks ? item : { ...item, buyLinks };
    });
}

const DOMAIN = /^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * Checks `affiliates.json`. Returns a list of problems (empty when valid). A test runs this on
 * the shipped file, so a malformed rule fails CI rather than producing broken links.
 * @param {unknown} config
 * @returns {string[]}
 */
export function validateAffiliateConfig(config) {
    const problems = [];
    const programmes = config?.programmes;
    if (!programmes || typeof programmes !== 'object' || Array.isArray(programmes)) {
        return ['"programmes" must be an object keyed by retailer domain'];
    }
    for (const [domain, p] of Object.entries(programmes)) {
        const at = `programmes["${domain}"]`;
        if (!DOMAIN.test(domain)) problems.push(`${at}: key must be a lower-case domain without "www."`);
        if (!p || typeof p !== 'object') {
            problems.push(`${at}: must be an object`);
            continue;
        }
        if (typeof p.network !== 'string' || !p.network.trim()) problems.push(`${at}: "network" is required`);
        if (p.enabled != null && typeof p.enabled !== 'boolean') problems.push(`${at}: "enabled" must be true or false`);
        const hasTemplate = p.template != null;
        const hasParams = p.params != null;
        if (hasTemplate === hasParams) {
            problems.push(`${at}: give exactly one of "template" or "params"`);
            continue;
        }
        if (hasTemplate) {
            if (typeof p.template !== 'string' || !p.template.startsWith('https://')) {
                problems.push(`${at}: "template" must be an https:// URL`);
            } else if (!p.template.includes('{url}')) {
                problems.push(`${at}: "template" must contain {url}`);
            } else if (/\{(?!url\})[^}]*\}/.test(p.template)) {
                problems.push(`${at}: "template" has a placeholder other than {url} (fill in the IDs)`);
            }
        }
        if (hasParams) {
            const entries = p.params && typeof p.params === 'object' && !Array.isArray(p.params) ? Object.entries(p.params) : [];
            if (entries.length === 0) problems.push(`${at}: "params" must be a non-empty object`);
            for (const [key, value] of entries) {
                if (typeof value !== 'string' || !value.trim()) problems.push(`${at}: params.${key} must be a non-empty string`);
            }
        }
        if (!problems.some((msg) => msg.startsWith(at))) {
            const sample = buildAffiliateUrl(`https://${domain}/product`, p);
            if (!sample) problems.push(`${at}: does not produce a valid https:// link`);
        }
    }
    return problems;
}
