import { useMemo, useCallback } from 'react';
import {
    isCompatibleFormat,
    coldVocFactor,
    hotVmpFactor,
    hotIscFactor,
    getEffectiveStartupV,
} from '../../lib/arrayAnalysis';

/**
 * Computes the list of panels valid for the given array (physical + optional electrical compatibility),
 * with derived metrics and sort applied.
 * @param {string} arrayId
 * @param {object} options - panelsData, arraysData, chargersData, siteControllers, selections, systemVoltage, hideHeavyPanels, hideMarginalPanels, hideIncompatiblePanels, panelSort
 */
export function useValidPanels(arrayId, options) {
    const {
        panelsData,
        arraysData,
        chargersData,
        siteControllers,
        selections,
        systemVoltage,
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
                const pPeakPower = p.power * array.count;
                const pStrings = array.parallelStrings || 1;
                const panelsPerSeriesString = array.count / pStrings;
                const pStringVocSTC = p.voc * panelsPerSeriesString;
                const pColdVoc = pStringVocSTC * coldVocFactor(p);
                const pStringVmpSTC = p.vmp * panelsPerSeriesString;
                const pHotVmp = pStringVmpSTC * hotVmpFactor(p);
                const pArrayIscHot = p.isc * pStrings * hotIscFactor(p);
                const pCost = p.price * array.count;
                const pCostPerKWp = pPeakPower > 0 ? pCost / (pPeakPower / 1000) : 0;
                const isPhysicallyOk = isCompatibleFormat(array, p);
                const isVocOk = !controller || pColdVoc <= controller.maxV;
                const isVmpOk =
                    !controller || pHotVmp >= getEffectiveStartupV(controller, systemVoltage);
                const isIscOk = !controller || pArrayIscHot <= controller.maxIsc;
                const maxW =
                    array.maxPanelWeight !== '' && array.maxPanelWeight != null
                        ? Number(array.maxPanelWeight)
                        : null;
                const effectiveMaxWeight = maxW != null ? maxW : (hideHeavyPanels ? 25 : null);
                const isWeightOk =
                    effectiveMaxWeight == null ||
                    (p.weight != null && p.weight <= effectiveMaxWeight);
                const isHeightOk =
                    !array.maxPanelHeight || (p.height && p.height <= array.maxPanelHeight);
                const isWidthOk = !array.maxPanelWidth || (p.width && p.width <= array.maxPanelWidth);
                const isSizeOk = isHeightOk && isWidthOk;
                const isVocWarn =
                    controller && pColdVoc > controller.maxV * 0.94 && isVocOk;
                const isMarginalOk = !hideMarginalPanels || !isVocWarn;
                const isFullyCompatible =
                    p.active !== false &&
                    isPhysicallyOk &&
                    isVocOk &&
                    isVmpOk &&
                    isIscOk &&
                    isWeightOk &&
                    isSizeOk &&
                    isMarginalOk;
                return {
                    ...p,
                    peakPower: pPeakPower,
                    panelCost: pCost,
                    costPerKWp: pCostPerKWp,
                    coldVoc: pColdVoc,
                    hotVmp: pHotVmp,
                    arrayIscHot: pArrayIscHot,
                    isFullyCompatible,
                    isVocWarn,
                    isVocOk,
                    isVmpOk,
                    isIscOk,
                    isWeightOk,
                    isHeightOk,
                    isWidthOk,
                };
            })
            .filter((p) => {
                if (hideIncompatiblePanels) {
                    return !controller
                        ? p.active !== false && p.isFullyCompatible
                        : p.isFullyCompatible;
                }
                return p.active !== false && isCompatibleFormat(array, p);
            });

        const sorted = [...list].sort((a, b) => {
            const valA = a[panelSort.key];
            const valB = b[panelSort.key];
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
