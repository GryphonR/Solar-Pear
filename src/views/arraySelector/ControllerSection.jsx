import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, ExternalLink, Trash2 } from '../../components/Icons';
import BarCell from '../../components/BarCell';
import { getEffectiveStartupV } from '../../lib/arrayAnalysis';

export default function ControllerSection({
    areaControllers,
    arraysData,
    chargersData,
    selections,
    arrayId,
    array,
    panel,
    coldVoc,
    hotVmp,
    arrayIscHot,
    systemVoltage,
    areaSettings,
    updateAreaSettings,
    sortedControllersList,
    controllerSort,
    toggleControllerSort,
    hideIncompatibleControllers,
    setHideIncompatibleControllers,
    updateSelection,
    createControllerInstance,
    deleteControllerInstance,
    setInfoModalChargerId,
}) {
    const setAreaSystemVoltage = (value) =>
        updateAreaSettings?.(array.area, { systemVoltage: value });
    const setAreaSystemType = (value) =>
        updateAreaSettings?.(array.area, {
            systemType: value,
            filterEps: value === 'grid-connected' ? areaSettings.filterEps : false,
            filterHouseBackup: value === 'grid-connected' ? areaSettings.filterHouseBackup : false,
        });
    const toggleAreaEps = () =>
        updateAreaSettings?.(array.area, { filterEps: !areaSettings.filterEps });
    const toggleAreaHouseBackup = () =>
        updateAreaSettings?.(array.area, {
            filterHouseBackup: !areaSettings.filterHouseBackup,
        });

    const col = useMemo(() => {
        const list = sortedControllersList;
        const maxVVals = list.map((c) => c.maxV);
        const maxIscVals = list.map((c) => c.maxIsc);
        const priceVals = list.map((c) => c.price ?? 0);
        const min = (arr) => (arr.length ? Math.min(...arr) : 0);
        const max = (arr) => (arr.length ? Math.max(...arr) : 0);
        return {
            maxV: [min(maxVVals), max(maxVVals)],
            maxIsc: [min(maxIscVals), max(maxIscVals)],
            price: [min(priceVals), max(priceVals)],
        };
    }, [sortedControllersList]);

    return (
        <div className="space-y-8">
            {areaControllers.length > 0 && (
                <div>
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">
                            Available Area Controllers ({array.area})
                        </h3>
                        <p className="text-sm text-slate-500">
                            Pick an MPPT port on an existing controller already added to this area.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {areaControllers.map((sc) => {
                            const model = chargersData.find((c) => c.id === sc.modelId);
                            if (!model) return null;
                            let isElectricalValid = true;
                            if (panel && coldVoc != null && hotVmp != null && arrayIscHot != null) {
                                isElectricalValid =
                                    coldVoc <= model.maxV &&
                                    hotVmp >= getEffectiveStartupV(model, systemVoltage) &&
                                    arrayIscHot <= model.maxIsc;
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
                                    className={`p-4 rounded-lg border ${
                                        isElectricalValid
                                            ? 'bg-white border-slate-200'
                                            : 'bg-slate-50 border-slate-200 opacity-60'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-slate-800">{sc.name}</div>
                                        {Object.values(assignments).every((val) => !val) && (
                                            <button
                                                onClick={() => deleteControllerInstance(sc.id)}
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
                                            <AlertTriangle size={12} className="inline mr-1" />
                                            Incompatible with this array's electrical properties.
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {Array.from({ length: model.trackers }).map((_, idx) => {
                                            const mpptIdx = idx + 1;
                                            const assignedArrayId = assignments[mpptIdx];
                                            const isBoundToCurrentArray = assignedArrayId === arrayId;
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
                                                            <CheckCircle size={12} className="mr-1" /> Selected
                                                        </span>
                                                    ) : assignedArrayId ? (
                                                        <span className="text-xs text-slate-400 italic">
                                                            Used by{' '}
                                                            {arraysData.find((a) => a.id === assignedArrayId)
                                                                ?.name || assignedArrayId}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            disabled={!isElectricalValid}
                                                            onClick={() =>
                                                                updateSelection(
                                                                    arrayId,
                                                                    'controllerInstance',
                                                                    sc.id,
                                                                    mpptIdx
                                                                )
                                                            }
                                                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                                                                isElectricalValid
                                                                    ? 'bg-white border border-slate-300 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                                            }`}
                                                        >
                                                            Assign
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                <div className="space-y-4 pb-4 mb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            DC Bus Voltage
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setAreaSystemVoltage(null)}
                                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                                    areaSettings.systemVoltage === null
                                        ? 'bg-slate-600 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                Any
                            </button>
                            {[12, 24, 36, 48, 96].map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setAreaSystemVoltage(v)}
                                    className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                                        areaSettings.systemVoltage === v
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {v}V
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Controller Type
                            </span>
                            <div className="flex rounded-lg overflow-hidden border border-slate-300 shadow-sm text-sm font-medium">
                                <button
                                    onClick={() => setAreaSystemType('any')}
                                    className={`px-3 py-1.5 transition-colors ${
                                        areaSettings.systemType === 'any'
                                            ? 'bg-slate-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    Any
                                </button>
                                <button
                                    onClick={() => setAreaSystemType('dc-charger')}
                                    className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${
                                        areaSettings.systemType === 'dc-charger'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    DC Charger
                                </button>
                                <button
                                    onClick={() => setAreaSystemType('grid-connected')}
                                    className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${
                                        areaSettings.systemType === 'grid-connected'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    Grid-Connected AC
                                </button>
                                <button
                                    onClick={() => setAreaSystemType('off-grid-ac')}
                                    className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${
                                        areaSettings.systemType === 'off-grid-ac'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    Off-Grid AC
                                </button>
                            </div>
                        </div>
                        {areaSettings.systemType === 'grid-connected' && (
                            <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                        checked={areaSettings.filterEps}
                                        onChange={toggleAreaEps}
                                    />
                                    Emergency Power (EPS)
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                        checked={areaSettings.filterHouseBackup}
                                        onChange={toggleAreaHouseBackup}
                                    />
                                    House Blackout protection
                                </label>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left border-collapse relative text-xs">
                            <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-sm">
                                <tr>
                                    <th
                                        scope="col"
                                        onClick={() => toggleControllerSort('name')}
                                        className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    >
                                        Controller Model{' '}
                                        {controllerSort.key === 'name' &&
                                            (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        onClick={() => toggleControllerSort('maxV')}
                                        className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    >
                                        PV Vmax{' '}
                                        {controllerSort.key === 'maxV' &&
                                            (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        onClick={() => toggleControllerSort('maxIsc')}
                                        className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    >
                                        Max Isc{' '}
                                        {controllerSort.key === 'maxIsc' &&
                                            (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        onClick={() => toggleControllerSort('trackers')}
                                        className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    >
                                        #MPPTs{' '}
                                        {controllerSort.key === 'trackers' &&
                                            (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        onClick={() => toggleControllerSort('price')}
                                        className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    >
                                        Price{' '}
                                        {controllerSort.key === 'price' &&
                                            (controllerSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th scope="col" className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedControllersList.length > 0 ? (
                                    sortedControllersList.map((c) => {
                                        const isSelected =
                                            selections[arrayId]?.controller &&
                                            chargersData.find(
                                                (x) => x.id === selections[arrayId].controller
                                            )?.id === c.id &&
                                            !selections[arrayId].controllerInstanceId;
                                        const inc = !c.isFullyCompatible;
                                        return (
                                            <tr
                                                key={c.id}
                                                className={`border-b border-slate-100 transition-colors ${
                                                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <td
                                                    className={`py-2 px-3 border-r border-slate-200/70 ${
                                                        inc ? 'bg-red-100' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-medium text-slate-800">
                                                            {c.name}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            ({c.manufacturer})
                                                        </span>
                                                        <button
                                                            onClick={() => setInfoModalChargerId(c.id)}
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
                                                <BarCell
                                                    value={c.maxV}
                                                    range={col.maxV}
                                                    incompatible={inc}
                                                    formatter={(v) => `${v} V`}
                                                    className={!c.isVoltageOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                                />
                                                <BarCell
                                                    value={c.maxIsc}
                                                    range={col.maxIsc}
                                                    incompatible={inc}
                                                    formatter={(v) => `${v} A`}
                                                    className={!c.isCurrentOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                                />
                                                <td
                                                    className={`py-2 px-3 text-slate-700 border-r border-slate-200/70 ${
                                                        inc ? 'bg-red-100' : ''
                                                    }`}
                                                >
                                                    {c.trackers ?? '-'}
                                                </td>
                                                <BarCell
                                                    value={c.price}
                                                    range={col.price}
                                                    incompatible={inc}
                                                    formatter={(v) => `£${v}`}
                                                    className="py-2 px-3 font-medium text-blue-700"
                                                />
                                                <td className={`py-2 px-3 text-right ${inc ? 'bg-red-100' : ''}`}>
                                                    <button
                                                        onClick={() => {
                                                            const newInstId = createControllerInstance(
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
                                            colSpan="6"
                                            className="py-8 px-4 text-center text-slate-500 italic"
                                        >
                                            <AlertTriangle
                                                className="mx-auto mb-2 text-slate-400"
                                                size={24}
                                            />
                                            No PV controllers meet the electrical limits of your
                                            selected panel config in this array.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
