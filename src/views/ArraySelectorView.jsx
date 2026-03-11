import React from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Info,
    XIcon,
    ExternalLink,
    Trash2,
} from '../components/Icons';
import BuyButton from '../components/BuyButton';
import ArrayOverviewGraphs from '../components/ArrayOverviewGraphs';
import { isCompatibleFormat, coldVocFactor, hotVmpFactor, hotIscFactor, getEffectiveStartupV } from '../lib/arrayAnalysis';
import { useAppState } from '../context/AppStateContext';

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

    // Effective startup voltage for the selected controller (Vbat + offset when v_start_vbat_dependent)
    const effectiveStartupV = controller ? getEffectiveStartupV(controller, systemVoltage) : null;

    const validPanels = panelsData
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
            const isVmpOk = !controller || pHotVmp >= getEffectiveStartupV(controller, systemVoltage);
            const isIscOk = !controller || pArrayIscHot <= controller.maxIsc;
            const maxW =
                array.maxPanelWeight !== '' && array.maxPanelWeight != null
                    ? Number(array.maxPanelWeight)
                    : null;
            const effectiveMaxWeight = maxW != null ? maxW : (hideHeavyPanels ? 25 : null);
            const isWeightOk =
                effectiveMaxWeight == null ||
                (p.weight != null && p.weight <= effectiveMaxWeight);
            const isHeightOk = !array.maxPanelHeight || (p.height && p.height <= array.maxPanelHeight);
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
                return !controller ? p.active !== false && p.isFullyCompatible : p.isFullyCompatible;
            }
            return p.active !== false && isCompatibleFormat(array, p);
        });

    validPanels.sort((a, b) => {
        const valA = a[panelSort.key];
        const valB = b[panelSort.key];
        if (valA < valB) return panelSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return panelSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const togglePanelSort = (key) => {
        setPanelSort((prev) => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    const divisors = [];
    for (let i = 1; i <= array.count; i++) {
        if (array.count % i === 0) divisors.push(i);
    }

    const contentTab = activeArrayContentTab[arrayId] || 'overview';

    const toggleControllerSort = (key) =>
        setControllerSort((prev) => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));

    const controllersWithFlags = availableChargers.map((c) => {
        const isVoltageOk = !panel || coldVoc <= c.maxV;
        const isStartupOk = !panel || hotVmp >= getEffectiveStartupV(c, systemVoltage);
        const isCurrentOk = !panel || arrayIscHot <= c.maxIsc;
        const isFullyCompatible = isVoltageOk && isStartupOk && isCurrentOk;
        return { ...c, isVoltageOk, isStartupOk, isCurrentOk, isFullyCompatible };
    });

    const controllersForTable = hideIncompatibleControllers
        ? controllersWithFlags.filter((c) => c.isFullyCompatible)
        : controllersWithFlags;

    const sortedControllersList = [...controllersForTable].sort((a, b) => {
        const vA = a[controllerSort.key] || 0;
        const vB = b[controllerSort.key] || 0;
        if (vA < vB) return controllerSort.dir === 'asc' ? -1 : 1;
        if (vA > vB) return controllerSort.dir === 'asc' ? 1 : -1;
        if (a.name < b.name) return controllerSort.dir === 'asc' ? -1 : 1;
        if (a.name > b.name) return controllerSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const areaControllers = siteControllers.filter((sc) => sc.area === array.area);

    return (
        <div className="space-y-6 pb-12">
            <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {array.name}
                        {status === 'error' && (
                            <AlertTriangle
                                size={24}
                                className="text-red-500 shrink-0"
                                title="System failure detected"
                                aria-label="Array status: failure"
                            />
                        )}
                        {status === 'warning' && (
                            <AlertTriangle
                                size={24}
                                className="text-orange-500 shrink-0"
                                title="Warning"
                                aria-label="Array status: warning"
                            />
                        )}
                        {status !== 'error' && status !== 'warning' && (
                            <CheckCircle
                                size={24}
                                className="text-green-600 shrink-0"
                                title="System compatible"
                                aria-label="Array status: good"
                            />
                        )}
                    </h2>
                    <p className="text-slate-500 mb-2">
                        {array.orientation} Roof Direction • {array.count} Panels •{' '}
                        {array.mounting === 'In-Roof (GSE)'
                            ? `${array.format} Orientation (GSE)`
                            : array.mounting}
                    </p>
                    {divisors.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 font-medium">
                                Wiring Configuration:
                            </span>
                            <select
                                className="text-sm font-medium border border-slate-300 rounded-md px-2 py-1 bg-blue-50 text-blue-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={array.parallelStrings || 1}
                                onChange={(e) =>
                                    updateArray(arrayId, 'parallelStrings', parseInt(e.target.value, 10))
                                }
                                title="Series / Parallel String Wiring"
                            >
                                {divisors.map((d) => (
                                    <option key={d} value={d}>
                                        {array.count / d}S{d}P ({array.count / d} Series x {d} Parallel)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex space-x-8 text-right">
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">
                            Peak Power
                        </p>
                        <p className="text-3xl font-light text-blue-600">
                            {peakPower.toLocaleString()} <span className="text-xl">W</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">
                            Total Cost / kWp
                        </p>
                        <p className="text-3xl font-light text-slate-800">£{costPerKWp.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">
                            Total Array Cost
                        </p>
                        <p className="text-3xl font-light text-slate-800">£{cost.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="flex border-b border-slate-300 mb-6">
                <button
                    onClick={() =>
                        setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'overview' }))
                    }
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                        contentTab === 'overview'
                            ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    Array Overview
                </button>
                <button
                    onClick={() =>
                        setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'panels' }))
                    }
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                        contentTab === 'panels'
                            ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    Panel Selector
                </button>
                <button
                    onClick={() =>
                        setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'controllers' }))
                    }
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                        contentTab === 'controllers'
                            ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    Controller Selector
                </button>
            </div>

            {contentTab === 'overview' && (
            <>
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <div
                            className={`bg-white p-4 rounded-lg border shadow-sm flex justify-between items-center ${!panel ? 'border-blue-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors' : 'border-slate-200'}`}
                            onClick={!panel ? () => setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'panels' })) : undefined}
                            onKeyDown={!panel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'panels' })); } } : undefined}
                            role={!panel ? 'button' : undefined}
                            tabIndex={!panel ? 0 : undefined}
                            title={!panel ? 'Go to Panel Selector' : undefined}
                        >
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Panel
                                </span>
                                {panel ? (
                                    <span className="text-sm font-bold text-slate-800">
                                        {panel.name} ({panel.power}W)
                                    </span>
                                ) : (
                                    <span className="text-sm font-bold text-blue-600">
                                        Select Panel
                                    </span>
                                )}
                            </div>
                            {panel && (
                                <button
                                    onClick={() => updateSelection(arrayId, 'panel', '')}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Clear Panel Selection"
                                    aria-label="Clear panel selection"
                                >
                                    <XIcon size={16} />
                                </button>
                            )}
                        </div>
                        {panelsData.some(
                            (p) => p.active !== false && !isCompatibleFormat(array, p)
                        ) && (
                                <p className="text-xs text-slate-400 mt-2 italic">
                                    Some panels in the database are hidden as they physically conflict with this
                                    array's GSE requirements.
                                </p>
                            )}
                    </div>

                    <div>
                        <div
                            className={`bg-white p-4 rounded-lg border shadow-sm flex justify-between items-center ${!controller ? 'border-blue-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors' : 'border-slate-200'}`}
                            onClick={!controller ? () => setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'controllers' })) : undefined}
                            onKeyDown={!controller ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveArrayContentTab((prev) => ({ ...prev, [arrayId]: 'controllers' })); } } : undefined}
                            role={!controller ? 'button' : undefined}
                            tabIndex={!controller ? 0 : undefined}
                            title={!controller ? 'Go to Controller Selector' : undefined}
                        >
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Controller
                                </span>
                                {controller ? (
                                    <span className="text-sm font-bold text-slate-800">
                                        {controller.manufacturer ? `${controller.manufacturer} ${controller.name}` : controller.name}
                                    </span>
                                ) : (
                                    <span className="text-sm font-bold text-blue-600">
                                        Select Controller
                                    </span>
                                )}
                            </div>
                            {controller && (
                                <button
                                    onClick={() => updateSelection(arrayId, 'clearController')}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Clear Controller Selection"
                                    aria-label="Clear controller selection"
                                >
                                    <XIcon size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div
                        className={`p-4 rounded-lg border-l-4 ${status === 'error'
                                ? 'bg-red-50 border-red-500'
                                : status === 'warning'
                                    ? 'bg-orange-50 border-orange-500'
                                    : 'bg-green-50 border-green-500'
                            }`}
                    >
                        <div className="flex items-start">
                            {status === 'error' ? (
                                <AlertTriangle className="text-red-500 mr-3 mt-1" size={20} />
                            ) : status === 'warning' ? (
                                <AlertTriangle className="text-orange-500 mr-3 mt-1" size={20} />
                            ) : (
                                <CheckCircle className="text-green-500 mr-3 mt-1" size={20} />
                            )}
                            <div>
                                <h4
                                    className={`font-bold ${status === 'error'
                                            ? 'text-red-800'
                                            : status === 'warning'
                                                ? 'text-orange-800'
                                                : 'text-green-800'
                                        }`}
                                >
                                    {status === 'error'
                                        ? 'System Failure Detected'
                                        : status === 'warning'
                                            ? 'Warning'
                                            : 'System Compatible '}
                                </h4>
                                <ul className="mt-1 space-y-1">
                                    {messages.map((msg, i) => (
                                        <li
                                            key={i}
                                            className={`text-sm ${status === 'error'
                                                    ? 'text-red-700'
                                                    : status === 'warning'
                                                        ? 'text-orange-700'
                                                        : 'text-green-700'
                                                }`}
                                        >
                                            {msg}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {panel && (
                        <div className="grid grid-cols-3 gap-4">
                            <div
                                className="bg-white p-4 rounded-lg shadow-sm border border-slate-200"
                                title="Open-circuit voltage of the string at −10°C. Uses panel tempCoefVoc when available, else string Voc (STC) × 1.084. Must stay below your MPPT's maximum PV input to avoid damage."
                            >
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Cold Voc (-10°C)
                                </p>
                                <p
                                    className={`text-2xl font-light ${controller && coldVoc > controller.maxV
                                            ? 'text-red-600 font-bold'
                                            : 'text-slate-800'
                                        }`}
                                >
                                    {coldVoc.toFixed(1)} <span className="text-sm">V</span>
                                </p>
                                {controller ? (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Controller Limit: {controller.maxV}V
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Select a controller to compare limits
                                    </p>
                                )}
                            </div>
                            <div
                                className="bg-white p-4 rounded-lg shadow-sm border border-slate-200"
                                title="Maximum power point voltage of the string at 65°C. Uses panel tempCoefPmax when available to derive Vmp factor, else string Vmp (STC) × 0.9. Must stay above your MPPT's minimum startup voltage or it won't operate."
                            >
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Hot Vmp (65°C)
                                </p>
                                <p
                                    className={`text-2xl font-light ${controller && effectiveStartupV != null && hotVmp < effectiveStartupV
                                            ? 'text-red-600 font-bold'
                                            : 'text-slate-800'
                                        }`}
                                >
                                    {hotVmp.toFixed(1)} <span className="text-sm">V</span>
                                </p>
                                {controller && effectiveStartupV != null ? (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Required to Start: {effectiveStartupV}V
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Select a controller to compare limits
                                    </p>
                                )}
                            </div>
                            <div
                                className="bg-white p-4 rounded-lg shadow-sm border border-slate-200"
                                title="Short-circuit current at 65°C (hot). Calculated as string Isc (STC) × (1 + 40 × tempCoefIsc/100). Must not exceed the MPPT's max Isc."
                            >
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Array Isc (Hot 65°C)
                                </p>
                                <p
                                    className={`text-2xl font-light ${controller && arrayIscHot > controller.maxIsc
                                            ? 'text-red-600 font-bold'
                                            : 'text-slate-800'
                                        }`}
                                >
                                    {arrayIscHot.toFixed(2)} <span className="text-sm">A</span>
                                </p>
                                {controller ? (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Controller Limit: {controller.maxIsc}A
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Select a controller to compare limits
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {panel && (
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6 mb-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                        <Info size={16} className="mr-2 text-blue-600" />
                        Panel: <span className="ml-2 font-normal">{panel.name}</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{panel.power} W</span>
                        <span className="text-sm font-medium text-slate-600">£{panel.price} per unit</span>
                        {panel.datasheetUrl && (
                            <a href={panel.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
                                <ExternalLink size={12} className="mr-1" /> Datasheet
                            </a>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="bg-white p-3 rounded border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Physical specifications</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-slate-500">Dimensions</dt><dd className="text-slate-800 font-medium">{panel.height || '—'} × {panel.width || '—'} mm</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Depth</dt><dd className="text-slate-800 font-medium">{panel.depth != null ? `${panel.depth} mm` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Weight</dt><dd className="text-slate-800 font-medium">{panel.weight ? `${panel.weight} kg` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Glass</dt><dd className="text-slate-800 font-medium">{panel.glass || '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Bifacial</dt><dd className="text-slate-800 font-medium">{panel.bifacial ? 'Yes' : 'No'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Cells</dt><dd className="text-slate-800 font-medium">{panel.cells || '—'}</dd></div>
                            </dl>
                        </div>
                        <div className="bg-white p-3 rounded border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Electrical (STC)</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-slate-500">Efficiency</dt><dd className="text-slate-800 font-medium text-blue-700">{panel.efficiency ? `${panel.efficiency}%` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Voc</dt><dd className="text-slate-800 font-medium">{panel.voc} V</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Vmp</dt><dd className="text-slate-800 font-medium">{panel.vmp} V</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Isc</dt><dd className="text-slate-800 font-medium">{panel.isc} A</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Imp</dt><dd className="text-slate-800 font-medium">{panel.imp != null ? `${panel.imp} A` : '—'}</dd></div>
                            </dl>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-3 mb-2 border-b border-slate-100 pb-1">Temp. coeff. (%/°C)</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-slate-500">Pmax</dt><dd className="text-slate-800 font-medium">{panel.tempCoefPmax != null ? `${panel.tempCoefPmax}%` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Voc</dt><dd className="text-slate-800 font-medium">{panel.tempCoefVoc != null ? `${panel.tempCoefVoc}%` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Isc</dt><dd className="text-slate-800 font-medium">{panel.tempCoefIsc != null ? `${panel.tempCoefIsc}%` : '—'}</dd></div>
                            </dl>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-3 mb-2 border-b border-slate-100 pb-1">Safety / limits</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-slate-500">Max series fuse</dt><dd className="text-slate-800 font-medium">{panel.maxSeriesFuse != null ? `${panel.maxSeriesFuse} A` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Max system V</dt><dd className="text-slate-800 font-medium">{panel.maxSystemVoltage != null ? `${panel.maxSystemVoltage} V` : '—'}</dd></div>
                            </dl>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8 items-stretch">
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Engineering Notes
                            </p>
                            <p className="text-xs text-slate-400 italic mb-2">AI generated, may not be accurate.</p>
                            <div className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200 shadow-inner flex-1">
                                {panel.notes || 'No specific architectural notes for this module.'}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end">
                                <span>Your Notes</span>
                                <span className="text-slate-400 text-[10px] normal-case font-normal">
                                    Autosaves
                                </span>
                            </p>
                            <textarea
                                className="flex-1 w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]"
                                placeholder="Log supplier quotes, lead times, compatibility thoughts, or personal preferences here..."
                                value={userNotes[panel.model] || ''}
                                onChange={(e) => updateUserNote(panel.model, e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {controller && (
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                        <Info size={16} className="mr-2 text-emerald-600" />
                        Controller: <span className="ml-2 font-normal">{controller.manufacturer ? `${controller.manufacturer} ${controller.name}` : controller.name}</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${controller.type === 'hybrid_inverter' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {controller.type === 'hybrid_inverter' ? 'Hybrid Inverter' : 'Charger'}
                        </span>
                        <span className="text-sm font-medium text-slate-600">£{controller.price || 0} per unit</span>
                        {controller.datasheetUrl && (
                            <a href={controller.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
                                <ExternalLink size={12} className="mr-1" /> Datasheet
                            </a>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                        <div className="bg-white p-3 rounded border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Input specifications</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-slate-500">Max PV Voltage</dt><dd className="text-red-700 font-bold">{controller.maxV} V</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Startup Voltage</dt><dd className="text-slate-800 font-medium">{effectiveStartupV != null ? `${effectiveStartupV} V` : '—'}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-500">Max Isc</dt><dd className="text-slate-800 font-medium">{controller.maxIsc ?? 'N/A'} A</dd></div>
                            </dl>
                        </div>
                        <div className="bg-white p-3 rounded border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">System compatibility</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between"><dt className="text-slate-500">Battery voltages</dt><dd className="text-slate-800 font-medium">{(controller.systemVoltages || [48]).join('V, ')}V</dd></div>
                            </dl>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-3 mb-2 border-b border-slate-100 pb-1">UK grid certifications</h4>
                            <div className="flex flex-wrap gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${controller.g98_cert ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                                    {controller.g98_cert ? <CheckCircle size={12} /> : <XIcon size={12} />} G98
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${controller.g99_cert ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                                    {controller.g99_cert ? <CheckCircle size={12} /> : <XIcon size={12} />} G99
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${controller.g100_cert ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                                    {controller.g100_cert ? <CheckCircle size={12} /> : <XIcon size={12} />} G100
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8 items-stretch">
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Engineering Notes
                            </p>
                            <p className="text-xs text-slate-400 italic mb-2">AI generated, may not be accurate.</p>
                            <div className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200 shadow-inner flex-1">
                                {controller.notes ||
                                    'No specific architectural notes for this controller.'}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end">
                                <span>Your Notes</span>
                                <span className="text-slate-400 text-[10px] normal-case font-normal">
                                    Autosaves
                                </span>
                            </p>
                            <textarea
                                className="flex-1 w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]"
                                placeholder="Log supplier quotes, lead times, compatibility thoughts, or personal preferences here..."
                                value={userNotes[controller.id] || ''}
                                onChange={(e) => updateUserNote(controller.id, e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <Info size={16} className="mr-2 text-indigo-600" />
                    Array Notes: <span className="ml-2 font-normal">{array.name}</span>
                </h3>
                <div className="flex flex-col">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end">
                        <span>Your Notes</span>
                        <span className="text-slate-400 text-[10px] normal-case font-normal">
                            Autosaves
                        </span>
                    </p>
                    <textarea
                        className="w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]"
                        placeholder="Log installation notes, conduit routing, shading issues, or specific array details here..."
                        value={userNotes[`array_${array.id}`] || ''}
                        onChange={(e) => updateUserNote(`array_${array.id}`, e.target.value)}
                    />
                </div>
            </div>

            {panel && (
                <ArrayOverviewGraphs
                    panel={panel}
                    array={array}
                    controller={controller}
                    effectiveStartupV={effectiveStartupV}
                />
            )}
            </>
            )}

            {contentTab === 'panels' && (() => {
                        const peakPowerVals = validPanels.map((p) => p.peakPower);
                        const coldVocVals = validPanels.map((p) => p.coldVoc);
                        const hotVmpVals = validPanels.map((p) => p.hotVmp);
                        const arrayIscHotVals = validPanels.map((p) => p.arrayIscHot);
                        const costPerKWpVals = validPanels.map((p) => p.costPerKWp);
                        const panelCostVals = validPanels.map((p) => p.panelCost);
                        const widthVals = validPanels.map((p) => p.width).filter((v) => v != null);
                        const heightVals = validPanels.map((p) => p.height).filter((v) => v != null);
                        const weightVals = validPanels.map((p) => p.weight).filter((v) => v != null);
                        const min = (arr) => (arr.length ? Math.min(...arr) : 0);
                        const max = (arr) => (arr.length ? Math.max(...arr) : 0);
                        const col = {
                            peakPower: [min(peakPowerVals), max(peakPowerVals)],
                            coldVoc: [min(coldVocVals), max(coldVocVals)],
                            hotVmp: [min(hotVmpVals), max(hotVmpVals)],
                            arrayIscHot: [min(arrayIscHotVals), max(arrayIscHotVals)],
                            costPerKWp: [min(costPerKWpVals), max(costPerKWpVals)],
                            panelCost: [min(panelCostVals), max(panelCostVals)],
                            width: [min(widthVals), max(widthVals)],
                            height: [min(heightVals), max(heightVals)],
                            weight: [min(weightVals), max(weightVals)],
                        };
                        const ratio = (val, [mn, mx]) =>
                            val == null || mn === mx ? (mn === mx && val != null ? 1 : 0) : (Number(val) - mn) / (mx - mn);
                        const barStyle = (r, incompatible) => {
                            const cellBg = incompatible ? '#fee2e2' : '#ffffff';
                            const barPct = Math.min(100, Math.max(0, r * 100));
                            return { cellBg, barPct };
                        };
                        return (
                    <div>
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    Compatible Panels Explorer
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {controller
                                        ? `Showing active panels that pass physical limits and strictly match the ${controller.name} limits.`
                                        : 'Showing active panels that pass physical limits (select a controller to see electrical compatibility).'}
                                </p>
                            </div>
                            <div className="flex items-stretch space-x-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex flex-col justify-center space-y-1 pr-4 border-r border-slate-200">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                        Max Allowed Dimensions & Weight
                                    </p>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            placeholder="Length (mm)"
                                            title="Maximum Panel Length (mm)"
                                            className="w-24 p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                            value={array.maxPanelHeight || ''}
                                            onChange={(e) =>
                                                updateArray(array.id, 'maxPanelHeight', parseInt(e.target.value) || '')
                                            }
                                        />
                                        <span className="text-slate-400 text-xs">x</span>
                                        <input
                                            type="number"
                                            placeholder="Width (mm)"
                                            title="Maximum Panel Width (mm)"
                                            className="w-24 p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                            value={array.maxPanelWidth || ''}
                                            onChange={(e) =>
                                                updateArray(array.id, 'maxPanelWidth', parseInt(e.target.value) || '')
                                            }
                                        />
                                        <span className="text-slate-400 text-xs">|</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Max weight (kg)"
                                            title="Maximum Panel Weight (kg)"
                                            className="w-24 p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                            value={array.maxPanelWeight ?? ''}
                                            onChange={(e) =>
                                                updateArray(
                                                    array.id,
                                                    'maxPanelWeight',
                                                    e.target.value === '' ? '' : parseFloat(e.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center space-y-2 pl-2">
                                    <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                                            checked={hideHeavyPanels}
                                            onChange={(e) => setHideHeavyPanels(e.target.checked)}
                                        />
                                        <span>Hide panels over 25kg</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                                            checked={hideMarginalPanels}
                                            onChange={(e) => setHideMarginalPanels(e.target.checked)}
                                        />
                                        <span>Hide marginal voltage risks</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                                            checked={hideIncompatiblePanels}
                                            onChange={(e) => setHideIncompatiblePanels(e.target.checked)}
                                        />
                                        <span>Hide incompatible options</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="w-full text-left border-collapse relative text-xs">
                                    <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-sm">
                                        <tr>
                                            <th
                                                onClick={() => togglePanelSort('name')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                            >
                                                Panel Name{' '}
                                                {panelSort.key === 'name' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('peakPower')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                            >
                                                kWp{' '}
                                                {panelSort.key === 'peakPower' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('coldVoc')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                title="Open-circuit voltage of the string at −10°C"
                                            >
                                                Voc Cold{' '}
                                                {panelSort.key === 'coldVoc' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('hotVmp')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                title="Maximum power point voltage of the string at 65°C"
                                            >
                                                Hot Vmp{' '}
                                                {panelSort.key === 'hotVmp' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('arrayIscHot')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                title="Short-circuit current at 65°C (hot)"
                                            >
                                                Isc Hot{' '}
                                                {panelSort.key === 'arrayIscHot' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('width')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                title="Panel width (mm)"
                                            >
                                                Width{' '}
                                                {panelSort.key === 'width' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('height')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                title="Panel height (mm)"
                                            >
                                                Height{' '}
                                                {panelSort.key === 'height' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('weight')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                title="Panel weight (kg)"
                                            >
                                                Weight{' '}
                                                {panelSort.key === 'weight' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('costPerKWp')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                            >
                                                £/kWp{' '}
                                                {panelSort.key === 'costPerKWp' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => togglePanelSort('panelCost')}
                                                className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                            >
                                                £ Total{' '}
                                                {panelSort.key === 'panelCost' &&
                                                    (panelSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validPanels.length > 0 ? (
                                            validPanels.map((p) => {
                                                const isSelected =
                                                    (selections[arrayId]?.panel) === p.model;
                                                const incompatibleBg = !p.isFullyCompatible ? 'bg-red-100' : '';
                                                const inc = !!incompatibleBg;
                                                return (
                                                    <tr
                                                        key={p.model}
                                                        className={`border-b border-slate-100 transition-colors ${
                                                            isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <td className={`py-2 px-3 border-r border-slate-200/70 ${incompatibleBg}`}>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span>{p.name}</span>
                                                                <button
                                                                    onClick={() =>
                                                                        setInfoModalPanelId(p.model)
                                                                    }
                                                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title="View Technical Specs"
                                                                    aria-label="View technical specs"
                                                                >
                                                                    <Info size={16} />
                                                                </button>
                                                                {p.datasheetUrl && (
                                                                    <a
                                                                        href={p.datasheetUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-slate-400 hover:text-blue-600 transition-colors"
                                                                        title="View Manufacturer Datasheet"
                                                                        aria-label="View manufacturer datasheet"
                                                                    >
                                                                        <ExternalLink size={16} />
                                                                    </a>
                                                                )}
                                                                {p.isVocWarn && (
                                                                    <AlertTriangle
                                                                        size={16}
                                                                        className="text-orange-500"
                                                                        title="Voltage Warning: Cold Voc is within 6% of MPPT limit. Margin is dangerously tight."
                                                                    />
                                                                )}
                                                                <BuyButton buyLinks={p.buyLinks} />
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 font-medium text-blue-700 relative border-r border-slate-200/70" style={{ background: barStyle(ratio(p.peakPower, col.peakPower), inc).cellBg }}>
                                                            {barStyle(ratio(p.peakPower, col.peakPower), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.peakPower, col.peakPower), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.peakPower.toLocaleString()} W</span>
                                                        </td>
                                                        <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!p.isVocOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(p.coldVoc, col.coldVoc), inc).cellBg }}>
                                                            {barStyle(ratio(p.coldVoc, col.coldVoc), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.coldVoc, col.coldVoc), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.coldVoc.toFixed(1)} V</span>
                                                        </td>
                                                        <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!p.isVmpOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(p.hotVmp, col.hotVmp), inc).cellBg }}>
                                                            {barStyle(ratio(p.hotVmp, col.hotVmp), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.hotVmp, col.hotVmp), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.hotVmp.toFixed(1)} V</span>
                                                        </td>
                                                        <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!p.isIscOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(p.arrayIscHot, col.arrayIscHot), inc).cellBg }}>
                                                            {barStyle(ratio(p.arrayIscHot, col.arrayIscHot), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.arrayIscHot, col.arrayIscHot), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.arrayIscHot.toFixed(2)} A</span>
                                                        </td>
                                                        <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!p.isWidthOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(p.width, col.width), inc).cellBg }}>
                                                            {barStyle(ratio(p.width, col.width), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.width, col.width), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.width != null ? `${p.width} mm` : '—'}</span>
                                                        </td>
                                                        <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!p.isHeightOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(p.height, col.height), inc).cellBg }}>
                                                            {barStyle(ratio(p.height, col.height), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.height, col.height), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.height != null ? `${p.height} mm` : '—'}</span>
                                                        </td>
                                                        <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!p.isWeightOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(p.weight, col.weight), inc).cellBg }}>
                                                            {barStyle(ratio(p.weight, col.weight), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.weight, col.weight), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">{p.weight != null ? `${p.weight} kg` : '—'}</span>
                                                        </td>
                                                        <td className="py-2 px-3 relative border-r border-slate-200/70" style={{ background: barStyle(ratio(p.costPerKWp, col.costPerKWp), inc).cellBg }}>
                                                            {barStyle(ratio(p.costPerKWp, col.costPerKWp), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.costPerKWp, col.costPerKWp), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">£{p.costPerKWp.toFixed(2)}</span>
                                                        </td>
                                                        <td className="py-2 px-3 relative border-r border-slate-200/70" style={{ background: barStyle(ratio(p.panelCost, col.panelCost), inc).cellBg }}>
                                                            {barStyle(ratio(p.panelCost, col.panelCost), inc).barPct > 0 && (
                                                                <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(p.panelCost, col.panelCost), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                            )}
                                                            <span className="relative z-10">£{p.panelCost.toLocaleString()}</span>
                                                        </td>
                                                        <td className={`py-2 px-3 text-right ${incompatibleBg}`}>
                                                            {isSelected ? (
                                                                <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                                                    <CheckCircle
                                                                        size={14}
                                                                        className="mr-1"
                                                                    />{' '}
                                                                    Selected
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() =>
                                                                        updateSelection(
                                                                            arrayId,
                                                                            'panel',
                                                                            p.model
                                                                        )
                                                                    }
                                                                    className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                                                                        p.isFullyCompatible
                                                                            ? 'bg-white border border-slate-300 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                                                                            : 'bg-red-50 border border-red-400 text-red-700 hover:bg-red-100 hover:border-red-600'
                                                                    }`}
                                                                >
                                                                    Select Panel
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan="11"
                                                    className="py-8 px-4 text-center text-slate-500 italic"
                                                >
                                                    <AlertTriangle
                                                        className="mx-auto mb-2 text-slate-400"
                                                        size={24}
                                                    />
                                                    No active panels meet both the physical format and the
                                                    electrical constraints of the currently selected MPPT.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })()}


            {contentTab === 'controllers' && (
                    <div className="space-y-8">
                        {areaControllers.length > 0 && (
                            <div>
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Available Area Controllers ({array.area})
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        Pick an MPPT port on an existing controller already added to this
                                        area.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {areaControllers.map((sc) => {
                                        const model = chargersData.find((c) => c.id === sc.modelId);
                                        if (!model) return null;
                                        let isElectricalValid = true;
                                        if (panel) {
                                            const isVoltageOk = coldVoc <= model.maxV;
                                            const isStartupOk = hotVmp >= getEffectiveStartupV(model, systemVoltage);
                                            const isCurrentOk = arrayIscHot <= model.maxIsc;
                                            isElectricalValid =
                                                isVoltageOk && isStartupOk && isCurrentOk;
                                        }
                                        const assignments = {};
                                        for (let i = 1; i <= model.trackers; i++) {
                                            assignments[i] = Object.entries(selections).find(
                                                ([arrId, sel]) =>
                                                    sel.controllerInstanceId === sc.id &&
                                                    sel.controllerMppt === i
                                            )?.[0];
                                        }
                                        return (
                                            <div
                                                key={sc.id}
                                                className={`p-4 rounded-lg border ${isElectricalValid
                                                        ? 'bg-white border-slate-200'
                                                        : 'bg-slate-50 border-slate-200 opacity-60'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-bold text-slate-800">
                                                        {sc.name}
                                                    </div>
                                                    {Object.values(assignments).every((val) => !val) && (
                                                        <button
                                                            onClick={() =>
                                                                deleteControllerInstance(sc.id)
                                                            }
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                                                            title="Delete empty controller from site"
                                                            aria-label="Delete empty controller from site"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mb-3">
                                                    {model.manufacturer} • {model.trackers} MPPTs
                                                </div>
                                                {!isElectricalValid && (
                                                    <div className="text-xs text-red-500 mb-3 font-semibold">
                                                        <AlertTriangle
                                                            size={12}
                                                            className="inline mr-1"
                                                        />
                                                        Incompatible with this array's electrical
                                                        properties.
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    {Array.from({ length: model.trackers }).map(
                                                        (_, idx) => {
                                                            const mpptIdx = idx + 1;
                                                            const assignedArrayId = assignments[mpptIdx];
                                                            const isBoundToCurrentArray =
                                                                assignedArrayId === arrayId;
                                                            return (
                                                                <div
                                                                    key={mpptIdx}
                                                                    className="flex items-center justify-between text-sm"
                                                                >
                                                                    <span className="font-medium text-slate-600">
                                                                        MPPT {mpptIdx}
                                                                    </span>
                                                                    {isBoundToCurrentArray ? (
                                                                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                                                                            <CheckCircle
                                                                                size={12}
                                                                                className="mr-1"
                                                                            />{' '}
                                                                            Selected
                                                                        </span>
                                                                    ) : assignedArrayId ? (
                                                                        <span className="text-xs text-slate-400 italic">
                                                                            Used by{' '}
                                                                            {arraysData.find(
                                                                                (a) =>
                                                                                    a.id === assignedArrayId
                                                                            )?.name || assignedArrayId}
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            disabled={
                                                                                !isElectricalValid
                                                                            }
                                                                            onClick={() =>
                                                                                updateSelection(
                                                                                    arrayId,
                                                                                    'controllerInstance',
                                                                                    sc.id,
                                                                                    mpptIdx
                                                                                )
                                                                            }
                                                                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${isElectricalValid
                                                                                    ? 'bg-white border border-slate-300 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                                                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                                                                }`}
                                                                        >
                                                                            Assign
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Add New PV Controller from Database
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {panel ? (
                                            `Showing models that handle strictly the electrical limits of ${array.count}x ${panel.name}. Selecting one will create a new physical unit.`
                                        ) : (
                                            'Showing all active models. Select a panel above to filter by electrical limits.'
                                        )}
                                    </p>
                                </div>
                                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                                        checked={hideIncompatibleControllers}
                                        onChange={(e) => setHideIncompatibleControllers(e.target.checked)}
                                    />
                                    <span>Hide incompatible options</span>
                                </label>
                            </div>
                            {(() => {
                                const list = sortedControllersList;
                                const maxVVals = list.map((c) => c.maxV);
                                const maxIscVals = list.map((c) => c.maxIsc);
                                const priceVals = list.map((c) => c.price ?? 0);
                                const min = (arr) => (arr.length ? Math.min(...arr) : 0);
                                const max = (arr) => (arr.length ? Math.max(...arr) : 0);
                                const col = {
                                    maxV: [min(maxVVals), max(maxVVals)],
                                    maxIsc: [min(maxIscVals), max(maxIscVals)],
                                    price: [min(priceVals), max(priceVals)],
                                };
                                const ratio = (val, [mn, mx]) =>
                                    val == null || mn === mx ? (mn === mx && val != null ? 1 : 0) : (Number(val) - mn) / (mx - mn);
                                const barStyle = (r, incompatible) => {
                                    const cellBg = incompatible ? '#fee2e2' : '#ffffff';
                                    const barPct = Math.min(100, Math.max(0, r * 100));
                                    return { cellBg, barPct };
                                };
                                return (
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <div className="max-h-[600px] overflow-y-auto">
                                    <table className="w-full text-left border-collapse relative text-xs">
                                        <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-sm">
                                            <tr>
                                                <th
                                                    onClick={() => toggleControllerSort('name')}
                                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                >
                                                    Controller Model{' '}
                                                    {controllerSort.key === 'name' &&
                                                        (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                                </th>
                                                <th
                                                    onClick={() => toggleControllerSort('maxV')}
                                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                >
                                                    PV Vmax{' '}
                                                    {controllerSort.key === 'maxV' &&
                                                        (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                                </th>
                                                <th
                                                    onClick={() => toggleControllerSort('maxIsc')}
                                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                >
                                                    Max Isc{' '}
                                                    {controllerSort.key === 'maxIsc' &&
                                                        (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                                </th>
                                                <th
                                                    onClick={() => toggleControllerSort('price')}
                                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                                >
                                                    Price{' '}
                                                    {controllerSort.key === 'price' &&
                                                        (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                                </th>
                                                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.length > 0 ? (
                                                list.map((c) => {
                                                    const isSelected =
                                                        selections[arrayId]?.controller &&
                                                        chargersData.find(
                                                            (x) => x.id === selections[arrayId].controller
                                                        )?.id === c.id &&
                                                        !selections[arrayId].controllerInstanceId;
                                                    const incompatibleBg = !c.isFullyCompatible ? 'bg-red-100' : '';
                                                    const inc = !!incompatibleBg;
                                                    return (
                                                        <tr
                                                            key={c.id}
                                                            className={`border-b border-slate-100 transition-colors ${isSelected
                                                                    ? 'bg-blue-50/50'
                                                                    : 'hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <td className={`py-2 px-3 border-r border-slate-200/70 ${incompatibleBg}`}>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-medium text-slate-800">
                                                                        {c.name}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">
                                                                        ({c.manufacturer})
                                                                    </span>
                                                                    <button
                                                                        onClick={() =>
                                                                            setInfoModalChargerId(c.id)
                                                                        }
                                                                        className="text-slate-400 hover:text-blue-600 transition-colors"
                                                                        title="View Technical Specs"
                                                                        aria-label="View technical specs"
                                                                    >
                                                                        <Info size={16} />
                                                                    </button>
                                                                    {c.datasheetUrl && (
                                                                        <a
                                                                            href={c.datasheetUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-slate-400 hover:text-blue-600 transition-colors"
                                                                            title="View Manufacturer Datasheet"
                                                                            aria-label="View manufacturer datasheet"
                                                                        >
                                                                            <ExternalLink size={16} />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!c.isVoltageOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(c.maxV, col.maxV), inc).cellBg }}>
                                                                {barStyle(ratio(c.maxV, col.maxV), inc).barPct > 0 && (
                                                                    <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(c.maxV, col.maxV), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                                )}
                                                                <span className="relative z-10">{c.maxV} V</span>
                                                            </td>
                                                            <td className={`py-2 px-3 relative border-r border-slate-200/70 ${!c.isCurrentOk ? 'font-bold text-red-600' : 'text-slate-700'}`} style={{ background: barStyle(ratio(c.maxIsc, col.maxIsc), inc).cellBg }}>
                                                                {barStyle(ratio(c.maxIsc, col.maxIsc), inc).barPct > 0 && (
                                                                    <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(c.maxIsc, col.maxIsc), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                                )}
                                                                <span className="relative z-10">{c.maxIsc} A</span>
                                                            </td>
                                                            <td className="py-2 px-3 font-medium text-blue-700 relative border-r border-slate-200/70" style={{ background: barStyle(ratio(c.price, col.price), inc).cellBg }}>
                                                                {barStyle(ratio(c.price, col.price), inc).barPct > 0 && (
                                                                    <span className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none" style={{ width: `${barStyle(ratio(c.price, col.price), inc).barPct}%`, background: 'rgba(0,0,0,0.08)' }} />
                                                                )}
                                                                <span className="relative z-10">£{c.price}</span>
                                                            </td>
                                                            <td className={`py-2 px-3 text-right ${incompatibleBg}`}>
                                                                <button
                                                                    onClick={() => {
                                                                        const newInstId =
                                                                            createControllerInstance(
                                                                                c.id,
                                                                                array.area
                                                                            );
                                                                        updateSelection(
                                                                            arrayId,
                                                                            'controllerInstance',
                                                                            newInstId,
                                                                            1
                                                                        );
                                                                    }}
                                                                    className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                                                                        c.isFullyCompatible
                                                                            ? 'bg-white border border-slate-300 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                                                                            : 'bg-red-50 border border-red-400 text-red-700 hover:bg-red-100 hover:border-red-600'
                                                                    }`}
                                                                >
                                                                    Add New Instance
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan="5"
                                                        className="py-8 px-4 text-center text-slate-500 italic"
                                                    >
                                                        <AlertTriangle
                                                            className="mx-auto mb-2 text-slate-400"
                                                            size={24}
                                                        />
                                                        No PV controllers meet the electrical limits of
                                                        your selected panel config in this array.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                                );
                            })()}
                        </div>
                    </div>
            )}
        </div>
    );
}
