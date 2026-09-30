/**
 * @file controllerFilter.js
 * Which catalogue controllers a system's settings allow (battery voltage, "Controllers shown", EPS and
 * whole-house backup). This is a listing filter, not a compatibility check; the checks stay in
 * `evaluateElectrical`. Shared by the classic controller table and the new controller picker (13.6).
 */

/**
 * @param {object} c - catalogue controller
 * @param {{ systemVoltage?: number|null, systemType?: string, filterEps?: boolean, filterHouseBackup?: boolean }} settings
 */
export function controllerMatchesSystem(c, settings) {
    const volts = c.systemVoltages || [48];
    if (settings.systemVoltage !== null && settings.systemVoltage !== undefined && !volts.includes(settings.systemVoltage)) {
        return false;
    }
    if (!settings.systemType || settings.systemType === 'any') return true;
    if (settings.systemType === 'dc-charger') return c.systemType === 'dc-charger';
    if (settings.systemType === 'grid-connected') {
        if (!(c.g98_cert || c.g99_cert)) return false;
        if (settings.filterEps && !c.eps) return false;
        if (settings.filterHouseBackup && !c.house_backup) return false;
        return true;
    }
    if (settings.systemType === 'off-grid-ac') return !!c.pure_off_grid_native;
    return true;
}
