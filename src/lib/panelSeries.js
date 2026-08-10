/**
 * Panel series grouping helpers for Manufacturer → Series → Power UI.
 * Mirrors data-admin panelSeriesKey semantics so empty series bucket as "(no series)".
 */

/** Sentinel label for panels with a missing or blank panel-series field. */
export const NO_SERIES_LABEL = '(no series)';

/**
 * Stable series key for grouping/filtering.
 * @param {{ "panel-series"?: unknown }} entry
 * @returns {string}
 */
export function panelSeriesKey(entry) {
    const s = entry?.['panel-series'];
    if (s === undefined || s === null || String(s).trim() === '') return NO_SERIES_LABEL;
    return String(s);
}

/**
 * Compare panels for catalog order: manufacturer → series → power → model.
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {number}
 */
export function compareByManufacturerSeriesPower(a, b) {
    const mfrA = String(a?.manufacturer || 'Unknown');
    const mfrB = String(b?.manufacturer || 'Unknown');
    const mfrCmp = mfrA.localeCompare(mfrB);
    if (mfrCmp !== 0) return mfrCmp;

    const seriesCmp = panelSeriesKey(a).localeCompare(panelSeriesKey(b));
    if (seriesCmp !== 0) return seriesCmp;

    const powerCmp = (Number(a?.power) || 0) - (Number(b?.power) || 0);
    if (powerCmp !== 0) return powerCmp;

    return String(a?.model || '').localeCompare(String(b?.model || ''));
}

/**
 * Group panels by series key, preserving input order within each group.
 * Series keys are sorted alphabetically for stable UI sections.
 * @param {Record<string, unknown>[]} panels
 * @returns {{ seriesKey: string, panels: Record<string, unknown>[] }[]}
 */
export function groupPanelsBySeries(panels) {
    /** @type {Map<string, Record<string, unknown>[]>} */
    const map = new Map();
    for (const p of panels || []) {
        const key = panelSeriesKey(p);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(p);
    }
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([seriesKey, groupPanels]) => ({ seriesKey, panels: groupPanels }));
}

/**
 * Whether a series key is the sentinel bucket for panels with a missing/blank `panel-series`.
 * These panels have no series to share a design note with, so notes stay per-panel for them.
 * @param {string} seriesKey
 * @returns {boolean}
 */
export function isNoSeriesKey(seriesKey) {
    return seriesKey === NO_SERIES_LABEL;
}

/**
 * The shared "Design Notes" text for a series. Every panel in a real series is expected to
 * carry identical `notes`, so the first non-empty value represents the whole group; this
 * tolerates a lone blank/mismatched entry rather than hiding the note entirely.
 *
 * Returns "" for the "(no series)" edge case bucket, since those panels have no series-wide
 * note to share - each keeps its own individual `notes` instead (read `panel.notes` directly).
 *
 * @param {string} seriesKey
 * @param {{ notes?: string }[]} panels Panels already filtered to this series.
 * @returns {string}
 */
export function seriesDesignNotes(seriesKey, panels) {
    if (isNoSeriesKey(seriesKey)) return '';
    for (const p of panels || []) {
        if (p?.notes) return p.notes;
    }
    return '';
}

/**
 * Composite filter value when manufacturer filter is "All" so series names
 * do not collide across brands.
 * @param {string} manufacturer
 * @param {string} seriesKey
 * @returns {string}
 */
export function manufacturerSeriesFilterValue(manufacturer, seriesKey) {
    return `${manufacturer || 'Unknown'}|${seriesKey}`;
}

/**
 * Parse a composite manufacturer|series filter value.
 * @param {string} value
 * @returns {{ manufacturer: string, seriesKey: string } | null}
 */
export function parseManufacturerSeriesFilterValue(value) {
    if (!value || typeof value !== 'string') return null;
    const sep = value.indexOf('|');
    if (sep < 0) return null;
    return {
        manufacturer: value.slice(0, sep),
        seriesKey: value.slice(sep + 1),
    };
}
