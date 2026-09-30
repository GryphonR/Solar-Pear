/** Returns the assigned controller model for an array, or null when not assigned. */
export function getAssignedControllerModel(array, arrayId, selections, siteControllers, chargersData) {
    if (!array || !arrayId) return null;
    const sel = selections[arrayId] || {};
    if (sel.controllerInstanceId) {
        const inst = siteControllers.find((sc) => sc.id === sel.controllerInstanceId);
        if (inst) return chargersData.find((c) => c.id === inst.modelId) || null;
    }
    if (sel.controller) {
        return chargersData.find((c) => c.id === sel.controller) || null;
    }
    return null;
}

/** £/kWp for a full layout (matches useValidPanels / analyzeArray: panelCost / (peakPower/1000)). */
export function panelLayoutCostPerKWp(panel, layoutCount) {
    if (!panel) return null;
    const n = Math.floor(Number(layoutCount)) || 0;
    const powerW = Number(panel.power) || 0;
    const peakPower = powerW * n;
    if (peakPower <= 0) return null;
    const cost = (Number(panel.price) || 0) * n;
    const v = cost / (peakPower / 1000);
    return Number.isFinite(v) ? v : null;
}
