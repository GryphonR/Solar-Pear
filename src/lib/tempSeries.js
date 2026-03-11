const STC_TEMP_C = 25;
const TEMP_MIN = -40;
const TEMP_MAX = 85;
const TEMP_STEP = 1;

/**
 * Build temperature array from TEMP_MIN to TEMP_MAX (inclusive) by TEMP_STEP.
 */
export function buildTempRange() {
    const temps = [];
    for (let t = TEMP_MIN; t <= TEMP_MAX; t += TEMP_STEP) {
        temps.push(t);
    }
    return temps;
}

/**
 * Compute temperature-sweep series for array overview graphs.
 * Only includes a series when the panel has the required temp coefficient in JSON (no fallbacks).
 * @param {object} panel - Panel with voc, isc, power and optional tempCoefVoc, tempCoefIsc, tempCoefPmax
 * @param {object} array - Array with count, parallelStrings
 * @param {object | null} controller - Optional; if set, includes maxV, maxIsc for reference lines
 * @param {number | null} effectiveStartupV - Optional; from getEffectiveStartupV(controller, systemVoltage)
 * @returns {{ temps: number[], vocSeries: number[] | null, iscSeries: number[] | null, pmaxSeries: number[] | null, controllerMaxV: number | null, effectiveStartupV: number | null, controllerMaxIsc: number | null }}
 */
export function computeTempSeries(panel, array, controller = null, effectiveStartupV = null) {
    const temps = buildTempRange();
    const pStrings = array.parallelStrings || 1;
    const panelsPerSeriesString = array.count / pStrings;

    let vocSeries = null;
    if (panel.tempCoefVoc != null && panel.voc != null) {
        const stringVocSTC = panel.voc * panelsPerSeriesString;
        vocSeries = temps.map((T) =>
            stringVocSTC * (1 + ((T - STC_TEMP_C) * panel.tempCoefVoc) / 100)
        );
    }

    let iscSeries = null;
    if (panel.tempCoefIsc != null && panel.isc != null) {
        iscSeries = temps.map((T) =>
            panel.isc * pStrings * (1 + ((T - STC_TEMP_C) * panel.tempCoefIsc) / 100)
        );
    }

    let pmaxSeries = null;
    if (panel.tempCoefPmax != null && panel.power != null) {
        pmaxSeries = temps.map((T) =>
            array.count * panel.power * (1 + ((T - STC_TEMP_C) * panel.tempCoefPmax) / 100)
        );
    }

    return {
        temps,
        vocSeries,
        iscSeries,
        pmaxSeries,
        controllerMaxV: controller?.maxV ?? null,
        effectiveStartupV: effectiveStartupV ?? null,
        controllerMaxIsc: controller?.maxIsc ?? null,
    };
}
