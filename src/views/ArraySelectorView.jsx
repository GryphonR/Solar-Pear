import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle } from '../components/Icons';
import { getEffectiveStartupV } from '../lib/arrayAnalysis';
import { useAppState } from '../context/AppStateContext';
import { useValidPanels } from './arraySelector/useValidPanels';
import ParallelStringsSelect from './arraySelector/ParallelStringsSelect';
import PanelTable from './arraySelector/PanelTable';
import ControllerSection from './arraySelector/ControllerSection';
import ArrayOverviewTab from './arraySelector/ArrayOverviewTab';

export default function ArraySelectorView({ arrayId }) {
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
        hideIncompatibleControllers,
        setHideIncompatibleControllers,
        panelSort,
        setPanelSort,
        controllerSort,
        setControllerSort,
        activeArrayContentTab,
        setActiveArrayContentTab,
        userNotes,
        updateUserNote,
        updateArray,
        updateSelection,
        setInfoModalPanelId,
        setInfoModalChargerId,
        availableChargers,
        deleteControllerInstance,
        createControllerInstance,
        systemVoltage,
    } = useAppState();

    const analysis = getArrayAnalysis(arrayId);
    if (!analysis) return null;

    const {
        array,
        panel,
        controller,
        coldVoc,
        hotVmp,
        arrayIscHot,
        peakPower,
        status,
        messages,
        cost,
        costPerKWp,
    } = analysis;

    const effectiveStartupV = controller ? getEffectiveStartupV(controller, systemVoltage) : null;

    const { validPanels, togglePanelSort } = useValidPanels(arrayId, {
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
        setPanelSort,
    });

    const contentTab = activeArrayContentTab[arrayId] || 'overview';

    const toggleControllerSort = (key) =>
        setControllerSort((prev) => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));

    const controllersWithFlags = useMemo(
        () =>
            availableChargers.map((c) => {
                const isVoltageOk = !panel || coldVoc <= c.maxV;
                const isStartupOk = !panel || hotVmp >= getEffectiveStartupV(c, systemVoltage);
                const isCurrentOk = !panel || arrayIscHot <= c.maxIsc;
                const isFullyCompatible = isVoltageOk && isStartupOk && isCurrentOk;
                return { ...c, isVoltageOk, isStartupOk, isCurrentOk, isFullyCompatible };
            }),
        [availableChargers, panel, coldVoc, hotVmp, arrayIscHot, systemVoltage]
    );

    const controllersForTable = hideIncompatibleControllers
        ? controllersWithFlags.filter((c) => c.isFullyCompatible)
        : controllersWithFlags;

    const sortedControllersList = useMemo(
        () =>
            [...controllersForTable].sort((a, b) => {
                const vA = a[controllerSort.key] || 0;
                const vB = b[controllerSort.key] || 0;
                if (vA < vB) return controllerSort.dir === 'asc' ? -1 : 1;
                if (vA > vB) return controllerSort.dir === 'asc' ? 1 : -1;
                if (a.name < b.name) return controllerSort.dir === 'asc' ? -1 : 1;
                if (a.name > b.name) return controllerSort.dir === 'asc' ? 1 : -1;
                return 0;
            }),
        [controllersForTable, controllerSort]
    );

    const areaControllers = siteControllers.filter((sc) => sc.area === array.area);

    return (
        <div className="space-y-6 pb-12">
            <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {array.name}
                        {status === 'error' && (
                            <AlertTriangle size={24} className="text-red-500 shrink-0" title="System failure detected" aria-label="Array status: failure" />
                        )}
                        {status === 'warning' && (
                            <AlertTriangle size={24} className="text-orange-500 shrink-0" title="Warning" aria-label="Array status: warning" />
                        )}
                        {status !== 'error' && status !== 'warning' && (
                            <CheckCircle size={24} className="text-green-600 shrink-0" title="System compatible" aria-label="Array status: good" />
                        )}
                    </h2>
                    <p className="text-slate-500 mb-2">
                        {array.orientation} Roof Direction • {array.count} Panels •{' '}
                        {array.mounting === 'In-Roof (GSE)' ? `${array.format} Orientation (GSE)` : array.mounting}
                    </p>
                    <ParallelStringsSelect array={array} arrayId={arrayId} updateArray={updateArray} />
                </div>
                <div className="flex space-x-8 text-right">
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Peak Power</p>
                        <p className="text-3xl font-light text-blue-600">{peakPower.toLocaleString()} <span className="text-xl">W</span></p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Total Cost / kWp</p>
                        <p className="text-3xl font-light text-slate-800">£{costPerKWp.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Total Array Cost</p>
                        <p className="text-3xl font-light text-slate-800">£{cost.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="flex border-b border-slate-300 mb-6">
                <button
                    onClick={() => setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'overview' }))}
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${contentTab === 'overview' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    Array Overview
                </button>
                <button
                    onClick={() => setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'panels' }))}
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${contentTab === 'panels' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    Panel Selector
                </button>
                <button
                    onClick={() => setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'controllers' }))}
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${contentTab === 'controllers' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    Controller Selector
                </button>
            </div>

            {contentTab === 'overview' && (
                <ArrayOverviewTab
                    array={array}
                    arrayId={arrayId}
                    panel={panel}
                    controller={controller}
                    status={status}
                    messages={messages}
                    coldVoc={coldVoc}
                    hotVmp={hotVmp}
                    arrayIscHot={arrayIscHot}
                    effectiveStartupV={effectiveStartupV}
                    panelsData={panelsData}
                    userNotes={userNotes}
                    setActiveArrayContentTab={setActiveArrayContentTab}
                    updateSelection={updateSelection}
                    updateUserNote={updateUserNote}
                />
            )}

            {contentTab === 'panels' && (
                <PanelTable
                    validPanels={validPanels}
                    array={array}
                    arrayId={arrayId}
                    selectedPanelModel={selections[arrayId]?.panel}
                    onSelectPanel={(model) => updateSelection(arrayId, 'panel', model)}
                    onOpenInfo={setInfoModalPanelId}
                    panelSort={panelSort}
                    togglePanelSort={togglePanelSort}
                    updateArray={updateArray}
                    hideHeavyPanels={hideHeavyPanels}
                    setHideHeavyPanels={setHideHeavyPanels}
                    hideMarginalPanels={hideMarginalPanels}
                    setHideMarginalPanels={setHideMarginalPanels}
                    hideIncompatiblePanels={hideIncompatiblePanels}
                    setHideIncompatiblePanels={setHideIncompatiblePanels}
                    controller={controller}
                />
            )}

            {contentTab === 'controllers' && (
                <ControllerSection
                    areaControllers={areaControllers}
                    arraysData={arraysData}
                    chargersData={chargersData}
                    selections={selections}
                    arrayId={arrayId}
                    array={array}
                    panel={panel}
                    coldVoc={coldVoc}
                    hotVmp={hotVmp}
                    arrayIscHot={arrayIscHot}
                    systemVoltage={systemVoltage}
                    sortedControllersList={sortedControllersList}
                    controllerSort={controllerSort}
                    toggleControllerSort={toggleControllerSort}
                    hideIncompatibleControllers={hideIncompatibleControllers}
                    setHideIncompatibleControllers={setHideIncompatibleControllers}
                    updateSelection={updateSelection}
                    createControllerInstance={createControllerInstance}
                    deleteControllerInstance={deleteControllerInstance}
                    setInfoModalChargerId={setInfoModalChargerId}
                />
            )}
        </div>
    );
}
