import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, ExternalLink } from '../../components/Icons';
import BuyButton from '../../components/BuyButton';
import BarCell from '../../components/BarCell';

export default function PanelTable({
    validPanels,
    array,
    arrayId,
    selectedPanelModel,
    onSelectPanel,
    onOpenInfo,
    panelSort,
    togglePanelSort,
    updateArray,
    hideHeavyPanels,
    setHideHeavyPanels,
    hideMarginalPanels,
    setHideMarginalPanels,
    hideIncompatiblePanels,
    setHideIncompatiblePanels,
    controller,
}) {
    const col = useMemo(() => {
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
        return {
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
    }, [validPanels]);

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
                                    scope="col"
                                    onClick={() => togglePanelSort('name')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                >
                                    Panel Name {panelSort.key === 'name' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('peakPower')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                >
                                    kWp {panelSort.key === 'peakPower' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('coldVoc')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    title="Open-circuit voltage of the string at −10°C"
                                >
                                    Voc Cold {panelSort.key === 'coldVoc' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('hotVmp')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    title="Maximum power point voltage of the string at 65°C"
                                >
                                    Hot Vmp {panelSort.key === 'hotVmp' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('arrayIscHot')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    title="Short-circuit current at 65°C (hot)"
                                >
                                    Isc Hot {panelSort.key === 'arrayIscHot' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('width')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    title="Panel width (mm)"
                                >
                                    Width {panelSort.key === 'width' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('height')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    title="Panel height (mm)"
                                >
                                    Height {panelSort.key === 'height' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('weight')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                    title="Panel weight (kg)"
                                >
                                    Weight {panelSort.key === 'weight' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('costPerKWp')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                >
                                    £/kWp {panelSort.key === 'costPerKWp' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    onClick={() => togglePanelSort('panelCost')}
                                    className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none border-r border-slate-200/70"
                                >
                                    £ Total {panelSort.key === 'panelCost' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th scope="col" className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {validPanels.length > 0 ? (
                                validPanels.map((p) => {
                                    const isSelected = selectedPanelModel === p.model;
                                    const inc = !p.isFullyCompatible;
                                    return (
                                        <tr
                                            key={p.model}
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
                                                    <span>{p.name}</span>
                                                    <button
                                                        onClick={() => onOpenInfo(p.model)}
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
                                            <BarCell
                                                value={p.peakPower}
                                                range={col.peakPower}
                                                incompatible={inc}
                                                formatter={(v) => `${Number(v).toLocaleString()} W`}
                                                className="font-medium text-blue-700"
                                            />
                                            <BarCell
                                                value={p.coldVoc}
                                                range={col.coldVoc}
                                                incompatible={inc}
                                                formatter={(v) => `${Number(v).toFixed(1)} V`}
                                                className={!p.isVocOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                            />
                                            <BarCell
                                                value={p.hotVmp}
                                                range={col.hotVmp}
                                                incompatible={inc}
                                                formatter={(v) => `${Number(v).toFixed(1)} V`}
                                                className={!p.isVmpOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                            />
                                            <BarCell
                                                value={p.arrayIscHot}
                                                range={col.arrayIscHot}
                                                incompatible={inc}
                                                formatter={(v) => `${Number(v).toFixed(2)} A`}
                                                className={!p.isIscOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                            />
                                            <BarCell
                                                value={p.width}
                                                range={col.width}
                                                incompatible={inc}
                                                formatter={(v) => (v != null ? `${v} mm` : '—')}
                                                className={!p.isWidthOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                            />
                                            <BarCell
                                                value={p.height}
                                                range={col.height}
                                                incompatible={inc}
                                                formatter={(v) => (v != null ? `${v} mm` : '—')}
                                                className={!p.isHeightOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                            />
                                            <BarCell
                                                value={p.weight}
                                                range={col.weight}
                                                incompatible={inc}
                                                formatter={(v) => (v != null ? `${v} kg` : '—')}
                                                className={!p.isWeightOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                            />
                                            <BarCell
                                                value={p.costPerKWp}
                                                range={col.costPerKWp}
                                                incompatible={inc}
                                                formatter={(v) => `£${Number(v).toFixed(2)}`}
                                            />
                                            <BarCell
                                                value={p.panelCost}
                                                range={col.panelCost}
                                                incompatible={inc}
                                                formatter={(v) => `£${Number(v).toLocaleString()}`}
                                            />
                                            <td
                                                className={`py-2 px-3 text-right ${
                                                    inc ? 'bg-red-100' : ''
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                                        <CheckCircle size={14} className="mr-1" /> Selected
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => onSelectPanel(p.model)}
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
}
