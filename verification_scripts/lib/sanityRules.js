/**
 * @file sanityRules.js
 * Read-only physical/consistency checks for the panel and controller catalogue (roadmap 3.2).
 * Pure functions: no file or network access, so they run in both the CLI and Vitest.
 *
 * Severity:
 * - error: physically impossible or unsafe data (e.g. Voc ≤ Vmp, PV current above Isc rating,
 *   dev/staging links). CI fails on these.
 * - warning: implausible or incomplete data that needs a human look against the datasheet.
 */

const CONTROLLER_TYPES = new Set([
    'charger',
    'hybrid_inverter',
    'string_inverter',
    'microinverter',
    'ac_coupled_inverter',
    'inverter_charger',
    'dc-dc-charger',
]);
const BATTERY_CHARGER_TYPES = new Set(['charger', 'dc-dc-charger']);
const NON_PRODUCT_HOST = /^(dev|staging|stage|test|beta|preview)\./i;

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const positive = (v) => Number.isFinite(num(v)) && num(v) > 0;

/**
 * @typedef {{ severity: 'error'|'warning', id: string, rule: string, message: string }} Finding
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function linkFindings(item, id, add) {
    const links = Array.isArray(item.buyLinks) ? item.buyLinks : [];
    const urls = [item.datasheetUrl, ...links.flatMap((l) => [l?.URL || l?.url, l?.affiliateUrl])].filter(Boolean);
    for (const url of urls) {
        let host;
        try {
            host = new URL(url).hostname;
        } catch {
            add('error', 'url-invalid', `Unparseable URL: ${url}`);
            continue;
        }
        if (NON_PRODUCT_HOST.test(host)) {
            add('error', 'url-non-production', `Link points at a non-production host (${host}): ${url}`);
        }
    }
    links.forEach((link) => buyLinkFieldFindings(link, add));
}

// Buy link entry fields (roadmap 4.3): URL is the canonical product page that the pricing scan
// checks; affiliateUrl, when set, is what users click.
function buyLinkFieldFindings(link, add) {
    if (!link || typeof link !== 'object') {
        add('error', 'buy-link-shape', 'buyLinks entry is not an object');
        return;
    }
    const who = link.Supplier || link.URL || '?';
    const hasAffiliateUrl = typeof link.affiliateUrl === 'string' && link.affiliateUrl.trim() !== '';
    if (link.affiliateUrl != null && typeof link.affiliateUrl !== 'string') {
        add('error', 'buy-link-affiliate-url', `${who}: affiliateUrl must be a string`);
    } else if (hasAffiliateUrl && !/^https:\/\//i.test(link.affiliateUrl)) {
        add('error', 'buy-link-affiliate-url', `${who}: affiliateUrl must be an https:// URL`);
    }
    if (link.isAffiliate === true && !hasAffiliateUrl) {
        add('error', 'buy-link-affiliate', `${who}: isAffiliate is true but there is no affiliateUrl (keep URL canonical and put the tracking link in affiliateUrl)`);
    }
    if (hasAffiliateUrl && link.isAffiliate !== true) {
        add('error', 'buy-link-affiliate', `${who}: affiliateUrl is set but isAffiliate is not true`);
    }
    if (link.network != null && (typeof link.network !== 'string' || link.network.trim() === '')) {
        add('error', 'buy-link-network', `${who}: network must be a non-empty string when present`);
    } else if (link.network != null && !hasAffiliateUrl) {
        add('warning', 'buy-link-network', `${who}: network is set but there is no affiliateUrl`);
    }
    if (link.price != null && !(typeof link.price === 'number' && Number.isFinite(link.price) && link.price >= 0)) {
        add('error', 'buy-link-price', `${who}: price must be a number of 0 or more (0 = unknown)`);
    }
    if (link.priceCheckedAt != null && link.priceCheckedAt !== '' && !ISO_DATE.test(String(link.priceCheckedAt))) {
        add('error', 'buy-link-price-date', `${who}: priceCheckedAt must be YYYY-MM-DD or ""`);
    }
    if (link.inStock != null && typeof link.inStock !== 'boolean') {
        add('error', 'buy-link-in-stock', `${who}: inStock must be true or false when present`);
    }
}

// Discontinued products stay selectable (people design around existing kit); the note explains why.
function discontinuedFindings(item, add) {
    if (item.discontinuedNote && item.discontinued !== true) {
        add('warning', 'discontinued-note', 'discontinuedNote is set but discontinued is not true');
    }
}

/**
 * @param {object[]} panels
 * @returns {Finding[]}
 */
export function checkPanels(panels) {
    /** @type {Finding[]} */
    const findings = [];
    const seen = new Map();
    for (const p of panels) {
        const id = p.model || '(no model)';
        const add = (severity, rule, message) => findings.push({ severity, id, rule, message });
        if (seen.has(id)) add('error', 'duplicate-id', `Duplicate model id (also in ${seen.get(id)})`);
        seen.set(id, p.manufacturer || '?');

        const { voc, vmp, isc, imp, power, height, width } = p;
        if (!(num(voc) > num(vmp))) add('error', 'voc-vmp', `Voc (${voc}) must exceed Vmp (${vmp})`);
        if (!(num(isc) > num(imp))) add('error', 'isc-imp', `Isc (${isc}) must exceed Imp (${imp})`);

        if (positive(vmp) && positive(imp) && positive(power)) {
            const dev = Math.abs(num(vmp) * num(imp) - num(power)) / num(power);
            if (dev > 0.08) add('error', 'vmp-imp-power', `Vmp × Imp = ${(vmp * imp).toFixed(0)} W vs rated ${power} W (${(dev * 100).toFixed(1)}% off)`);
            else if (dev > 0.03) add('warning', 'vmp-imp-power', `Vmp × Imp = ${(vmp * imp).toFixed(0)} W vs rated ${power} W (${(dev * 100).toFixed(1)}% off)`);
        }

        if (positive(p.efficiency) && positive(power) && positive(height) && positive(width)) {
            const calc = num(power) / ((num(height) * num(width)) / 1e6) / 10;
            const diff = Math.abs(calc - num(p.efficiency));
            if (diff > 0.6) {
                add(
                    diff > 2 ? 'error' : 'warning',
                    'efficiency',
                    `Stated efficiency ${p.efficiency}% vs ${calc.toFixed(2)}% from power ÷ area (${height} × ${width} mm)`
                );
            }
        }

        const range = (field, lo, hi, signError) => {
            const v = num(p[field]);
            if (!Number.isFinite(v)) {
                add('warning', field, `${field} missing`);
            } else if (signError(v)) {
                add('error', field, `${field} ${v} has the wrong sign`);
            } else if (v < lo || v > hi) {
                add('warning', field, `${field} ${v} outside the usual ${lo}…${hi} %/°C`);
            }
        };
        range('tempCoefVoc', -0.35, -0.2, (v) => v >= 0);
        range('tempCoefPmax', -0.45, -0.24, (v) => v >= 0);
        range('tempCoefIsc', 0, 0.08, (v) => v < 0);

        // Flexible laminates (no glass or frame) weigh a fraction of a rigid module.
        const [minKg, maxKg] = p.flexible === true ? [1, 10] : [5, 40];
        if (!positive(p.weight)) add('warning', 'weight', `Weight not published (${p.weight}), so weight limits cannot be checked`);
        else if (num(p.weight) < minKg || num(p.weight) > maxKg) {
            add('warning', 'weight', `Weight ${p.weight} kg outside ${minKg}–${maxKg} kg${p.flexible === true ? ' for a flexible panel' : ''}`);
        }
        if (p.flexible === true && p.gseCompatibility && p.gseCompatibility !== 'None') {
            add('error', 'flexible-gse', `Flexible panel marked GSE-compatible (${p.gseCompatibility})`);
        }

        if (positive(p.maxSystemVoltage) && ![600, 1000, 1500].includes(num(p.maxSystemVoltage))) {
            add('warning', 'max-system-voltage', `Unusual max system voltage ${p.maxSystemVoltage} V`);
        }
        if (!p.datasheetUrl) add('warning', 'datasheet', 'No datasheet URL');
        linkFindings(p, id, add);
        discontinuedFindings(p, add);
    }
    return findings;
}

const INPUT_FIELDS = ['maxIsc', 'maxOperatingI', 'mpptRangeMin', 'mpptRangeMax'];

/**
 * Per-tracker limits (`mpptInputs`, roadmap 1.13): one entry per tracker at most, each input's merged limits
 * consistent, and the controller-level fields no larger than any input's, because they are what an array is
 * checked against before it is on a port.
 */
function mpptInputFindings(c, add) {
    if (c.mpptInputs == null) return;
    if (!Array.isArray(c.mpptInputs)) {
        add('error', 'mppt-inputs', 'mpptInputs must be an array');
        return;
    }
    if (c.mpptInputs.length > num(c.trackers)) {
        add('error', 'mppt-inputs', `${c.mpptInputs.length} mpptInputs entries but only ${c.trackers} trackers`);
    }
    c.mpptInputs.forEach((input, i) => {
        const label = `MPPT ${i + 1}`;
        if (!input || typeof input !== 'object') {
            add('error', 'mppt-inputs', `${label}: entry must be an object`);
            return;
        }
        const unknown = Object.keys(input).filter((k) => !INPUT_FIELDS.includes(k));
        if (unknown.length) add('error', 'mppt-inputs', `${label}: unknown field(s) ${unknown.join(', ')}`);
        const v = { ...c };
        for (const k of INPUT_FIELDS) if (positive(input[k])) v[k] = num(input[k]);
        if (positive(v.maxOperatingI) && positive(v.maxIsc) && num(v.maxOperatingI) > num(v.maxIsc)) {
            add('error', 'pv-current', `${label}: PV operating current ${v.maxOperatingI} A exceeds PV Isc rating ${v.maxIsc} A`);
        }
        if (positive(v.mpptRangeMax) && num(v.mpptRangeMax) > num(c.maxV)) {
            add('error', 'mppt-range', `${label}: MPPT maximum ${v.mpptRangeMax} V exceeds max PV voltage ${c.maxV} V`);
        }
        if (positive(v.mpptRangeMin) && positive(v.mpptRangeMax) && num(v.mpptRangeMin) >= num(v.mpptRangeMax)) {
            add('error', 'mppt-range', `${label}: MPPT minimum ${v.mpptRangeMin} V is not below maximum ${v.mpptRangeMax} V`);
        }
        for (const k of ['maxIsc', 'maxOperatingI']) {
            if (positive(input[k]) && positive(c[k]) && num(input[k]) < num(c[k])) {
                add('warning', 'mppt-inputs', `${label}: ${k} ${input[k]} is below the controller-level ${c[k]}, which should hold the smallest tracker's limit`);
            }
        }
    });
}

/**
 * @param {object[]} controllers
 * @returns {Finding[]}
 */
export function checkControllers(controllers) {
    /** @type {Finding[]} */
    const findings = [];
    const seen = new Map();
    for (const c of controllers) {
        const id = c.id || '(no id)';
        const add = (severity, rule, message) => findings.push({ severity, id, rule, message });
        if (seen.has(id)) add('error', 'duplicate-id', `Duplicate id (also in ${seen.get(id)})`);
        seen.set(id, c.manufacturer || '?');

        if (!CONTROLLER_TYPES.has(c.type)) add('error', 'type', `Unknown type "${c.type}"`);

        const hasPvInput = positive(c.maxV);
        if (hasPvInput) {
            if (positive(c.maxOperatingI) && positive(c.maxIsc) && num(c.maxOperatingI) > num(c.maxIsc)) {
                add(
                    'error',
                    'pv-current',
                    `PV operating current ${c.maxOperatingI} A exceeds PV Isc rating ${c.maxIsc} A (battery charge current belongs in maxChargeCurrent)`
                );
            }
            if (!positive(c.maxIsc)) add('warning', 'max-isc', 'No PV short-circuit rating (maxIsc), so current checks are skipped');
            if (positive(c.mpptRangeMax) && num(c.mpptRangeMax) > num(c.maxV)) {
                add('error', 'mppt-range', `MPPT maximum ${c.mpptRangeMax} V exceeds max PV voltage ${c.maxV} V`);
            }
            if (positive(c.mpptRangeMin) && positive(c.mpptRangeMax) && num(c.mpptRangeMin) >= num(c.mpptRangeMax)) {
                add('error', 'mppt-range', `MPPT minimum ${c.mpptRangeMin} V is not below maximum ${c.mpptRangeMax} V`);
            }
            if (positive(c.startupV) && positive(c.mpptRangeMax) && num(c.startupV) > num(c.mpptRangeMax)) {
                add('warning', 'startup', `Startup ${c.startupV} V is above the MPPT maximum ${c.mpptRangeMax} V`);
            }
            if (BATTERY_CHARGER_TYPES.has(c.type) && !positive(c.maxChargeCurrent)) {
                add('warning', 'charge-current', 'Battery charger without maxChargeCurrent, so the power check is skipped');
            }
            if (!(num(c.trackers) >= 1)) add('error', 'trackers', `PV input but trackers = ${c.trackers}`);
            mpptInputFindings(c, add);
        } else if (c.type !== 'ac_coupled_inverter' && c.type !== 'dc-dc-charger') {
            add('warning', 'no-pv-input', 'maxV is 0: this unit cannot take panels');
        }
        if (!c.datasheetUrl) add('warning', 'datasheet', 'No datasheet URL');
        linkFindings(c, id, add);
        discontinuedFindings(c, add);
    }
    return findings;
}

/** Formats findings as lines, errors first. */
export function formatFindings(findings) {
    return [...findings]
        .sort((a, b) => (a.severity === b.severity ? a.id.localeCompare(b.id) : a.severity === 'error' ? -1 : 1))
        .map((f) => `${f.severity.toUpperCase().padEnd(7)} ${f.id}  [${f.rule}]  ${f.message}`);
}
