import { GSE_COMPATIBILITY, getPanelGseCompatibility } from './gseCompatibility';
import { hasKnownPrice, knownPrice } from './pricing';

/** Default worst-case cold cell temperature (°C) for the Voc headroom check. Overridable per area. */
export const COLD_TEMP_C = -10;
/** Default worst-case hot cell temperature (°C) for the Vmp startup and current checks. Overridable per area. */
export const HOT_TEMP_C = 65;
/** Datasheet reference temperature (°C) that panel specs are quoted at. */
export const STC_TEMP_C = 25;
/**
 * Fraction of the controller's max PV voltage above which cold Voc is flagged as a warning
 * rather than passing silently, i.e. the margin is real but uncomfortably tight.
 */
export const VOC_WARN_FRACTION = 0.94;
/**
 * Conservative Voc temperature coefficient (%/°C) assumed when a panel has none. Typical
 * crystalline modules sit between -0.24 and -0.30, so this over- rather than under-estimates cold Voc.
 */
export const DEFAULT_TEMP_COEF_VOC = -0.3;
/** Pmax temperature coefficient (%/°C) assumed when a panel has none. */
export const DEFAULT_TEMP_COEF_PMAX = -0.35;
/**
 * Irradiance safety factor on short-circuit current (NEC 690.8 / IEC 62548 practice): edge-of-cloud
 * and reflected light can push Isc about 25% above its STC value. Applied in strict-current mode.
 */
export const STRICT_CURRENT_FACTOR = 1.25;
/** Charging voltage as a multiple of nominal battery voltage (e.g. 14.4 V for 12 V lead/LiFePO4). */
export const CHARGE_VOLTAGE_FACTOR = 1.2;
/**
 * Array power up to this multiple of a battery charger's output limit is reported as normal
 * overpanelling (info). Above it, the clipping is flagged as a warning.
 */
export const CHARGER_OVERPANEL_TOLERANCE = 1.3;
/**
 * Severity when array Isc exceeds the controller's max PV short-circuit rating. Manufacturers such as
 * Victron treat this as a hardware limit (roadmap decision D1). Controllers whose datasheet states the
 * input self-limits can set `iscSelfLimiting: true` to downgrade it to a warning.
 */
export const ISC_OVER_RATING_SEVERITY = 'error';

export const DEFAULT_DESIGN_CONDITIONS = Object.freeze({
    coldTempC: COLD_TEMP_C,
    hotTempC: HOT_TEMP_C,
    strictCurrent: false,
});

/**
 * Normalises design conditions (e.g. from area settings) with defaults for missing values.
 * @param {{ coldTempC?: number, hotTempC?: number, strictCurrent?: boolean } | null | undefined} input
 */
export function resolveDesignConditions(input) {
    const cold = Number(input?.coldTempC);
    const hot = Number(input?.hotTempC);
    return {
        coldTempC: input?.coldTempC != null && Number.isFinite(cold) ? cold : COLD_TEMP_C,
        hotTempC: input?.hotTempC != null && Number.isFinite(hot) ? hot : HOT_TEMP_C,
        strictCurrent: !!input?.strictCurrent,
    };
}

/** Design conditions from an area's settings (designLowC / designHighC / strictCurrent). */
export function conditionsFromAreaSettings(areaSettings) {
    return resolveDesignConditions({
        coldTempC: areaSettings?.designLowC,
        hotTempC: areaSettings?.designHighC,
        strictCurrent: areaSettings?.strictCurrent,
    });
}

const linearFactor = (coefPctPerC, tempC) => 1 + ((tempC - STC_TEMP_C) * coefPctPerC) / 100;

const hasCoef = (v) => v != null && v !== '' && Number.isFinite(Number(v));

export function coldVocFactor(panel, coldTempC = COLD_TEMP_C) {
    const coef = hasCoef(panel.tempCoefVoc) ? Number(panel.tempCoefVoc) : DEFAULT_TEMP_COEF_VOC;
    return linearFactor(coef, coldTempC);
}

/**
 * Vmp temperature coefficient (%/°C). Prefers tempCoefVmp; otherwise uses tempCoefPmax as a proxy.
 * Pmax = Vmp × Imp and the Imp coefficient is small and positive, so the Vmp coefficient is close
 * to (slightly more negative than) the Pmax coefficient.
 */
function vmpCoef(panel) {
    if (hasCoef(panel.tempCoefVmp)) return Number(panel.tempCoefVmp);
    if (hasCoef(panel.tempCoefPmax)) return Number(panel.tempCoefPmax);
    return DEFAULT_TEMP_COEF_PMAX;
}

/** Hot-day Vmp derate factor. */
export function hotVmpFactor(panel, hotTempC = HOT_TEMP_C) {
    return linearFactor(vmpCoef(panel), hotTempC);
}

/** Cold-day Vmp rise factor, used for the MPPT upper-window check. */
export function coldVmpFactor(panel, coldTempC = COLD_TEMP_C) {
    return linearFactor(vmpCoef(panel), coldTempC);
}

export function hotIscFactor(panel, hotTempC = HOT_TEMP_C) {
    if (!hasCoef(panel.tempCoefIsc)) return 1;
    return linearFactor(Number(panel.tempCoefIsc), hotTempC);
}

/**
 * Effective minimum PV voltage to start the MPPT.
 * When v_start_vbat_dependent is true, startup is relative to battery: Vbat + controller.startupV.
 * Uses user-selected systemVoltage when set; otherwise falls back to controller.vNominal or first systemVoltages entry.
 * Only the explicit flag is used (no startupV heuristic).
 * @param {object} controller - Charger/controller with startupV and optional v_start_vbat_dependent, vNominal, systemVoltages
 * @param {number | null} systemVoltage - User-selected DC battery voltage (e.g. 12, 24, 48)
 */
export function getEffectiveStartupV(controller, systemVoltage) {
    if (!controller) return 0;
    const base = controller.startupV ?? 0;
    if (controller.v_start_vbat_dependent === true) {
        const vbat =
            systemVoltage != null
                ? systemVoltage
                : (controller.vNominal ?? controller.systemVoltages?.[0] ?? null);
        if (vbat != null) return vbat + base;
    }
    return base;
}

/**
 * Whether parallelStrings evenly divides panel count (valid string wiring).
 */
export function isValidWiring(count, parallelStrings) {
    const c = Math.floor(Number(count));
    const p = Math.floor(Number(parallelStrings)) || 1;
    return Number.isFinite(c) && c > 0 && p > 0 && c % p === 0;
}

/**
 * Current clip limit per tracker: maxOperatingI (PV input operating current) when positive,
 * else maxIsc when positive, else unknown (Infinity). Above this the MPPT caps current
 * (harvest loss). maxOperatingI is never the battery charge current (see maxChargeCurrent).
 */
export function getCurrentClipLimit(controller) {
    if (!controller) return Infinity;
    const opI = Number(controller.maxOperatingI);
    if (opI > 0 && Number.isFinite(opI)) return opI;
    const isc = Number(controller.maxIsc);
    if (isc > 0 && Number.isFinite(isc)) return isc;
    return Infinity;
}

export const isMicroinverter = (controller) => controller?.type === 'microinverter';

/** Panels served by one microinverter unit (1 unless the model declares panelsPerUnit). */
export function panelsPerMicroUnit(controller) {
    const n = Math.floor(Number(controller?.panelsPerUnit));
    return n > 0 ? n : 1;
}

/** Number of physical controller units an array needs (microinverters: one per panelsPerUnit panels). */
export function controllerUnitsForArray(controller, count) {
    if (!controller) return 0;
    if (!isMicroinverter(controller)) return 1;
    const c = Math.max(0, Math.floor(Number(count)) || 0);
    return Math.ceil(c / panelsPerMicroUnit(controller));
}

const fmt = (n, dp = 1) => Number(n).toFixed(dp);

/**
 * Single source of truth for string/array electrical metrics and controller compatibility.
 *
 * @param {object} panel
 * @param {object | null} controller
 * @param {{ count: number, parallelStrings?: number, systemVoltage?: number | null,
 *           conditions?: { coldTempC?: number, hotTempC?: number, strictCurrent?: boolean } }} opts
 * @returns {{
 *   wiringValid: boolean, seriesLength: number, stringsPerInput: number, isMicro: boolean,
 *   coldVoc: number, coldVmp: number, hotVmp: number, arrayIscHot: number, arrayImpHot: number,
 *   iscForLimit: number, effectiveStartupV: number | null, currentClipLimit: number | null,
 *   flags: Record<string, boolean>, issues: Array<{ code: string, severity: 'error'|'warning'|'info', message: string }>,
 *   hardOk: boolean,
 * }}
 */
export function evaluateElectrical(panel, controller, opts = {}) {
    const { count, parallelStrings, systemVoltage = null } = opts;
    const cond = resolveDesignConditions(opts.conditions);
    const { coldTempC, hotTempC, strictCurrent } = cond;
    const isMicro = isMicroinverter(controller);
    const c = Math.floor(Number(count)) || 0;
    const pRaw = Math.floor(Number(parallelStrings)) || 1;

    // Microinverters: every panel has its own input, so checks are per single panel.
    const wiringValid = isMicro ? c > 0 : isValidWiring(c, pRaw);
    const seriesLength = !wiringValid ? 0 : isMicro ? 1 : c / pRaw;
    const stringsPerInput = isMicro ? 1 : pRaw;

    const coldVoc = panel.voc * seriesLength * coldVocFactor(panel, coldTempC);
    const coldVmp = panel.vmp * seriesLength * coldVmpFactor(panel, coldTempC);
    const hotVmp = panel.vmp * seriesLength * hotVmpFactor(panel, hotTempC);
    const iscFactor = hotIscFactor(panel, hotTempC);
    const arrayIscHot = wiringValid ? panel.isc * stringsPerInput * iscFactor : 0;
    const imp = Number(panel.imp) > 0 ? Number(panel.imp) : panel.isc;
    const arrayImpHot = wiringValid ? imp * stringsPerInput * iscFactor : 0;
    const iscForLimit = arrayIscHot * (strictCurrent ? STRICT_CURRENT_FACTOR : 1);

    const issues = [];
    const add = (code, severity, message) => issues.push({ code, severity, message });
    const flags = {
        isVocOk: true,
        isVocWarn: false,
        isVmpOk: true,
        isBelowMpptMin: false,
        isAboveMpptMax: false,
        isIscOverRating: false,
        isCurrentClipping: false,
        isPanelSystemVoltageOk: true,
        needsStringFuses: false,
        isMicroModuleOverpowered: false,
        isMicroAcClipping: false,
    };

    if (!wiringValid) {
        add(
            'wiring',
            'error',
            `FATAL: Invalid wiring - panel count (${count}) is not divisible by parallel strings (${pRaw}).`
        );
    }

    // Panel-side limits (independent of controller).
    const panelMaxSysV = Number(panel.maxSystemVoltage);
    if (wiringValid && panelMaxSysV > 0 && coldVoc > panelMaxSysV) {
        flags.isPanelSystemVoltageOk = false;
        add(
            'panelSystemVoltage',
            'error',
            `FATAL: Cold Voc (${fmt(coldVoc)}V at ${coldTempC}°C) exceeds the panel's maximum system voltage (${panelMaxSysV}V). Use shorter strings.`
        );
    }

    const maxFuse = Number(panel.maxSeriesFuse);
    if (wiringValid && !isMicro && stringsPerInput >= 3 && maxFuse > 0) {
        // IEC 62548: fuses needed when (Np - 1) × 1.25 × Isc can exceed the module's reverse-current rating.
        const reverseCurrent = (stringsPerInput - 1) * 1.25 * panel.isc;
        if (reverseCurrent > maxFuse) {
            flags.needsStringFuses = true;
            const minFuse = Math.ceil(1.5 * panel.isc);
            if (minFuse > maxFuse) {
                add(
                    'stringFuses',
                    'warning',
                    `${stringsPerInput} strings in parallel need string fuses, but a fuse of at least ${minFuse}A (1.5 × Isc) is above the panel's ${maxFuse}A series fuse rating. Use fewer parallel strings or a combiner per pair of strings.`
                );
            } else {
                add(
                    'stringFuses',
                    'info',
                    `${stringsPerInput} strings in parallel: fit a gPV fuse on each string, rated between ${minFuse}A and ${maxFuse}A.`
                );
            }
        }
    }

    let effectiveStartupV = null;
    let currentClipLimit = null;

    if (controller && wiringValid) {
        const maxV = Number(controller.maxV);
        if (!(maxV > 0)) {
            flags.isVocOk = false;
            add('noPvInput', 'error', `FATAL: ${controller.name || 'This unit'} has no PV input. Choose a PV controller or inverter.`);
        } else if (coldVoc > maxV) {
            flags.isVocOk = false;
            add(
                'voc',
                'error',
                `FATAL: Cold Voc (${fmt(coldVoc)}V at ${coldTempC}°C) exceeds PV controller limit (${maxV}V). Will destroy hardware.`
            );
        } else if (coldVoc > maxV * VOC_WARN_FRACTION) {
            flags.isVocWarn = true;
            add(
                'vocMargin',
                'warning',
                `Cold Voc (${fmt(coldVoc)}V at ${coldTempC}°C) is dangerously close to PV controller limit (${maxV}V). Margin is too tight.`
            );
        }

        effectiveStartupV = getEffectiveStartupV(controller, systemVoltage);
        if (hotVmp < effectiveStartupV) {
            flags.isVmpOk = false;
            add(
                'vmpStartup',
                'warning',
                `Hot Vmp (${fmt(hotVmp)}V at ${hotTempC}°C) is below the controller startup threshold (${effectiveStartupV}V). The MPPT will not start during peak heat, causing temporary harvest loss — it is not a hardware risk.`
            );
        }

        const mpptMin = Number(controller.mpptRangeMin);
        if (
            flags.isVmpOk &&
            controller.v_start_vbat_dependent !== true &&
            mpptMin > 0 &&
            hotVmp < mpptMin
        ) {
            flags.isBelowMpptMin = true;
            add(
                'mpptMin',
                'warning',
                `Hot Vmp (${fmt(hotVmp)}V at ${hotTempC}°C) is below the MPPT operating range (${mpptMin}V minimum). The tracker cannot hold the maximum power point in hot weather, so output drops.`
            );
        }
        const mpptMax = Number(controller.mpptRangeMax);
        if (flags.isVocOk && mpptMax > 0 && coldVmp > mpptMax) {
            flags.isAboveMpptMax = true;
            add(
                'mpptMax',
                'warning',
                `Cold Vmp (${fmt(coldVmp)}V at ${coldTempC}°C) is above the MPPT operating range (${mpptMax}V maximum). On cold, bright days the tracker will operate off the maximum power point and lose output.`
            );
        }

        const maxIsc = Number(controller.maxIsc);
        const strictNote = strictCurrent ? ` including the ${STRICT_CURRENT_FACTOR}× irradiance factor` : '';
        if (maxIsc > 0 && iscForLimit > maxIsc) {
            flags.isIscOverRating = true;
            const selfLimiting = controller.iscSelfLimiting === true;
            add(
                'iscRating',
                selfLimiting ? 'warning' : ISC_OVER_RATING_SEVERITY,
                selfLimiting
                    ? `Array Isc at ${hotTempC}°C${strictNote} (${fmt(iscForLimit, 2)}A) exceeds the controller current rating (${maxIsc}A maximum PV short-circuit current). This input self-limits, so the excess is clipped rather than harmful.`
                    : `FATAL: Array Isc at ${hotTempC}°C${strictNote} (${fmt(iscForLimit, 2)}A) exceeds the controller current rating (${maxIsc}A maximum PV short-circuit current). This can damage the controller: use fewer parallel strings or a controller with a higher PV current rating.`
            );
        }
        currentClipLimit = getCurrentClipLimit(controller);
        if (Number.isFinite(currentClipLimit) && arrayImpHot > currentClipLimit) {
            flags.isCurrentClipping = true;
            if (!flags.isIscOverRating) {
                add(
                    'currentClip',
                    'warning',
                    `Array operating current at ${hotTempC}°C (${fmt(arrayImpHot, 2)}A) exceeds the controller current rating (${currentClipLimit}A). The MPPT will cap current, so you pay for panel capacity the tracker will not convert.`
                );
            }
        }

        if (isMicro) {
            const dcMax = Number(controller.MaxDCPower);
            const acMax = Number(controller.MaxACPower);
            if (dcMax > 0 && panel.power > dcMax) {
                flags.isMicroModuleOverpowered = true;
                add(
                    'microModulePower',
                    'warning',
                    `The ${panel.power}W panel is above the ${controller.name}'s recommended maximum module power (${dcMax}W).`
                );
            } else if (acMax > 0 && panel.power > acMax) {
                flags.isMicroAcClipping = true;
                add(
                    'microAcClip',
                    'info',
                    `Each microinverter outputs at most ${acMax}VA, so a ${panel.power}W panel will clip slightly around midday in strong sun. This is normal for modern micros.`
                );
            }
        }
    }

    const hardOk = !issues.some((i) => i.severity === 'error');
    return {
        wiringValid,
        seriesLength,
        stringsPerInput,
        isMicro,
        coldVoc,
        coldVmp,
        hotVmp,
        arrayIscHot,
        arrayImpHot,
        iscForLimit,
        effectiveStartupV,
        currentClipLimit,
        conditions: cond,
        flags,
        issues,
        hardOk,
    };
}

/**
 * Controller-level power check across every array assigned to one controller instance.
 * Battery chargers: limit = charge current × charging voltage; mild overpanelling is normal (info).
 * Inverters: limit = manufacturer max PV (DC) power; exceeding it is a warning.
 * Microinverters are checked per panel in evaluateElectrical instead.
 *
 * @param {object | null} controller
 * @param {number} totalWp - Sum of STC watts of all arrays on the controller instance
 * @param {{ systemVoltage?: number | null, arrayCount?: number }} [opts]
 * @returns {{ limitW: number, ratio: number, basis: 'charge'|'dc'|null, batteryV: number | null,
 *            issue: { code: string, severity: 'info'|'warning', message: string } | null }}
 */
export function evaluateControllerPower(controller, totalWp, opts = {}) {
    const none = { limitW: 0, ratio: 0, basis: null, batteryV: null, issue: null };
    if (!controller || isMicroinverter(controller) || !(totalWp > 0)) return none;
    const arrays = opts.arrayCount > 1 ? `The ${opts.arrayCount} arrays on this controller total` : 'This array totals';

    const chargeI = Number(controller.maxChargeCurrent);
    if (chargeI > 0) {
        const volts = (controller.systemVoltages || []).filter((v) => Number(v) > 0);
        const batteryV = opts.systemVoltage != null ? Number(opts.systemVoltage) : volts.length ? Math.min(...volts) : null;
        if (!(batteryV > 0)) return none;
        const limitW = Math.round(chargeI * batteryV * CHARGE_VOLTAGE_FACTOR);
        const ratio = totalWp / limitW;
        if (ratio <= 1) return { limitW, ratio, basis: 'charge', batteryV, issue: null };
        const clippedPct = Math.round((1 - limitW / totalWp) * 100);
        const assumed = opts.systemVoltage == null ? ` (assuming a ${batteryV}V battery)` : '';
        const base = `${arrays} ${Math.round(totalWp)}W, but at ${batteryV}V${assumed} the ${chargeI}A charger can deliver only about ${limitW}W.`;
        const issue =
            ratio <= CHARGER_OVERPANEL_TOLERANCE
                ? {
                      code: 'chargerPower',
                      severity: 'info',
                      message: `${base} Up to ${clippedPct}% of peak output will be clipped in full sun. Mild overpanelling like this is common and often worthwhile.`,
                  }
                : {
                      code: 'chargerPower',
                      severity: 'warning',
                      message: `${base} About ${clippedPct}% of peak output will be clipped. Consider a larger charger, a higher battery voltage, or fewer panels.`,
                  };
        return { limitW, ratio, basis: 'charge', batteryV, issue };
    }

    const dcMax = Number(controller.MaxDCPower);
    if (dcMax > 0) {
        const ratio = totalWp / dcMax;
        const issue =
            ratio > 1
                ? {
                      code: 'dcPower',
                      severity: 'warning',
                      message: `${arrays} ${Math.round(totalWp)}W, above the ${controller.name}'s maximum PV input power (${dcMax}W).`,
                  }
                : null;
        return { limitW: dcMax, ratio, basis: 'dc', batteryV: null, issue };
    }
    return none;
}

/**
 * Whether the array wiring stays within hard electrical limits (anything that can damage
 * hardware): controller max PV voltage, max PV short-circuit current, and panel max system
 * voltage. Vmp/MPPT window, clipping and power are operational concerns reported as warnings.
 */
export function panelPassesControllerLimits(array, panel, controller, systemVoltage, conditions) {
    if (!controller || !array || !panel) return true;
    const result = evaluateElectrical(panel, controller, {
        count: array.count,
        parallelStrings: array.parallelStrings || 1,
        systemVoltage,
        conditions,
    });
    return result.hardOk;
}

/** Positive divisors of n (valid `parallelStrings` values for that panel count). */
export function divisorsOf(n) {
    const k = Math.floor(Number(n));
    if (!Number.isFinite(k) || k <= 0) return [];
    const out = [];
    for (let d = 1; d <= k; d++) {
        if (k % d === 0) out.push(d);
    }
    return out;
}

/**
 * Clamp parallelStrings to a valid divisor of count.
 * Keeps current if still valid; otherwise picks the largest divisor <= current, else 1.
 */
export function clampParallelStrings(count, current) {
    const divisors = divisorsOf(count);
    if (divisors.length === 0) return 1;
    const cur = Math.floor(Number(current)) || 1;
    if (divisors.includes(cur)) return cur;
    const smaller = divisors.filter((d) => d <= cur);
    return smaller.length > 0 ? smaller[smaller.length - 1] : 1;
}

/** e.g. count=12, parallelStrings=2 → "6S2P" (matches ParallelStringsSelect wording). */
export function formatWiringLabel(count, parallelStrings) {
    const c = Math.floor(Number(count)) || 0;
    const p = Math.floor(Number(parallelStrings)) || 1;
    if (c <= 0 || p <= 0 || c % p !== 0) return "";
    const s = c / p;
    return `${s}S${p}P`;
}

/**
 * Smallest parallelStrings (most panels in series per string) that passes controller limits, or null if none.
 */
export function bestParallelStringsForController(
    arrayBase,
    panel,
    layoutCount,
    controller,
    systemVoltage,
    conditions
) {
    if (!controller || !arrayBase || !panel) return null;
    const n = Number(layoutCount);
    if (!Number.isFinite(n) || n <= 0) return null;
    let best = null;
    for (const d of divisorsOf(n)) {
        const ok = panelPassesControllerLimits(
            { ...arrayBase, count: n, parallelStrings: d },
            panel,
            controller,
            systemVoltage,
            conditions
        );
        if (ok && (best === null || d < best)) best = d;
    }
    return best;
}

export function layoutCompatibleWiring(arrayBase, panel, layoutCount, controller, systemVoltage, conditions) {
    return (
        bestParallelStringsForController(arrayBase, panel, layoutCount, controller, systemVoltage, conditions) !=
        null
    );
}

/**
 * Controller check for a layout candidate: any divisor-based wiring may be used; uses same rules as the panel tab.
 */
export function panelPassesControllerLimitsForLayout(
    array,
    panel,
    layoutCount,
    controller,
    systemVoltage,
    conditions
) {
    if (!array || !panel || layoutCount == null) return true;
    const n = Number(layoutCount);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (!controller) return true;
    return layoutCompatibleWiring(array, panel, n, controller, systemVoltage, conditions);
}

/** Max panel weight (kg) from array.maxPanelWeight, else 25 when hideHeavyPanels, else no cap. */
export function getEffectiveMaxPanelWeightKg(array, hideHeavyPanels) {
    if (!array) return null;
    const maxW =
        array.maxPanelWeight !== '' && array.maxPanelWeight != null
            ? Number(array.maxPanelWeight)
            : null;
    if (maxW != null) return Number.isFinite(maxW) ? maxW : null;
    return hideHeavyPanels ? 25 : null;
}

export function panelMeetsWeightCap(panel, effectiveMaxKg) {
    if (effectiveMaxKg == null) return true;
    return panel.weight != null && panel.weight <= effectiveMaxKg;
}

export const isCompatibleFormat = (array, panel) => {
    const aMounting = array.mounting || "In-Roof (GSE)";
    if (aMounting === "On Roof") return true;

    const pGseComp = getPanelGseCompatibility(panel);
    if (pGseComp === GSE_COMPATIBILITY.NONE) return false;
    const aFormat = array.format || "Portrait";
    if (aFormat === "Landscape" && pGseComp === GSE_COMPATIBILITY.PORTRAIT_ONLY) return false;
    if (aFormat === "Portrait" && pGseComp === GSE_COMPATIBILITY.LANDSCAPE_ONLY) return false;
    return true;
};

/**
 * Physical fit of a panel on an array: GSE format, max height/width and weight.
 * @returns {{ isFormatOk: boolean, isHeightOk: boolean, isWidthOk: boolean, isWeightOk: boolean,
 *            effectiveMaxKg: number | null, issues: Array<{ code: string, severity: 'error', message: string }> }}
 */
export function evaluatePhysicalFit(array, panel, hideHeavyPanels = false) {
    const issues = [];
    const isFormatOk = isCompatibleFormat(array, panel);
    if (!isFormatOk) {
        const aFormat = array.format || "Portrait";
        const pGseComp = getPanelGseCompatibility(panel);
        let message;
        if (pGseComp === GSE_COMPATIBILITY.NONE) {
            message = `FATAL PHYSICAL: The ${panel.name} is not compatible with any GSE integrated tray orientation.`;
        } else if (aFormat === "Landscape") {
            message = `FATAL PHYSICAL: The ${panel.name} is only compatible with Portrait GSE integrated trays.`;
        } else {
            message = `FATAL PHYSICAL: The ${panel.name} is only compatible with Landscape GSE integrated trays.`;
        }
        issues.push({ code: 'format', severity: 'error', message });
    }
    const isHeightOk = !array.maxPanelHeight || !!(panel.height && panel.height <= array.maxPanelHeight);
    const isWidthOk = !array.maxPanelWidth || !!(panel.width && panel.width <= array.maxPanelWidth);
    if (!isHeightOk || !isWidthOk) {
        issues.push({
            code: 'size',
            severity: 'error',
            message: `FATAL PHYSICAL: The selected panel (${panel.height}x${panel.width}mm) exceeds your specified maximum dimensions for this array.`,
        });
    }
    const effectiveMaxKg = getEffectiveMaxPanelWeightKg(array, hideHeavyPanels);
    const isWeightOk = panelMeetsWeightCap(panel, effectiveMaxKg);
    if (!isWeightOk && effectiveMaxKg != null) {
        issues.push({
            code: 'weight',
            severity: 'error',
            message: `FATAL PHYSICAL: The selected panel (${panel.weight}kg) exceeds your specified maximum panel weight (${effectiveMaxKg}kg) for this array.`,
        });
    }
    return { isFormatOk, isHeightOk, isWidthOk, isWeightOk, effectiveMaxKg, issues };
}

/**
 * Victron RS legacy shared-tracker SKU limits (product-specific; not generalized trackers math).
 * @returns {{ hasTrackerError: boolean, trackerError100: boolean, trackerError200: boolean }}
 */
export function checkVictronRsSharedTrackerLimits(activeModelIds) {
    let rs450_100_primary = 0;
    let rs450_100_shared = 0;
    let rs450_200_primary = 0;
    let rs450_200_shared = 0;
    for (const id of activeModelIds) {
        if (id === 'rs450_100') rs450_100_primary++;
        if (id === 'rs450_100_shared') rs450_100_shared++;
        if (id === 'rs450_200') rs450_200_primary++;
        if (id === 'rs450_200_shared') rs450_200_shared++;
    }
    const trackerError100 = rs450_100_shared > rs450_100_primary;
    const trackerError200 = rs450_200_shared > rs450_200_primary * 3;
    return {
        hasTrackerError: trackerError100 || trackerError200,
        trackerError100,
        trackerError200,
    };
}

const statusFromIssues = (issues) =>
    issues.some((i) => i.severity === 'error')
        ? 'error'
        : issues.some((i) => i.severity === 'warning')
          ? 'warning'
          : 'valid';

export const analyzeArray = (
    arrayId,
    {
        arraysData,
        panelsData,
        chargersData,
        siteControllers,
        selections,
        systemVoltage = null,
        hideHeavyPanels = false,
        conditions,
    }
) => {
    const array = arraysData.find((a) => a.id === arrayId);
    if (!array) return null;

    const sel = selections[arrayId] || {};

    let panel = null;
    let missingPanelWarning = false;
    if (sel.panel !== "") {
        panel = panelsData.find((p) => p.model === sel.panel) || null;
        // Do not substitute another panel when the selected model is gone from the DB.
        if (!panel && sel.panel) {
            missingPanelWarning = true;
        }
    }

    let controllerInstance = null;
    let controller = null;
    let mpptIndex = sel.controllerMppt || 1;

    if (sel.controllerInstanceId) {
        controllerInstance = siteControllers.find(
            (sc) => sc.id === sel.controllerInstanceId
        );
        if (controllerInstance) {
            controller = chargersData.find(
                (c) => c.id === controllerInstance.modelId
            );
        }
    } else if (sel.controller) {
        // Legacy fallback
        controller = chargersData.find((c) => c.id === sel.controller);
    }

    const arraysOnInstance = controllerInstance
        ? arraysData.filter(
              (a) => (selections[a.id] || {}).controllerInstanceId === controllerInstance.id
          )
        : [array];
    const controllerUnits = controllerUnitsForArray(controller, array.count);

    // Controller cost share: when one controller instance serves multiple arrays, split its cost equally.
    // Microinverters are bought per panel, so the array carries the cost of all its units.
    const getControllerCostShare = () => {
        if (!controller) return 0;
        const price = knownPrice(controller) ?? 0;
        if (isMicroinverter(controller)) return price * controllerUnits;
        if (controllerInstance) {
            return arraysOnInstance.length > 0 ? price / arraysOnInstance.length : 0;
        }
        return price; // legacy single-array assignment
    };

    const electrical = panel
        ? evaluateElectrical(panel, controller, {
              count: array.count,
              parallelStrings: array.parallelStrings || 1,
              systemVoltage,
              conditions,
          })
        : null;
    const cond = resolveDesignConditions(conditions);

    // A price of 0 or blank means unknown: it is left out of totals and makes £/kWp unavailable
    // rather than making the array look free.
    const peakPower = panel ? panel.power * array.count : 0;
    const panelPriceKnown = !panel || hasKnownPrice(panel);
    const controllerPriceKnown = !controller || hasKnownPrice(controller);
    const panelCost = panel && panelPriceKnown ? knownPrice(panel) * array.count : panel ? null : 0;
    const cost = (panelCost ?? 0) + getControllerCostShare();
    const costIncomplete = !panelPriceKnown || !controllerPriceKnown;
    const metrics = {
        peakPower,
        panelCost,
        cost,
        costIncomplete,
        panelPriceKnown,
        controllerPriceKnown,
        costPerKWp: costIncomplete ? null : peakPower > 0 ? cost / (peakPower / 1000) : 0,
        coldVoc: electrical?.coldVoc ?? 0,
        coldVmp: electrical?.coldVmp ?? 0,
        hotVmp: electrical?.hotVmp ?? 0,
        arrayIscHot: electrical?.arrayIscHot ?? 0,
        arrayImpHot: electrical?.arrayImpHot ?? 0,
        conditions: cond,
        controllerUnits,
    };

    if (!panel || !controller) {
        const messages = [];
        if (missingPanelWarning) {
            messages.push(
                `Selected panel model "${sel.panel}" is no longer in the database. Please choose another panel.`
            );
        }
        if (electrical && !electrical.wiringValid) {
            messages.push(
                `Invalid wiring: panel count (${array.count}) is not divisible by parallel strings (${array.parallelStrings || 1}).`
            );
        }
        if (messages.length === 0) {
            messages.push(
                "Please select both a Solar Panel and a PV Controller to view system analysis."
            );
        }

        return {
            array,
            panel,
            controller,
            controllerInstance,
            mpptIndex,
            status: "warning",
            messages,
            issues: [],
            ...metrics,
            currentClipLimit: null,
            isIscClipping: false,
        };
    }

    // Total STC power on this controller instance, for the controller power check.
    const totalWpOnController = arraysOnInstance.reduce((sum, a) => {
        if (a.id === array.id) return sum + peakPower;
        const aPanel = panelsData.find((p) => p.model === (selections[a.id] || {}).panel);
        return sum + (aPanel ? aPanel.power * (a.count || 0) : 0);
    }, 0);
    const power = evaluateControllerPower(controller, totalWpOnController, {
        systemVoltage,
        arrayCount: arraysOnInstance.length,
    });

    const physical = evaluatePhysicalFit(array, panel, hideHeavyPanels);
    // Wiring first, then physical, then electrical (preserves historical message order).
    const wiringIssues = electrical.issues.filter((i) => i.code === 'wiring');
    const otherElectrical = electrical.issues.filter((i) => i.code !== 'wiring');
    const issues = [
        ...wiringIssues,
        ...physical.issues,
        ...otherElectrical,
        ...(power.issue ? [power.issue] : []),
    ];
    const messages = issues.length ? issues.map((i) => i.message) : [""];

    return {
        array,
        panel,
        controller,
        controllerInstance,
        mpptIndex,
        status: statusFromIssues(issues),
        messages,
        issues,
        ...metrics,
        currentClipLimit: electrical.currentClipLimit,
        isIscClipping: electrical.flags.isIscOverRating || electrical.flags.isCurrentClipping,
        isVmpBelowStartup: !electrical.flags.isVmpOk,
        effectiveStartupV: electrical.effectiveStartupV,
        flags: electrical.flags,
        power: { totalWp: totalWpOnController, ...power },
    };
};
