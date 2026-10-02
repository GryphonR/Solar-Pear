/**
 * @file issueAdvice.js
 * Titles, fixes and cited datasheet fields for each engine issue code (roadmap 13.7, 7.5). The "why"
 * is the engine's own message, which states the figures and the temperature used; this file only adds
 * a heading, a suggested fix and the inputs behind the figures. No checks live here.
 *
 * `issueAdvice.test.js` fails if the engine documents a code (methodology.js) that has no advice.
 */

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Datasheet fields as `[label, value]`, left out when the record doesn't have them. */
const fields = (...pairs) => (panel, controller) =>
    pairs
        .map(([label, source, key, unit]) => {
            const record = source === 'panel' ? panel : controller;
            const value = num(record?.[key]);
            return value == null ? null : `${label} ${value}${unit ? ` ${unit}` : ''}`;
        })
        .filter(Boolean);

const VOC = ['voc', 'panel', 'voc', 'V'];
const VOC_COEF = ['tempCoefVoc', 'panel', 'tempCoefVoc', '%/°C'];
const VMP = ['vmp', 'panel', 'vmp', 'V'];
const VMP_COEF = ['tempCoefVmp', 'panel', 'tempCoefVmp', '%/°C'];
const PMAX_COEF = ['tempCoefPmax', 'panel', 'tempCoefPmax', '%/°C'];
const ISC = ['isc', 'panel', 'isc', 'A'];

export const ISSUE_ADVICE = Object.freeze({
    voc: {
        title: 'Cold Voc is above the controller maximum',
        fix: 'Use fewer panels in series (more parallel strings), or a controller with a higher maximum PV voltage.',
        fields: fields(VOC, VOC_COEF, ['maxV', 'controller', 'maxV', 'V']),
    },
    vocMargin: {
        title: 'Cold Voc is close to the controller maximum',
        fix: 'Take one panel out of each string, or choose a controller with more voltage headroom. Check the design low temperature suits your site.',
        fields: fields(VOC, VOC_COEF, ['maxV', 'controller', 'maxV', 'V']),
    },
    panelSystemVoltage: {
        title: "Cold Voc is above the panel's system voltage",
        fix: 'Use shorter strings: fewer panels in series.',
        fields: fields(VOC, VOC_COEF, ['maxSystemVoltage', 'panel', 'maxSystemVoltage', 'V']),
    },
    vocStartup: {
        title: 'Voc is below the startup voltage',
        fix: 'Put more panels in series (fewer parallel strings), choose a controller with a lower startup voltage, or for a battery charger use a lower battery voltage. On a microinverter, choose a panel with a higher Voc or a different micro.',
        fields: fields(VOC, ['startupV', 'controller', 'startupV', 'V']),
    },
    vmpStartup: {
        title: 'Hot Vmp is below the startup voltage',
        fix: 'Put more panels in series (fewer parallel strings), or choose a controller with a lower startup voltage.',
        fields: fields(VMP, VMP_COEF, PMAX_COEF, ['startupV', 'controller', 'startupV', 'V']),
    },
    mpptMin: {
        title: 'Hot Vmp falls below the MPPT window',
        fix: 'Put more panels in series, or choose a controller with a lower MPPT minimum.',
        fields: fields(VMP, VMP_COEF, PMAX_COEF, ['mpptRangeMin', 'controller', 'mpptRangeMin', 'V']),
    },
    mpptMax: {
        title: 'Cold Vmp rises above the MPPT window',
        fix: 'Use fewer panels in series, or a controller with a wider MPPT range.',
        fields: fields(VMP, VMP_COEF, PMAX_COEF, ['mpptRangeMax', 'controller', 'mpptRangeMax', 'V']),
    },
    iscRating: {
        title: 'Short-circuit current is above the controller rating',
        fix: 'Use fewer parallel strings, or a controller with a higher PV short-circuit rating.',
        fields: fields(ISC, ['tempCoefIsc', 'panel', 'tempCoefIsc', '%/°C'], ['maxIsc', 'controller', 'maxIsc', 'A']),
    },
    currentClip: {
        title: 'Operating current will be clipped',
        fix: 'Accept the clipping, use fewer parallel strings, or choose a controller with a higher input current.',
        fields: fields(['imp', 'panel', 'imp', 'A'], ['maxOperatingI', 'controller', 'maxOperatingI', 'A'], ['maxIsc', 'controller', 'maxIsc', 'A']),
    },
    stringFuses: {
        title: 'Parallel strings need fuses',
        fix: 'Fit a gPV fuse on each string, in the range the message gives, or use fewer parallel strings.',
        fields: fields(ISC, ['maxSeriesFuse', 'panel', 'maxSeriesFuse', 'A']),
    },
    chargerPower: {
        title: 'More panel power than the charger can deliver',
        fix: 'Choose a larger charger, a higher battery voltage, or fewer panels. Mild overpanelling is often worthwhile.',
        fields: fields(['maxChargeCurrent', 'controller', 'maxChargeCurrent', 'A']),
    },
    dcPower: {
        title: 'More panel power than the inverter accepts',
        fix: 'Move an array to another controller, choose an inverter with a higher DC input, or use fewer panels.',
        fields: fields(['MaxDCPower', 'controller', 'MaxDCPower', 'W']),
    },
    microModulePower: {
        title: 'Panel is above the micro’s module rating',
        fix: "Choose a microinverter rated for this panel's power, or a smaller panel.",
        fields: fields(['power', 'panel', 'power', 'W'], ['MaxDCPower', 'controller', 'MaxDCPower', 'W']),
    },
    microAcClip: {
        title: 'Micros will clip slightly at midday',
        fix: 'Nothing to do: this is normal. A larger micro avoids it.',
        fields: fields(['power', 'panel', 'power', 'W'], ['MaxACPower', 'controller', 'MaxACPower', 'VA']),
    },
    wiring: {
        title: "The panel count doesn't divide into the strings",
        fix: 'Change the panel count or the number of parallel strings so every string is the same length.',
        fields: () => [],
    },
    noPvInput: {
        title: 'This unit has no PV input',
        fix: "Choose a PV charger or inverter. AC-coupled units can't take panels directly.",
        fields: fields(['maxV', 'controller', 'maxV', 'V']),
    },
    format: {
        title: "Panel doesn't fit the in-roof tray",
        fix: "Choose a panel made for the tray in this orientation, or change the array's mounting.",
        fields: () => [],
    },
    size: {
        title: "Panel is bigger than the array's limit",
        fix: "Choose a smaller panel, or change the array's size limit.",
        fields: fields(['height', 'panel', 'height', 'mm'], ['width', 'panel', 'width', 'mm']),
    },
    weight: {
        title: "Panel is heavier than the array's limit",
        fix: "Choose a lighter panel, or change the array's weight limit.",
        fields: fields(['weight', 'panel', 'weight', 'kg']),
    },
});

/** The engine's message without its legacy "FATAL:" prefix (the status already says it's an error). */
export function cleanMessage(message) {
    return String(message || '').replace(/^FATAL:\s*/, '');
}

/**
 * Advice for one engine issue.
 * @returns {{ title: string, why: string, fix: string, fields: string[] }}
 */
export function adviceFor(issue, panel, controller) {
    const advice = ISSUE_ADVICE[issue.code];
    return {
        title: advice?.title || 'Check result',
        why: cleanMessage(issue.message),
        fix: advice?.fix || 'See How we check for what this means.',
        fields: advice ? advice.fields(panel, controller) : [],
    };
}
