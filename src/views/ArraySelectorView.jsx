import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle } from '../components/Icons';
import { evaluateElectrical, conditionsFromAreaSettings, isMicroinverter } from '../lib/arrayAnalysis';
import { useAppState } from '../context/AppStateContext';
import { useValidPanels } from './arraySelector/useValidPanels';
import ParallelStringsSelect from './arraySelector/ParallelStringsSelect';
import PanelTable from './arraySelector/PanelTable';
import ControllerSection from './arraySelector/ControllerSection';
import ArrayOverviewTab from './arraySelector/ArrayOverviewTab';
import ArrayPlanner from '../components/planner/ArrayPlanner';

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
        getAreaSettings,
        updateAreaSettings,
    } = useAppState();

    // Resolve analysis first, but do not early-return before hooks (Rules of Hooks).
    const analysis = getArrayAnalysis(arrayId);
    const array = analysis?.array;
    const panel = analysis?.panel;
    const controller = analysis?.controller;
    const coldVoc = analysis?.coldVoc ?? 0;
    const hotVmp = analysis?.hotVmp ?? 0;
    const arrayIscHot = analysis?.arrayIscHot ?? 0;
    const peakPower = analysis?.peakPower ?? 0;
    const status = analysis?.status;
    const messages = analysis?.messages ?? [];
    const cost = analysis?.cost ?? 0;
    const costPerKWp = analysis?.costPerKWp ?? 0;

    const areaSettings = getAreaSettings(array?.area || 'House');
    const areaSystemVoltage = areaSettings.systemVoltage;
    const { designLowC, designHighC, strictCurrent } = areaSettings;
    const conditions = useMemo(
        () => conditionsFromAreaSettings({ designLowC, designHighC, strictCurrent }),
        [designLowC, designHighC, strictCurrent]
    );

    const effectiveStartupV = analysis?.effectiveStartupV ?? null;

    const { validPanels, togglePanelSort } = useValidPanels(arrayId, {
        panelsData,
        arraysData,
        chargersData,
        siteControllers,
        selections,
        systemVoltage: areaSystemVoltage,
        conditions,
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

    // Each candidate controller is evaluated with the same engine as the array analysis, so
    // controller-specific wiring rules (e.g. one panel per microinverter input) are respected.
    const arrayCount = array?.count;
    const arrayParallelStrings = array?.parallelStrings;
    const evaluateController = useMemo(() => {
        if (!panel) return () => null;
        return (c) =>
            evaluateElectrical(panel, c, {
                count: arrayCount,
                parallelStrings: arrayParallelStrings || 1,
                systemVoltage: areaSystemVoltage,
                conditions,
            });
    }, [panel, arrayCount, arrayParallelStrings, areaSystemVoltage, conditions]);

    const controllersWithFlags = useMemo(
        () =>
            availableChargers.map((c) => {
                const e = evaluateController(c);
                if (!e) {
                    return { ...c, isVoltageOk: true, isStartupOk: true, isCurrentOk: true, isFullyCompatible: true };
                }
                const isVoltageOk = e.flags.isVocOk && e.flags.isPanelSystemVoltageOk;
                const isStartupOk = e.flags.isVmpOk && !e.flags.isBelowMpptMin;
                const isCurrentOk = !e.flags.isIscOverRating && !e.flags.isCurrentClipping;
                return { ...c, isVoltageOk, isStartupOk, isCurrentOk, isFullyCompatible: e.hardOk };
            }),
        [availableChargers, evaluateController]
    );

    const controllersForAreaType = useMemo(
        () =>
            controllersWithFlags.filter((c) => {
                const volts = c.systemVoltages || [48];
                if (areaSettings.systemVoltage !== null && !volts.includes(areaSettings.systemVoltage)) {
                    return false;
                }
                if (areaSettings.systemType === 'any') return true;
                if (areaSettings.systemType === 'dc-charger') return c.systemType === 'dc-charger';
                if (areaSettings.systemType === 'grid-connected') {
                    if (!(c.g98_cert || c.g99_cert)) return false;
                    if (areaSettings.filterEps && !c.eps) return false;
                    if (areaSettings.filterHouseBackup && !c.house_backup) return false;
                    return true;
                }
                if (areaSettings.systemType === 'off-grid-ac') return !!c.pure_off_grid_native;
                return true;
            }),
        [controllersWithFlags, areaSettings]
    );

    const controllersForTable = hideIncompatibleControllers
        ? controllersForAreaType.filter((c) => c.isFullyCompatible)
        : controllersForAreaType;

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

    const areaControllers = siteControllers.filter((sc) => sc.area === (array?.area));

    if (!analysis || !array) return null;

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
                        {array.count} Panels •{' '}
                        {array.mounting === 'In-Roof (GSE)' ? `${array.format} Orientation (GSE)` : array.mounting}
                    </p>
                    {isMicroinverter(controller) ? (
                        <p className="text-sm text-slate-500 font-medium">
                            Wiring: one panel per microinverter input ({analysis.controllerUnits} × {controller.name})
                        </p>
                    ) : (
                        <ParallelStringsSelect array={array} arrayId={arrayId} updateArray={updateArray} />
                    )}
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
                    onClick={() => setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'layout' }))}
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${contentTab === 'layout' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    Layout
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
                    issues={analysis.issues}
                    flags={analysis.flags}
                    conditions={analysis.conditions}
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
                    evaluateController={evaluateController}
                    systemVoltage={areaSystemVoltage}
                    areaSettings={areaSettings}
                    updateAreaSettings={updateAreaSettings}
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

            <div className={contentTab !== 'layout' ? 'hidden' : ''} aria-hidden={contentTab !== 'layout'}>
                <ArrayPlanner
                    key={arrayId}
                    active={contentTab === 'layout'}
                    arrayId={arrayId}
                    draftArrayData={null}
                    arraysData={arraysData}
                    panelsData={panelsData}
                    showApplyArrayInToolbar
                />
            </div>
        </div>
    );
}
