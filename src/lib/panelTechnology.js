/**
 * @file panelTechnology.js
 * Classifies panels in the database by cell architecture and glass construction, and summarises
 * each group, so the Guide to Panels can cite real examples and real figures instead of
 * hardcoded ones that would rot as the database grows.
 *
 * Classification reads only what a panel record actually states - the `cells` and `glass`
 * strings - and returns `null` when the record does not name a technology. Nothing is inferred
 * from model or series names, because guessing an architecture would put wrong engineering
 * claims in front of the user. Entries that omit the technology simply go uncited.
 */

/** Cell architecture identifiers, ordered roughly oldest to newest. */
export const PANEL_TECH = {
    MONO_GENERIC: 'mono-generic',
    PERC: 'perc',
    TOPCON: 'topcon',
    HJT: 'hjt',
    BACK_CONTACT: 'back-contact',
};

/** Glass / encapsulation construction identifiers. */
export const GLASS_TYPE = {
    SINGLE: 'single',
    DUAL: 'dual',
    POLYMER: 'polymer',
    UNKNOWN: 'unknown',
};

/**
 * Ordered match rules for cell architecture, most specific first. "N-Type" on its own is
 * deliberately not a rule: the wafer doping is not an architecture, so an entry naming only that
 * goes uncited rather than being grouped as though it described a cell design.
 */
const TECH_RULES = [
    // ABC (Aiko), HPBC (LONGi) and IBC (Maxeon) are all rear-contact families.
    { tech: PANEL_TECH.BACK_CONTACT, pattern: /\b(ABC|HPBC|IBC)\b/i },
    { tech: PANEL_TECH.HJT, pattern: /\b(HJT|heterojunction)\b/i },
    { tech: PANEL_TECH.TOPCON, pattern: /TOPCon/i },
    { tech: PANEL_TECH.HJT, pattern: /\bHIT\b/ },
    // Q.ANTUM is Q-Cells' branded PERC derivative.
    { tech: PANEL_TECH.PERC, pattern: /\b(PERC|Q\.ANTUM)\b/i },
    { tech: PANEL_TECH.MONO_GENERIC, pattern: /\b(mono|monocrystalline)\b/i },
];

/**
 * Identifies a panel's cell architecture from its database entry.
 *
 * @param {object} panel Panel record.
 * @returns {string | null} A `PANEL_TECH` value, or `null` when the entry names no architecture.
 */
export function classifyPanelTechnology(panel) {
    const cells = panel?.cells;
    if (typeof cells !== 'string' || cells.trim() === '') return null;

    for (const { tech, pattern } of TECH_RULES) {
        if (pattern.test(cells)) return tech;
    }
    return null;
}

/**
 * Identifies a panel's glass construction from its database entry.
 *
 * Front-glass-only descriptions are reported as single-glass regardless of how the thickness is
 * worded, since a record naming just one pane has no rear glass.
 *
 * @param {object} panel Panel record.
 * @returns {string} A `GLASS_TYPE` value.
 */
export function classifyGlassType(panel) {
    const glass = panel?.glass;
    if (typeof glass !== 'string' || glass.trim() === '') return GLASS_TYPE.UNKNOWN;

    if (/dual|glass-glass|double/i.test(glass)) return GLASS_TYPE.DUAL;
    // ETFE-coated modules are lightweight flexible laminates with no glass at all.
    if (/etfe|polymer|flexible/i.test(glass)) return GLASS_TYPE.POLYMER;
    if (/single|tempered|glass/i.test(glass)) return GLASS_TYPE.SINGLE;
    return GLASS_TYPE.UNKNOWN;
}

/**
 * Mean of the finite numbers produced by `pick`, or `null` when the group yields none.
 *
 * @param {object[]} items
 * @param {(item: object) => number | null | undefined} pick
 * @returns {number | null}
 */
function meanOf(items, pick) {
    const values = items.map(pick).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Range of the finite numbers produced by `pick`, or `null` when the group yields none.
 *
 * @param {object[]} items
 * @param {(item: object) => number | null | undefined} pick
 * @returns {{ min: number, max: number } | null}
 */
function rangeOf(items, pick) {
    const values = items.map(pick).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Summarises one group of panels for display in the guide.
 *
 * @param {object[]} panels Panels sharing a technology.
 * @param {number} [exampleLimit=3] How many named examples to surface.
 * @returns {{
 *   count: number,
 *   efficiency: { min: number, max: number } | null,
 *   power: { min: number, max: number } | null,
 *   avgTempCoefPmax: number | null,
 *   avgTempCoefVoc: number | null,
 *   bifacialCount: number,
 *   examples: object[]
 * }}
 */
export function summarisePanelGroup(panels, exampleLimit = 3) {
    const list = Array.isArray(panels) ? panels : [];

    // Highest efficiency first, so the examples shown are the group's strongest representatives.
    const examples = [...list]
        .sort((a, b) => (b.efficiency ?? 0) - (a.efficiency ?? 0))
        .slice(0, exampleLimit);

    return {
        count: list.length,
        efficiency: rangeOf(list, (p) => p.efficiency),
        power: rangeOf(list, (p) => p.power),
        avgTempCoefPmax: meanOf(list, (p) => p.tempCoefPmax),
        avgTempCoefVoc: meanOf(list, (p) => p.tempCoefVoc),
        bifacialCount: list.filter((p) => p.bifacial === true).length,
        examples,
    };
}

/**
 * Groups panels by cell architecture, keeping only entries that name one.
 *
 * @param {object[]} panelsData All panels from the database.
 * @returns {Record<string, object[]>} Keyed by `PANEL_TECH` value.
 */
export function groupPanelsByTechnology(panelsData) {
    const groups = {};
    for (const panel of Array.isArray(panelsData) ? panelsData : []) {
        const tech = classifyPanelTechnology(panel);
        if (!tech) continue;
        (groups[tech] ||= []).push(panel);
    }
    return groups;
}

/**
 * Groups panels by glass construction.
 *
 * @param {object[]} panelsData All panels from the database.
 * @returns {Record<string, object[]>} Keyed by `GLASS_TYPE` value.
 */
export function groupPanelsByGlass(panelsData) {
    const groups = {};
    for (const panel of Array.isArray(panelsData) ? panelsData : []) {
        const glass = classifyGlassType(panel);
        (groups[glass] ||= []).push(panel);
    }
    return groups;
}

/**
 * Module area in m², from the recorded height and width.
 *
 * @param {object} panel Panel record.
 * @returns {number | null} Area in m², or `null` when either dimension is missing.
 */
export function getPanelAreaM2(panel) {
    const h = Number(panel?.height);
    const w = Number(panel?.width);
    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;
    return (h / 1000) * (w / 1000);
}

/**
 * Mass per unit area in kg/m².
 *
 * Raw kilograms say more about how big a module is than how it is built, so any comparison of
 * construction - glass-glass against single glass, say - has to normalise by area to mean
 * anything. This is also the figure that matters for roof loading.
 *
 * @param {object} panel Panel record.
 * @returns {number | null} kg/m², or `null` when weight or dimensions are missing.
 */
export function getPanelMassPerAreaKgM2(panel) {
    const area = getPanelAreaM2(panel);
    const weight = Number(panel?.weight);
    if (area == null || !Number.isFinite(weight) || weight <= 0) return null;
    return weight / area;
}

/**
 * Total thickness of glass in the laminate, in mm, summing both panes on a glass-glass module.
 * Parsed from free-text entries such as "Dual (1.6mm + 1.6mm)" or "Single (3.2mm AR Coated)".
 *
 * @param {object} panel Panel record.
 * @returns {number | null} Total glass in mm, or `null` when no thickness is stated.
 */
export function getTotalGlassThicknessMm(panel) {
    const glass = panel?.glass;
    if (typeof glass !== 'string') return null;

    const matches = glass.match(/(\d+(?:\.\d+)?)\s*mm/gi);
    if (!matches || matches.length === 0) return null;

    // Sum every stated pane, so a dual 1.6 + 1.6 build totals the same 3.2mm as single 3.2 glass.
    return matches.reduce((total, m) => total + parseFloat(m), 0);
}

/**
 * Median of the finite numbers produced by `pick`, or `null` when the group yields none.
 * Preferred over the mean here because the database is small and hand-entered, so one bad
 * figure would visibly drag an average.
 *
 * @param {object[]} items
 * @param {(item: object) => number | null | undefined} pick
 * @returns {number | null}
 */
function medianOf(items, pick) {
    const values = items
        .map(pick)
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
        .sort((a, b) => a - b);
    if (values.length === 0) return null;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

/**
 * Buckets panels by glass construction and total glass thickness, reporting area-normalised mass
 * for each build. This is what makes a fair weight comparison between constructions possible.
 *
 * @param {object[]} panelsData All panels from the database.
 * @param {number} [minCount=1] Drop builds represented by fewer panels than this. A single
 *        outlier says nothing about a construction, and datasheets are not always self-consistent
 *        about glass thickness, so a comparison table wants a few entries behind each row.
 * @returns {{
 *   key: string,
 *   type: string,
 *   totalGlassMm: number | null,
 *   count: number,
 *   medianKgM2: number | null,
 *   examples: object[]
 * }[]} Ascending by median mass per area.
 */
export function summariseGlassBuilds(panelsData, minCount = 1) {
    const buckets = new Map();

    for (const panel of Array.isArray(panelsData) ? panelsData : []) {
        const type = classifyGlassType(panel);
        const totalGlassMm = getTotalGlassThicknessMm(panel);
        const key = `${type}:${totalGlassMm ?? 'unstated'}`;
        if (!buckets.has(key)) buckets.set(key, { key, type, totalGlassMm, panels: [] });
        buckets.get(key).panels.push(panel);
    }

    return [...buckets.values()]
        // A build whose thickness is unknown cannot take part in a thickness-versus-weight
        // comparison. Several manufacturers - Viridian and Victron among them - state only
        // "tempered" or "glass-glass" on their datasheets, so the figure is genuinely
        // unpublished rather than missing from the catalogue, and inventing one would be worse
        // than omitting the row. Their construction type is still recorded and used elsewhere.
        .filter(({ totalGlassMm, panels }) => totalGlassMm != null && panels.length >= minCount)
        .map(({ key, type, totalGlassMm, panels }) => ({
            key,
            type,
            totalGlassMm,
            count: panels.length,
            medianKgM2: medianOf(panels, getPanelMassPerAreaKgM2),
            examples: panels.slice(0, 2),
        }))
        .sort((a, b) => (a.medianKgM2 ?? Infinity) - (b.medianKgM2 ?? Infinity));
}

/**
 * How many entries carry a human review, so the guides can be honest about how much of the
 * catalogue has been checked against datasheets.
 *
 * @param {object[]} records Panel or controller records.
 * @returns {{ reviewed: number, total: number }}
 */
export function countReviewed(records) {
    const list = Array.isArray(records) ? records : [];
    return { reviewed: list.filter((r) => r.reviewed === true).length, total: list.length };
}

/**
 * Counts how many half-cut cells a panel's entry reports, e.g. "108 Half-Cell (TOPCon)" → 108.
 * Used to explain how cell count shapes a module's voltage and current profile.
 *
 * @param {object} panel Panel record.
 * @returns {number | null} Cell count, or `null` when the entry does not state a half-cell count.
 */
export function getHalfCellCount(panel) {
    const cells = panel?.cells;
    if (typeof cells !== 'string') return null;
    const match = cells.match(/(\d+)\s*(?:Half[-\s]?Cell|HC)\b/i);
    return match ? Number(match[1]) : null;
}

/**
 * Groups panels by their half-cell count, for illustrating the link between module format and
 * string design. Entries with no stated half-cell count are omitted.
 *
 * @param {object[]} panelsData All panels from the database.
 * @returns {{ cellCount: number, panels: object[], avgVoc: number | null, avgIsc: number | null }[]}
 *          Ascending by cell count.
 */
export function groupPanelsByCellCount(panelsData) {
    const buckets = new Map();
    for (const panel of Array.isArray(panelsData) ? panelsData : []) {
        const count = getHalfCellCount(panel);
        if (count == null) continue;
        if (!buckets.has(count)) buckets.set(count, []);
        buckets.get(count).push(panel);
    }

    return [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([cellCount, panels]) => ({
            cellCount,
            panels,
            avgVoc: meanOf(panels, (p) => p.voc),
            avgIsc: meanOf(panels, (p) => p.isc),
        }));
}
