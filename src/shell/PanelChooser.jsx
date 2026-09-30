/**
 * @file PanelChooser.jsx
 * The array's Panel tab: the ranked panel table (`useValidPanels`, checked by the engine) with its filters.
 */

import React, { useMemo } from 'react';
import { useAppState } from '../context/AppStateContext';
import { conditionsFromAreaSettings } from '../lib/arrayAnalysis';
import { useValidPanels } from '../views/arraySelector/useValidPanels';
import PanelTable from '../views/arraySelector/PanelTable';

export default function PanelChooser({ arrayId }) {
    const {
        getArrayAnalysis,
        panelsData,
        chargersData,
        arraysData,
        siteControllers,
        selections,
        hideHeavyPanels,
        setHideHeavyPanels,
        hideMarginalPanels,
        setHideMarginalPanels,
        hideIncompatiblePanels,
        setHideIncompatiblePanels,
        panelSort,
        setPanelSort,
        updateSelection,
        setInfoModalPanelId,
        getAreaSettings,
    } = useAppState();

    const analysis = getArrayAnalysis(arrayId);
    const settings = getAreaSettings(analysis?.array?.area || 'House');
    const { designLowC, designHighC, strictCurrent } = settings;
    const conditions = useMemo(() => conditionsFromAreaSettings({ designLowC, designHighC, strictCurrent }), [designLowC, designHighC, strictCurrent]);

    const { validPanels, togglePanelSort } = useValidPanels(arrayId, {
        panelsData,
        arraysData,
        chargersData,
        siteControllers,
        selections,
        systemVoltage: settings.systemVoltage,
        conditions,
        hideHeavyPanels,
        hideMarginalPanels,
        hideIncompatiblePanels,
        panelSort,
        setPanelSort,
    });

    if (!analysis?.array) return null;
    return (
        <PanelTable
            validPanels={validPanels}
            selectedPanelModel={selections[arrayId]?.panel}
            onSelectPanel={(model) => updateSelection(arrayId, 'panel', model)}
            onOpenInfo={setInfoModalPanelId}
            panelSort={panelSort}
            togglePanelSort={togglePanelSort}
            hideHeavyPanels={hideHeavyPanels}
            setHideHeavyPanels={setHideHeavyPanels}
            hideMarginalPanels={hideMarginalPanels}
            setHideMarginalPanels={setHideMarginalPanels}
            hideIncompatiblePanels={hideIncompatiblePanels}
            setHideIncompatiblePanels={setHideIncompatiblePanels}
            controller={analysis.controller}
        />
    );
}
