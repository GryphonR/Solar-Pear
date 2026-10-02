/**
 * @file methodology.js
 * Plain-English description of every compatibility check, for the public methodology page (roadmap 6.5).
 *
 * Thresholds are read from the engine's constants rather than typed out, so the page cannot drift
 * from the maths. `methodology.test.js` fails if the engine emits a check code that is not listed here.
 */

import {
    COLD_TEMP_C,
    HOT_TEMP_C,
    STC_TEMP_C,
    VOC_WARN_FRACTION,
    DEFAULT_TEMP_COEF_VOC,
    DEFAULT_TEMP_COEF_PMAX,
    STRICT_CURRENT_FACTOR,
    CHARGE_VOLTAGE_FACTOR,
    CHARGER_OVERPANEL_TOLERANCE,
    ISC_OVER_RATING_SEVERITY,
} from './arrayAnalysis';

const pct = (fraction) => `${Math.round(fraction * 100)}%`;

/** Default design assumptions, each overridable per area unless noted. */
export const DESIGN_ASSUMPTIONS = [
    {
        name: 'Design low temperature',
        value: `${COLD_TEMP_C} °C`,
        detail:
            'The coldest cell temperature the array is expected to see in daylight. Panel voltage rises as it gets colder, so this sets the worst-case open-circuit voltage. Change it per area on the Controller Selector tab if your site gets colder.',
    },
    {
        name: 'Design high temperature',
        value: `${HOT_TEMP_C} °C (cell)`,
        detail:
            'The hottest cell temperature on a sunny summer afternoon. Panel voltage falls as it heats up, so this sets the worst-case operating voltage for startup and MPPT checks.',
    },
    {
        name: 'Datasheet reference',
        value: `${STC_TEMP_C} °C`,
        detail: 'Datasheet figures are quoted at Standard Test Conditions. Every correction is made from this temperature.',
    },
    {
        name: 'Temperature model',
        value: 'Linear',
        detail:
            'Voltages and currents are corrected with the panel’s own temperature coefficients. Operating voltage uses the Vmp coefficient where the datasheet gives one, otherwise the Pmax coefficient, which is the more conservative choice when hot.',
    },
    {
        name: 'Fallback coefficients',
        value: `Voc ${DEFAULT_TEMP_COEF_VOC} %/°C, Pmax ${DEFAULT_TEMP_COEF_PMAX} %/°C`,
        detail:
            'Used only for panels you add yourself without coefficients. They are at the pessimistic end of the typical range. Every catalogue panel has published coefficients: products without them are not listed.',
    },
    {
        name: 'Strict current mode',
        value: `Off (× ${STRICT_CURRENT_FACTOR} when on)`,
        detail:
            'Optional. Multiplies short-circuit current by the irradiance factor used in NEC 690.8 and IEC 62548, to allow for edge-of-cloud and reflected light.',
    },
    {
        name: 'Charging voltage',
        value: `${CHARGE_VOLTAGE_FACTOR} × nominal battery voltage`,
        detail:
            'Used to turn a battery charger’s charge-current rating into watts (a 30 A charger on a 12 V battery gives about 432 W). Where you have not chosen a battery voltage, the lowest voltage the charger supports is assumed and the message says so.',
    },
];

/**
 * Every check the engine runs. `codes` lists the engine issue codes the row covers.
 * Severity describes what the check produces in the app: error blocks a combination, a warning
 * flags it, info is shown but never changes the status.
 */
export const CHECKS = [
    {
        group: 'Voltage',
        name: 'Controller maximum voltage',
        codes: ['voc'],
        severity: 'error',
        rule: `String open-circuit voltage at the design low temperature must not exceed the controller’s maximum PV input voltage. Over-voltage can destroy the controller, so this is the one check that can never be overridden.`,
    },
    {
        group: 'Voltage',
        name: 'Voltage headroom',
        codes: ['vocMargin'],
        severity: 'warning',
        rule: `Cold open-circuit voltage above ${pct(VOC_WARN_FRACTION)} of the controller maximum is flagged: it passes, but with little margin for a colder-than-expected morning.`,
    },
    {
        group: 'Voltage',
        name: 'Panel system voltage',
        codes: ['panelSystemVoltage'],
        severity: 'error',
        rule: 'Cold string voltage must not exceed the panel’s own maximum system voltage (usually 1000 V or 1500 V).',
    },
    {
        group: 'Voltage',
        name: 'Startup (open-circuit)',
        codes: ['vocStartup'],
        severity: 'error',
        rule: `Before a controller starts, no current flows, so the string sits at its open-circuit voltage. If the datasheet Voc of the string (at ${STC_TEMP_C} °C) is below the controller’s startup voltage, the controller never starts and the array produces nothing. ${STC_TEMP_C} °C is used because controllers start at dawn, when cells are cool. For battery chargers that need the PV voltage to exceed the battery voltage, the battery voltage is added.`,
    },
    {
        group: 'Voltage',
        name: 'Startup voltage',
        codes: ['vmpStartup'],
        severity: 'warning',
        rule: 'String operating voltage at the design high temperature should reach the controller’s startup voltage. For battery chargers that need the PV voltage to exceed the battery voltage, the battery voltage is added.',
    },
    {
        group: 'Voltage',
        name: 'MPPT window',
        codes: ['mpptMin', 'mpptMax'],
        severity: 'warning',
        rule: 'Hot operating voltage below the MPPT range minimum, or cold operating voltage above its maximum, means the tracker cannot hold the maximum power point and output drops. Skipped for chargers whose window is set by the battery voltage.',
    },
    {
        group: 'Current',
        name: 'Short-circuit current rating',
        codes: ['iscRating'],
        severity: ISC_OVER_RATING_SEVERITY,
        rule: `Array short-circuit current at the design high temperature (× ${STRICT_CURRENT_FACTOR} in strict mode) must not exceed the controller’s maximum PV short-circuit current for the input the array is on (where a datasheet gives different limits per input, each input is checked against its own). Manufacturers treat this as a hardware limit. Where a datasheet states the input limits its own current, it is a warning instead.`,
    },
    {
        group: 'Current',
        name: 'Current clipping',
        codes: ['currentClip'],
        severity: 'warning',
        rule: 'Operating current above the controller’s maximum input current is not dangerous, but the controller will cap it and you lose some power at peak.',
    },
    {
        group: 'Current',
        name: 'String fusing',
        codes: ['stringFuses'],
        severity: 'info',
        rule: 'With three or more strings in parallel, a faulty string can be back-fed by the others. The app notes that string fuses are needed, and warns when no standard fuse fits between 1.5 × Isc and the panel’s maximum series fuse rating.',
    },
    {
        group: 'Power',
        name: 'Charger output',
        codes: ['chargerPower'],
        severity: 'info',
        rule: `For battery chargers, total array power on the controller is compared with charge current × battery voltage × ${CHARGE_VOLTAGE_FACTOR}. Up to ${pct(CHARGER_OVERPANEL_TOLERANCE)} of that limit is normal overpanelling and shown as info; beyond it the lost power is flagged as a warning.`,
    },
    {
        group: 'Power',
        name: 'Inverter DC power',
        codes: ['dcPower'],
        severity: 'warning',
        rule: 'Total array power on an inverter is compared with its maximum DC input power.',
    },
    {
        group: 'Power',
        name: 'Microinverter limits',
        codes: ['microModulePower', 'microAcClip'],
        severity: 'warning',
        rule: 'Each panel is checked against its microinverter: panel power above the recommended module power is a warning, and power above the continuous AC output is noted as clipping (info).',
    },
    {
        group: 'Setup',
        name: 'Wiring',
        codes: ['wiring'],
        severity: 'error',
        rule: 'The panel count must divide evenly into the chosen number of parallel strings, so every string has the same length.',
    },
    {
        group: 'Setup',
        name: 'Controller has a PV input',
        codes: ['noPvInput'],
        severity: 'error',
        rule: 'AC-coupled units and similar devices with no PV input cannot take panels directly.',
    },
    {
        group: 'Physical fit',
        name: 'In-roof format, size and weight',
        codes: ['format', 'size', 'weight'],
        severity: 'error',
        rule: 'For in-roof mounting the panel must fit the GSE tray in the chosen orientation. Panels larger or heavier than the limits you set for the array are excluded. A panel with no published weight fails a weight limit rather than passing it.',
    },
];

export const SEVERITY_LABELS = Object.freeze({
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
});

/** All engine codes the page documents. */
export const DOCUMENTED_CODES = new Set(CHECKS.flatMap((c) => c.codes));
