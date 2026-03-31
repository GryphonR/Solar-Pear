/** @param {"panels" | "controllers"} dataset @param {string} file @param {number} index */
export function entryEditPath(dataset, file, index) {
    const base = dataset === "controllers" ? "/controllers" : "/panels";
    const q = new URLSearchParams({ file, index: String(index) });
    return `${base}?${q.toString()}`;
}

/** Bulk-edit shared physical / temp-coef fields for one panel-series in a manufacturer file. */
export function seriesEditPath(file, series) {
    const q = new URLSearchParams({ file, series });
    return `/panels?${q.toString()}`;
}
