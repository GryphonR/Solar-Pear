/** Same list as data-admin/lib/panelSeriesShared.mjs — keep in sync. */
export const PANEL_SERIES_SHARED_FIELDS = [
    "height",
    "width",
    "depth",
    "weight",
    "tempCoefPmax",
    "tempCoefVoc",
    "tempCoefIsc",
];

export function panelSeriesKeyFromRow(row) {
    const s = row["panel-series"];
    if (s === undefined || s === null || String(s).trim() === "") return "(no series)";
    return String(s);
}
