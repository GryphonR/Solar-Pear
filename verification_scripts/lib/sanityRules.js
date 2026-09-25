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

function linkFindings(item, id, add) {
    const links = Array.isArray(item.buyLinks) ? item.buyLinks : [];
    const urls = [item.datasheetUrl, ...links.map((l) => l?.URL || l?.url)].filter(Boolean);
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

        if (!positive(p.weight)) add('warning', 'weight', `Weight not published (${p.weight}), so weight limits cannot be checked`);
        else if (num(p.weight) < 5 || num(p.weight) > 40) add('warning', 'weight', `Weight ${p.weight} kg outside 5–40 kg`);

        if (positive(p.maxSystemVoltage) && ![600, 1000, 1500].includes(num(p.maxSystemVoltage))) {
            add('warning', 'max-system-voltage', `Unusual max system voltage ${p.maxSystemVoltage} V`);
        }
        if (!p.datasheetUrl) add('warning', 'datasheet', 'No datasheet URL');
        linkFindings(p, id, add);
    }
    return findings;
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
        } else if (c.type !== 'ac_coupled_inverter' && c.type !== 'dc-dc-charger') {
            add('warning', 'no-pv-input', 'maxV is 0: this unit cannot take panels');
        }
        if (!c.datasheetUrl) add('warning', 'datasheet', 'No datasheet URL');
        linkFindings(c, id, add);
    }
    return findings;
}

/** Formats findings as lines, errors first. */
export function formatFindings(findings) {
    return [...findings]
        .sort((a, b) => (a.severity === b.severity ? a.id.localeCompare(b.id) : a.severity === 'error' ? -1 : 1))
        .map((f) => `${f.severity.toUpperCase().padEnd(7)} ${f.id}  [${f.rule}]  ${f.message}`);
}
