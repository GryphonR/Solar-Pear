/** Fields that must match for every panel in the same `panel-series` within a manufacturer file. */
export const PANEL_SERIES_SHARED_FIELDS = [
    "height",
    "width",
    "depth",
    "weight",
    "tempCoefPmax",
    "tempCoefVoc",
    "tempCoefIsc",
];

/** Sentinel series key for panels with a missing/blank `panel-series` (see SCHEMA.md "Design notes"). */
export const NO_SERIES_KEY = "(no series)";

export function panelSeriesKey(entry) {
    const s = entry["panel-series"];
    if (s === undefined || s === null || String(s).trim() === "") return NO_SERIES_KEY;
    return String(s);
}

function valuesEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b)) {
        return Math.abs(a - b) < 1e-9;
    }
    return false;
}

/**
 * @param {string} file
 * @param {Record<string, unknown>[]} arr
 * @param {object[]} issues
 */
export function pushPanelSeriesUniformityIssues(file, arr, issues) {
    /** @type {Map<string, { index: number, row: Record<string, unknown> }[]>} */
    const groups = new Map();
    for (let index = 0; index < arr.length; index++) {
        const row = arr[index];
        const key = panelSeriesKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ index, row });
    }

    for (const [series, members] of groups) {
        if (members.length < 2) continue;
        for (const field of PANEL_SERIES_SHARED_FIELDS) {
            const ref = members[0].row[field];
            let mismatch = false;
            for (let i = 1; i < members.length; i++) {
                if (!valuesEqual(members[i].row[field], ref)) {
                    mismatch = true;
                    break;
                }
            }
            if (!mismatch) continue;
            const variants = members.map(({ index, row }) => ({
                index,
                model: row.model,
                value: row[field],
            }));
            issues.push({
                kind: "series_spec_mismatch",
                severity: "warning",
                file,
                series,
                field,
                index: members[0].index,
                label: `${file.replace(/\.json$/i, "")} — “${series}” (${members.length} panels)`,
                message: `Field “${field}” differs within this series`,
                variants,
            });
        }
    }
}

/**
 * `notes` ("Design Notes", see SCHEMA.md) is a per-series field: every panel sharing the same
 * `panel-series` must carry identical text. Panels bucketed into the `NO_SERIES_KEY` sentinel
 * are the documented edge case - they have no series to share a note with, so they are excluded
 * from this check entirely and keep independent, panel-specific notes.
 *
 * @param {string} file
 * @param {Record<string, unknown>[]} arr
 * @param {object[]} issues
 */
export function pushDesignNotesUniformityIssues(file, arr, issues) {
    /** @type {Map<string, { index: number, row: Record<string, unknown> }[]>} */
    const groups = new Map();
    for (let index = 0; index < arr.length; index++) {
        const row = arr[index];
        const key = panelSeriesKey(row);
        if (key === NO_SERIES_KEY) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ index, row });
    }

    for (const [series, members] of groups) {
        if (members.length < 2) continue;
        const ref = members[0].row.notes;
        const mismatched = members.filter((m) => !valuesEqual(m.row.notes, ref));
        if (mismatched.length === 0) continue;
        const variants = members.map(({ index, row }) => ({
            index,
            model: row.model,
            value: row.notes,
        }));
        issues.push({
            kind: "design_notes_mismatch",
            severity: "warning",
            file,
            series,
            field: "notes",
            index: members[0].index,
            label: `${file.replace(/\.json$/i, "")} — “${series}” (${members.length} panels)`,
            message: `Design Notes differ within this series`,
            variants,
        });
    }
}
