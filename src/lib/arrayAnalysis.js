import { GSE_COMPATIBILITY, getPanelGseCompatibility } from './gseCompatibility';

/** Worst-case cold cell temperature (°C) used for the Voc headroom check. */
export const COLD_TEMP_C = -10;
/** Worst-case hot cell temperature (°C) used for the Vmp startup and Isc checks. */
export const HOT_TEMP_C = 65;
/** Datasheet reference temperature (°C) that panel specs are quoted at. */
export const STC_TEMP_C = 25;
/**
 * Fraction of the controller's max PV voltage above which cold Voc is flagged as a warning
 * rather than passing silently, i.e. the margin is real but uncomfortably tight.
 */
export const VOC_WARN_FRACTION = 0.94;

export function coldVocFactor(panel) {
    if (panel.tempCoefVoc == null) return 1.084;
    return 1 + ((COLD_TEMP_C - STC_TEMP_C) * panel.tempCoefVoc) / 100;
}

/**
 * Hot-day Vmp derate factor.
 * Prefers tempCoefVmp (linear %/°C) when present; otherwise approximates from tempCoefPmax via √P.
 */
export function hotVmpFactor(panel) {
    if (panel.tempCoefVmp != null) {
        return 1 + ((HOT_TEMP_C - STC_TEMP_C) * panel.tempCoefVmp) / 100;
    }
    if (panel.tempCoefPmax == null) return 0.9;
    const pRatio = 1 + ((HOT_TEMP_C - STC_TEMP_C) * panel.tempCoefPmax) / 100;
    return pRatio > 0 ? Math.sqrt(pRatio) : 0.9;
}

export function hotIscFactor(panel) {
    if (panel.tempCoefIsc == null) return 1;
    return 1 + ((HOT_TEMP_C - STC_TEMP_C) * panel.tempCoefIsc) / 100;
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
 * Whether the array wiring (series strings × panel electricals) stays within controller Voc/Vmp/Isc limits.
 */
export function panelPassesControllerLimits(array, panel, controller, systemVoltage) {
    if (!controller || !array || !panel) return true;
    const pStrings = array.parallelStrings || 1;
    // Fail closed when count is not divisible by parallelStrings (fractional series length).
    if (!isValidWiring(array.count, pStrings)) return false;
    const panelsPerSeriesString = array.count / pStrings;
    const pStringVocSTC = panel.voc * panelsPerSeriesString;
    const pColdVoc = pStringVocSTC * coldVocFactor(panel);
    const pStringVmpSTC = panel.vmp * panelsPerSeriesString;
    const pHotVmp = pStringVmpSTC * hotVmpFactor(panel);
    const pArrayIscHot = panel.isc * pStrings * hotIscFactor(panel);
    const isVocOk = pColdVoc <= controller.maxV;
    const isVmpOk = pHotVmp >= getEffectiveStartupV(controller, systemVoltage);
    const isIscOk = pArrayIscHot <= controller.maxIsc;
    return isVocOk && isVmpOk && isIscOk;
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
    systemVoltage
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
            systemVoltage
        );
        if (ok && (best === null || d < best)) best = d;
    }
    return best;
}

export function layoutCompatibleWiring(arrayBase, panel, layoutCount, controller, systemVoltage) {
    return bestParallelStringsForController(arrayBase, panel, layoutCount, controller, systemVoltage) != null;
}

/**
 * Controller check for a layout candidate: any divisor-based wiring may be used; uses same rules as the panel tab.
 */
export function panelPassesControllerLimitsForLayout(
    array,
    panel,
    layoutCount,
    controller,
    systemVoltage
) {
    if (!array || !panel || layoutCount == null) return true;
    const n = Number(layoutCount);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (!controller) return true;
    return layoutCompatibleWiring(array, panel, n, controller, systemVoltage);
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

    // Controller cost share: when one controller instance serves multiple arrays, split its cost equally
    const getControllerCostShare = () => {
        if (!controller) return 0;
        const price = controller.price || 0;
        if (controllerInstance) {
            const arraysUsingThisController = arraysData.filter(
                (a) => (selections[a.id] || {}).controllerInstanceId === controllerInstance.id
            ).length;
            return arraysUsingThisController > 0 ? price / arraysUsingThisController : 0;
        }
        return price; // legacy single-array assignment
    };

    const pStringsRaw = array.parallelStrings || 1;
    const wiringValid = !panel || isValidWiring(array.count, pStringsRaw);
    // Use integer series length only when wiring is valid; otherwise treat as 0 for metrics.
    const pStrings = wiringValid ? pStringsRaw : pStringsRaw;
    const panelsPerSeriesString = wiringValid ? array.count / pStrings : 0;

    if (!panel || !controller) {
        let coldVoc = 0;
        let hotVmp = 0;
        let peakPower = 0;
        let panelCost = 0;

        if (panel && wiringValid) {
            peakPower = panel.power * array.count;
            coldVoc = panel.voc * panelsPerSeriesString * coldVocFactor(panel);
            hotVmp = panel.vmp * panelsPerSeriesString * hotVmpFactor(panel);
            panelCost = panel.price * array.count;
        } else if (panel) {
            peakPower = panel.power * array.count;
            panelCost = panel.price * array.count;
        }
        const cost = panelCost + getControllerCostShare();
        const arrayIscHot =
            panel && wiringValid ? panel.isc * pStrings * hotIscFactor(panel) : 0;

        const messages = [];
        if (missingPanelWarning) {
            messages.push(
                `Selected panel model "${sel.panel}" is no longer in the database. Please choose another panel.`
            );
        }
        if (panel && !wiringValid) {
            messages.push(
                `Invalid wiring: panel count (${array.count}) is not divisible by parallel strings (${pStringsRaw}).`
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
            peakPower,
            panelCost,
            cost,
            costPerKWp: peakPower > 0 ? cost / (peakPower / 1000) : 0,
            coldVoc,
            hotVmp,
            arrayIscHot,
        };
    }

    const peakPower = panel.power * array.count;
    const panelCost = panel.price * array.count;
    const cost = panelCost + getControllerCostShare();

    const coldVoc = wiringValid
        ? panel.voc * panelsPerSeriesString * coldVocFactor(panel)
        : 0;
    const hotVmp = wiringValid
        ? panel.vmp * panelsPerSeriesString * hotVmpFactor(panel)
        : 0;
    const arrayIscHot = wiringValid ? panel.isc * pStrings * hotIscFactor(panel) : 0;

    const effectiveStartupV = getEffectiveStartupV(controller, systemVoltage);
    const isWiringError = !wiringValid;
    const isVocError = wiringValid && coldVoc > controller.maxV;
    const isVocWarn = wiringValid && coldVoc > controller.maxV * VOC_WARN_FRACTION && !isVocError;
    const isVmpError = wiringValid && hotVmp < effectiveStartupV;
    const isIscError = wiringValid && arrayIscHot > controller.maxIsc;
    const isFormatError = !isCompatibleFormat(array, panel);

    let status = "valid";
    let messages = [];

    if (isWiringError) {
        status = "error";
        messages.push(
            `FATAL: Invalid wiring - panel count (${array.count}) is not divisible by parallel strings (${pStringsRaw}).`
        );
    }

    if (isFormatError) {
        status = "error";
        const aFormat = array.format || "Portrait";
        const pGseComp = getPanelGseCompatibility(panel);
        if (pGseComp === GSE_COMPATIBILITY.NONE) {
            messages.push(
                `FATAL PHYSICAL: The ${panel.name} is not compatible with any GSE integrated tray orientation.`
            );
        } else if (aFormat === "Landscape") {
            messages.push(
                `FATAL PHYSICAL: The ${panel.name} is only compatible with Portrait GSE integrated trays.`
            );
        } else {
            messages.push(
                `FATAL PHYSICAL: The ${panel.name} is only compatible with Landscape GSE integrated trays.`
            );
        }
    }

    const isHeightOk =
        !array.maxPanelHeight ||
        (panel.height && panel.height <= array.maxPanelHeight);
    const isWidthOk =
        !array.maxPanelWidth ||
        (panel.width && panel.width <= array.maxPanelWidth);
    const effectiveMaxKg = getEffectiveMaxPanelWeightKg(array, hideHeavyPanels);
    const isWeightOk = panelMeetsWeightCap(panel, effectiveMaxKg);
    if (!isHeightOk || !isWidthOk) {
        status = "error";
        messages.push(
            `FATAL PHYSICAL: The selected panel (${panel.height}x${panel.width}mm) exceeds your specified maximum dimensions for this array.`
        );
    }
    if (!isWeightOk && effectiveMaxKg != null) {
        status = "error";
        messages.push(
            `FATAL PHYSICAL: The selected panel (${panel.weight}kg) exceeds your specified maximum panel weight (${effectiveMaxKg}kg) for this array.`
        );
    }

    if (isVocError) {
        status = "error";
        messages.push(
            `FATAL: Cold Voc (${coldVoc.toFixed(
                1
            )}V) exceeds PV controller limit (${controller.maxV}V). Will destroy hardware.`
        );
    } else if (isVocWarn) {
        if (status !== "error") status = "warning";
        messages.push(
            `Cold Voc (${coldVoc.toFixed(
                1
            )}V) is dangerously close to PV controller limit (${controller.maxV}V). Margin is too tight.`
        );
    }

    if (isVmpError) {
        status = "error";
        messages.push(
            `FATAL: Hot Vmp (${hotVmp.toFixed(
                1
            )}V) is below PV controller startup threshold (${effectiveStartupV}V). Will not start on hot days.`
        );
    }

    if (isIscError) {
        status = "error";
        messages.push(
            `FATAL: Array Isc at 65°C (${arrayIscHot.toFixed(
                2
            )}A) exceeds PV controller tracker limit (${controller.maxIsc}A).`
        );
    }

    if (messages.length === 0) {
        messages.push("");
    }

    return {
        array,
        panel,
        controller,
        controllerInstance,
        mpptIndex,
        status,
        messages,
        peakPower,
        panelCost,
        cost,
        costPerKWp: peakPower > 0 ? cost / (peakPower / 1000) : 0,
        coldVoc,
        hotVmp,
        arrayIscHot,
        effectiveStartupV,
    };
};
