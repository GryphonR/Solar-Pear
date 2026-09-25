import { useMemo, useCallback } from 'react';
import { evaluateElectrical, evaluatePhysicalFit } from '../../lib/arrayAnalysis';
import { knownPrice, compareMissingLast } from '../../lib/pricing';

/**
 * Computes the list of panels valid for the given array (physical + optional electrical compatibility),
 * with derived metrics and sort applied.
 * @param {string} arrayId
 * All electrical and physical maths comes from evaluateElectrical / evaluatePhysicalFit so the
 * table always agrees with the array analysis.
 * @param {object} options - panelsData, arraysData, chargersData, siteControllers, selections, systemVoltage, conditions, hideHeavyPanels, hideMarginalPanels, hideIncompatiblePanels, panelSort
 */
export function useValidPanels(arrayId, options) {
    const {
        panelsData,
        arraysData,
        chargersData,
        siteControllers,
        selections,
        systemVoltage,
        conditions,
        hideHeavyPanels,
        hideMarginalPanels,
        hideIncompatiblePanels,
        panelSort,
    } = options;

    const array = useMemo(
        () => arraysData.find((a) => a.id === arrayId),
        [arraysData, arrayId]
    );

    const controller = useMemo(() => {
        if (!array) return null;
        const sel = selections[arrayId] || {};
        let controllerInstance = null;
        if (sel.controllerInstanceId) {
            controllerInstance = siteControllers.find((sc) => sc.id === sel.controllerInstanceId);
        }
        if (controllerInstance) {
            return chargersData.find((c) => c.id === controllerInstance.modelId) || null;
        }
        if (sel.controller) {
            return chargersData.find((c) => c.id === sel.controller) || null;
        }
        return null;
    }, [arrayId, selections, siteControllers, chargersData]);

    const validPanels = useMemo(() => {
        if (!array) return [];
        const list = panelsData
            .map((p) => {
                const peakPower = p.power * array.count;
                const unitPrice = knownPrice(p);
                const panelCost = unitPrice == null ? null : unitPrice * array.count;
                const e = evaluateElectrical(p, controller, {
                    count: array.count,
                    parallelStrings: array.parallelStrings || 1,
                    systemVoltage,
                    conditions,
                });
                const fit = evaluatePhysicalFit(array, p, hideHeavyPanels);
                const isVocOk = e.wiringValid && e.flags.isVocOk && e.flags.isPanelSystemVoltageOk;
                const isVocWarn = !!controller && isVocOk && e.flags.isVocWarn;
                const isMarginalOk = !hideMarginalPanels || !isVocWarn;
                const isFullyCompatible =
                    p.active !== false &&
                    e.wiringValid &&
                    fit.isFormatOk &&
                    e.hardOk &&
                    fit.isWeightOk &&
                    fit.isHeightOk &&
                    fit.isWidthOk &&
                    isMarginalOk;
                return {
                    ...p,
                    peakPower,
                    panelCost,
                    costPerKWp: panelCost == null ? null : peakPower > 0 ? panelCost / (peakPower / 1000) : 0,
                    coldVoc: e.coldVoc,
                    hotVmp: e.hotVmp,
                    arrayIscHot: e.arrayIscHot,
                    isFullyCompatible,
                    isVocWarn,
                    isVocOk,
                    isVmpOk: e.flags.isVmpOk && !e.flags.isBelowMpptMin,
                    isIscOk: !e.flags.isIscOverRating && !e.flags.isCurrentClipping,
                    isWeightOk: fit.isWeightOk,
                    isHeightOk: fit.isHeightOk,
                    isWidthOk: fit.isWidthOk,
                    isFormatOk: fit.isFormatOk,
                    electricalIssues: e.issues,
                };
            })
            .filter((p) => {
                if (hideIncompatiblePanels) {
                    return !controller
                        ? p.active !== false && p.isFullyCompatible
                        : p.isFullyCompatible;
                }
                return p.active !== false && p.isFormatOk;
            });

        const sorted = [...list].sort((a, b) => {
            const valA = a[panelSort.key];
            const valB = b[panelSort.key];
            // Unknown values (e.g. no price) always sort last, whichever direction is chosen.
            const missing = compareMissingLast(valA, valB);
            if (missing !== null) return missing;
            if (valA < valB) return panelSort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return panelSort.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [
        array,
        panelsData,
        controller,
        systemVoltage,
        conditions,
        hideHeavyPanels,
        hideMarginalPanels,
        hideIncompatiblePanels,
        panelSort,
    ]);

    const togglePanelSort = useCallback(
        (key) => {
            options.setPanelSort((prev) => ({
                key,
                dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
            }));
        },
        [options.setPanelSort]
    );

    return { validPanels, togglePanelSort };
}
