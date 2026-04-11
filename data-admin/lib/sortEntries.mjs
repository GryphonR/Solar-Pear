/**
 * Shared panel/controller sort logic used by schema apply and API sort.
 * @param {"panels"|"controllers"} kind
 * @param {Array<Record<string, unknown>>} entries
 */
export function sortEntries(kind, entries) {
    const arr = Array.isArray(entries) ? [...entries] : [];
    if (kind === "panels") {
        arr.sort((a, b) => {
            const sA = a["panel-series"] || "";
            const sB = b["panel-series"] || "";
            if (sA < sB) return -1;
            if (sA > sB) return 1;
            return (Number(a.power) || 0) - (Number(b.power) || 0);
        });
        return arr;
    }

    arr.sort((a, b) => {
        const aM = String(a.modelNumber || a.name || "");
        const bM = String(b.modelNumber || b.name || "");
        return aM.localeCompare(bM);
    });
    return arr;
}
