/**
 * @file controllerTypes.js
 * Groups and summarises PV controllers by device type so the Guide to Controllers can quote real
 * figures and examples from the database rather than hardcoded ones.
 *
 * The `type` field on each controller record is authoritative here - unlike panel cell
 * architecture, it is stated explicitly for every entry, so no inference is needed.
 */

/** Device type identifiers, matching the `type` field in the controller JSON. */
export const CONTROLLER_TYPE = {
    CHARGER: 'charger',
    HYBRID_INVERTER: 'hybrid_inverter',
    STRING_INVERTER: 'string_inverter',
    MICROINVERTER: 'microinverter',
    AC_COUPLED_INVERTER: 'ac_coupled_inverter',
    INVERTER_CHARGER: 'inverter_charger',
    DC_DC_CHARGER: 'dc-dc-charger',
};

/**
 * Display order for the guide: the two types most people choose between come first, then the
 * grid-only options, then the specialist cases.
 */
export const CONTROLLER_TYPE_ORDER = [
    CONTROLLER_TYPE.CHARGER,
    CONTROLLER_TYPE.HYBRID_INVERTER,
    CONTROLLER_TYPE.STRING_INVERTER,
    CONTROLLER_TYPE.MICROINVERTER,
    CONTROLLER_TYPE.AC_COUPLED_INVERTER,
    CONTROLLER_TYPE.INVERTER_CHARGER,
    CONTROLLER_TYPE.DC_DC_CHARGER,
];

/** Short human-readable names, matching how each type is described in the UI. */
export const CONTROLLER_TYPE_LABELS = {
    [CONTROLLER_TYPE.CHARGER]: 'MPPT charge controller',
    [CONTROLLER_TYPE.HYBRID_INVERTER]: 'Hybrid inverter',
    [CONTROLLER_TYPE.STRING_INVERTER]: 'String inverter',
    [CONTROLLER_TYPE.MICROINVERTER]: 'Microinverter',
    [CONTROLLER_TYPE.AC_COUPLED_INVERTER]: 'AC-coupled battery inverter',
    [CONTROLLER_TYPE.INVERTER_CHARGER]: 'Inverter / charger',
    [CONTROLLER_TYPE.DC_DC_CHARGER]: 'DC-to-DC charger',
};

/**
 * Whether panels connect to this unit directly. AC-coupled inverters and plain inverter/chargers
 * have no solar tracker at all, which the database records as a zero max PV voltage.
 *
 * @param {object} controller Controller record.
 * @returns {boolean}
 */
export function hasPvInput(controller) {
    return Number(controller?.maxV) > 0;
}

/**
 * Whether this unit charges a low-voltage battery bank rather than working at mains or string
 * voltage. Used to separate battery-centric devices from grid-tied ones.
 *
 * @param {object} controller Controller record.
 * @returns {boolean}
 */
export function isBatteryVoltageClass(controller) {
    const voltages = Array.isArray(controller?.systemVoltages) ? controller.systemVoltages : [];
    return voltages.some((v) => Number(v) <= 60);
}

/**
 * Range of the finite numbers produced by `pick`, or `null` when the group yields none.
 *
 * @param {object[]} items
 * @param {(item: object) => number | null | undefined} pick
 * @returns {{ min: number, max: number } | null}
 */
function rangeOf(items, pick) {
    const values = items.map(pick).filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Groups controllers by device type.
 *
 * @param {object[]} controllersData All controllers from the database.
 * @returns {Record<string, object[]>} Keyed by `type`.
 */
export function groupControllersByType(controllersData) {
    const groups = {};
    for (const controller of Array.isArray(controllersData) ? controllersData : []) {
        const type = controller?.type;
        if (!type) continue;
        (groups[type] ||= []).push(controller);
    }
    return groups;
}

/**
 * Summarises one group of controllers for display in the guide.
 *
 * @param {object[]} controllers Controllers sharing a device type.
 * @param {number} [exampleLimit=3] How many named examples to surface.
 * @returns {{
 *   count: number,
 *   maxV: { min: number, max: number } | null,
 *   trackers: { min: number, max: number } | null,
 *   batteryVoltages: number[],
 *   pvInputCount: number,
 *   examples: object[]
 * }}
 */
export function summariseControllerGroup(controllers, exampleLimit = 3) {
    const list = Array.isArray(controllers) ? controllers : [];

    // Collect the distinct low-voltage battery banks the group supports, ascending.
    const batteryVoltages = [
        ...new Set(
            list
                .flatMap((c) => (Array.isArray(c.systemVoltages) ? c.systemVoltages : []))
                .map(Number)
                .filter((v) => Number.isFinite(v) && v <= 60)
        ),
    ].sort((a, b) => a - b);

    return {
        count: list.length,
        maxV: rangeOf(list, (c) => c.maxV),
        trackers: rangeOf(list, (c) => c.trackers),
        batteryVoltages,
        pvInputCount: list.filter(hasPvInput).length,
        // Cheapest first: the guide is explaining categories, not recommending flagships.
        examples: [...list].sort((a, b) => (a.price || 0) - (b.price || 0)).slice(0, exampleLimit),
    };
}

/**
 * Counts controllers carrying each UK grid certification and backup capability, for the
 * grid-connection section of the guide.
 *
 * @param {object[]} controllersData All controllers from the database.
 * @returns {{ total: number, g98: number, g99: number, g100: number, eps: number, houseBackup: number, offGridNative: number, threePhase: number }}
 */
export function summariseGridCapabilities(controllersData) {
    const list = Array.isArray(controllersData) ? controllersData : [];
    return {
        total: list.length,
        g98: list.filter((c) => c.g98_cert === true).length,
        g99: list.filter((c) => c.g99_cert === true).length,
        g100: list.filter((c) => c.g100_cert === true).length,
        eps: list.filter((c) => c.eps === true).length,
        houseBackup: list.filter((c) => c.house_backup === true).length,
        offGridNative: list.filter((c) => c.pure_off_grid_native === true).length,
        threePhase: list.filter((c) => c.three_phase === true).length,
    };
}

/**
 * Finds controllers whose maximum array short-circuit current differs from the current their
 * tracker can actually use. The gap explains why the two ratings exist: a tracker tolerates a
 * larger fault current than it will operate at continuously.
 *
 * @param {object[]} controllersData All controllers from the database.
 * @param {number} [limit=3] How many examples to return.
 * @returns {object[]} Controllers with both figures present and differing, widest gap first.
 */
export function findCurrentHeadroomExamples(controllersData, limit = 3) {
    return (Array.isArray(controllersData) ? controllersData : [])
        .filter(
            (c) =>
                Number(c.maxIsc) > 0 &&
                Number(c.maxOperatingI) > 0 &&
                Number(c.maxIsc) !== Number(c.maxOperatingI)
        )
        .sort((a, b) => b.maxIsc - b.maxOperatingI - (a.maxIsc - a.maxOperatingI))
        .slice(0, limit);
}
