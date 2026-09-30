import React, { useMemo, useState } from 'react';
import DiscontinuedBadge from '../../components/DiscontinuedBadge';
import { AlertTriangle, CheckCircle, Info, ExternalLink } from '../../components/Icons';
import BuyButton from '../../components/BuyButton';
import { AffiliateNotice } from '../../components/TrustNotices';
import BarCell from '../../components/BarCell';
import { safeHttpUrl } from '../../lib/safeUrl';
import { formatMoney } from '../../lib/pricing';
import {
    groupPanelsBySeries,
    manufacturerSeriesFilterValue,
    panelSeriesKey,
    parseManufacturerSeriesFilterValue,
} from '../../lib/panelSeries';
import { useIsPhone } from '../../hooks/useIsSmallScreen';

/**
 * Sort a panel list by the active Compatible Panels Explorer column sort.
 * @param {object[]} panels
 * @param {{ key: string, dir: string }} panelSort
 */
function sortPanelsByColumn(panels, panelSort) {
    return [...panels].sort((a, b) => {
        const valA = a[panelSort.key];
        const valB = b[panelSort.key];
        if (valA < valB) return panelSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return panelSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
}

const SORTS = [
    ['peakPower', 'kWp'],
    ['costPerKWp', '£/kWp'],
    ['panelCost', '£ total'],
    ['coldVoc', 'Cold Voc'],
    ['name', 'Name'],
    ['weight', 'Weight'],
];

/** The panel list as cards, for phones (13.9): same groups, filters and actions as the table. */
function PanelCards({ displayGroups, filteredPanels, selectedPanelModel, onSelectPanel, onOpenInfo, panelSort, togglePanelSort }) {
    return (
        <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">
                Sort by
                <select
                    value={panelSort.key}
                    onChange={(e) => togglePanelSort(e.target.value)}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                >
                    {SORTS.map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
                </select>
                <button type="button" onClick={() => togglePanelSort(panelSort.key)} className="h-8 rounded-md border border-slate-300 bg-white px-2" aria-label="Reverse the order">
                    {panelSort.dir === 'asc' ? '↑' : '↓'}
                </button>
            </label>
            {filteredPanels.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 italic">
                    No active panels meet both the physical format and the electrical constraints of the currently selected MPPT.
                </p>
            ) : (
                <ul aria-label="Panels" className="flex flex-col gap-2">
                    {displayGroups.flatMap((group) => {
                        const items = [];
                        if (group.showMfrHeader) {
                            items.push(
                                <li key={`mfr-${group.mfr}`} className="px-1 pt-2 text-xs font-bold tracking-wider text-slate-600 uppercase">
                                    {group.mfr}
                                </li>
                            );
                        }
                        for (const p of group.panels) {
                            const isSelected = selectedPanelModel === p.model;
                            const inc = !p.isFullyCompatible;
                            const safeDatasheet = safeHttpUrl(p.datasheetUrl);
                            items.push(
                                <li key={p.model} className={`flex flex-col gap-2 rounded-lg border bg-white px-3.5 py-3 text-xs ${inc ? 'border-red-300 bg-red-50' : isSelected ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'}`}>
                                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-800">
                                        <span>{p.name}</span>
                                        <DiscontinuedBadge item={p} />
                                        <button onClick={() => onOpenInfo(p.model)} className="text-slate-400 hover:text-blue-600" aria-label="View technical specs">
                                            <Info size={16} />
                                        </button>
                                        {safeDatasheet && (
                                            <a href={safeDatasheet} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600" aria-label="View manufacturer datasheet">
                                                <ExternalLink size={16} />
                                            </a>
                                        )}
                                        {p.isVocWarn && <AlertTriangle size={16} className="text-orange-500" title="Cold Voc is within 6% of the controller limit" />}
                                        <BuyButton buyLinks={p.buyLinks} />
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                        <span className="font-medium text-blue-700">{Number(p.peakPower).toLocaleString()} W</span>
                                        <span>{p.costPerKWp == null ? '—' : `£${Number(p.costPerKWp).toFixed(2)}`}/kWp</span>
                                        <span>{p.panelCost == null ? '—' : formatMoney(p.panelCost)} total</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-plex-mono text-slate-600">
                                        <span className={!p.isVocOk ? 'font-bold text-red-600' : ''}>Voc {Number(p.coldVoc).toFixed(1)} V</span>
                                        <span className={!p.isVmpOk ? 'font-bold text-orange-500' : ''}>Vmp {Number(p.hotVmp).toFixed(1)} V</span>
                                        <span className={!p.isIscOk ? 'font-bold text-orange-500' : ''}>Isc {Number(p.arrayIscHot).toFixed(2)} A</span>
                                        <span className={!p.isWidthOk || !p.isHeightOk ? 'font-bold text-red-600' : ''}>
                                            {p.height ?? '-'} × {p.width ?? '-'} mm
                                        </span>
                                        <span className={!p.isWeightOk ? 'font-bold text-red-600' : ''}>{p.weight != null ? `${p.weight} kg` : '-'}</span>
                                    </div>
                                    {isSelected ? (
                                        <span className="inline-flex items-center self-start rounded bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
                                            <CheckCircle size={14} className="mr-1" /> Selected
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => onSelectPanel(p.model)}
                                            className={`self-start rounded px-3 py-1.5 text-xs font-bold ${inc ? 'border border-red-400 bg-red-50 text-red-700' : 'border border-slate-300 bg-white text-slate-700'}`}
                                        >
                                            Select Panel
                                        </button>
                                    )}
                                </li>
                            );
                        }
                        return items;
                    })}
                </ul>
            )}
        </div>
    );
}

export default function PanelTable({
    validPanels,
    selectedPanelModel,
    onSelectPanel,
    onOpenInfo,
    panelSort,
    togglePanelSort,
    hideHeavyPanels,
    setHideHeavyPanels,
    hideMarginalPanels,
    setHideMarginalPanels,
    hideIncompatiblePanels,
    setHideIncompatiblePanels,
    controller,
}) {
    const phone = useIsPhone();
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [seriesFilter, setSeriesFilter] = useState('');

    const manufacturers = useMemo(() => {
        const set = new Set(validPanels.map((p) => p.manufacturer || 'Unknown'));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [validPanels]);

    // Panels after manufacturer filter only (feeds series option list)
    const manufacturerScopedPanels = useMemo(() => {
        if (!manufacturerFilter) return validPanels;
        return validPanels.filter((p) => (p.manufacturer || 'Unknown') === manufacturerFilter);
    }, [validPanels, manufacturerFilter]);

    // Series dropdown options: plain series key when one mfr selected; composite when All
    const seriesOptions = useMemo(() => {
        if (manufacturerFilter) {
            const keys = [...new Set(manufacturerScopedPanels.map(panelSeriesKey))];
            return keys
                .sort((a, b) => a.localeCompare(b))
                .map((seriesKey) => ({ value: seriesKey, label: seriesKey }));
        }
        /** @type {Map<string, string>} */
        const optMap = new Map();
        for (const p of manufacturerScopedPanels) {
            const mfr = p.manufacturer || 'Unknown';
            const seriesKey = panelSeriesKey(p);
            const value = manufacturerSeriesFilterValue(mfr, seriesKey);
            if (!optMap.has(value)) {
                optMap.set(value, `${mfr} - ${seriesKey}`);
            }
        }
        return [...optMap.entries()]
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label }));
    }, [manufacturerFilter, manufacturerScopedPanels]);

    const filteredPanels = useMemo(() => {
        let list = manufacturerScopedPanels;
        if (seriesFilter) {
            if (manufacturerFilter) {
                list = list.filter((p) => panelSeriesKey(p) === seriesFilter);
            } else {
                const parsed = parseManufacturerSeriesFilterValue(seriesFilter);
                if (parsed) {
                    list = list.filter(
                        (p) =>
                            (p.manufacturer || 'Unknown') === parsed.manufacturer &&
                            panelSeriesKey(p) === parsed.seriesKey
                    );
                }
            }
        }
        return list;
    }, [manufacturerScopedPanels, manufacturerFilter, seriesFilter]);

    // Nested manufacturer → series groups; within each series, apply column sort
    const displayGroups = useMemo(() => {
        const showMfrHeaders = !manufacturerFilter;
        /** @type {{ mfr: string, seriesKey: string, panels: object[], showMfrHeader: boolean }[]} */
        const groups = [];
        let prevMfr = null;

        if (showMfrHeaders) {
            const mfrs = [...new Set(filteredPanels.map((p) => p.manufacturer || 'Unknown'))].sort((a, b) =>
                a.localeCompare(b)
            );
            for (const mfr of mfrs) {
                const mfrPanels = filteredPanels.filter((p) => (p.manufacturer || 'Unknown') === mfr);
                for (const { seriesKey, panels } of groupPanelsBySeries(mfrPanels)) {
                    groups.push({
                        mfr,
                        seriesKey,
                        panels: sortPanelsByColumn(panels, panelSort),
                        showMfrHeader: mfr !== prevMfr,
                    });
                    prevMfr = mfr;
                }
            }
        } else {
            for (const { seriesKey, panels } of groupPanelsBySeries(filteredPanels)) {
                groups.push({
                    mfr: manufacturerFilter,
                    seriesKey,
                    panels: sortPanelsByColumn(panels, panelSort),
                    showMfrHeader: false,
                });
            }
        }
        return groups;
    }, [filteredPanels, manufacturerFilter, panelSort]);

    const col = useMemo(() => {
        const peakPowerVals = filteredPanels.map((p) => p.peakPower);
        const coldVocVals = filteredPanels.map((p) => p.coldVoc);
        const hotVmpVals = filteredPanels.map((p) => p.hotVmp);
        const arrayIscHotVals = filteredPanels.map((p) => p.arrayIscHot);
        // Unknown prices (null) are excluded from the bar ranges.
        const costPerKWpVals = filteredPanels.map((p) => p.costPerKWp).filter((v) => v != null);
        const panelCostVals = filteredPanels.map((p) => p.panelCost).filter((v) => v != null);
        const widthVals = filteredPanels.map((p) => p.width).filter((v) => v != null);
        const heightVals = filteredPanels.map((p) => p.height).filter((v) => v != null);
        const weightVals = filteredPanels.map((p) => p.weight).filter((v) => v != null);
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
    }, [filteredPanels]);

    const handleManufacturerChange = (value) => {
        setManufacturerFilter(value);
        // Clearing or changing manufacturer resets series so options stay in sync
        setSeriesFilter('');
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
                <div className="flex flex-wrap items-stretch gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex flex-col justify-center min-w-[10rem]">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Manufacturer
                        </label>
                        <select
                            className="w-full min-w-[10rem] p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-white"
                            value={manufacturerFilter}
                            onChange={(e) => handleManufacturerChange(e.target.value)}
                        >
                            <option value="">All manufacturers</option>
                            {manufacturers.map((mfr) => (
                                <option key={mfr} value={mfr}>
                                    {mfr}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col justify-center min-w-[10rem]">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Series
                        </label>
                        <select
                            className="w-full min-w-[10rem] p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-white"
                            value={seriesFilter}
                            onChange={(e) => setSeriesFilter(e.target.value)}
                        >
                            <option value="">All series</option>
                            {seriesOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col justify-center space-y-2 pl-2 border-l border-slate-200">
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

            <AffiliateNotice className="-mt-2 mb-2 px-1" />
            {phone ? (
                <PanelCards
                    displayGroups={displayGroups}
                    filteredPanels={filteredPanels}
                    selectedPanelModel={selectedPanelModel}
                    onSelectPanel={onSelectPanel}
                    onOpenInfo={onOpenInfo}
                    panelSort={panelSort}
                    togglePanelSort={togglePanelSort}
                />
            ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="max-h-[600px] overflow-auto">
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
                            {filteredPanels.length > 0 ? (
                                displayGroups.flatMap((group) => {
                                    const rows = [];
                                    if (group.showMfrHeader) {
                                        rows.push(
                                            <tr key={`mfr-${group.mfr}`} className="bg-slate-100">
                                                <td
                                                    colSpan={11}
                                                    className="py-1.5 px-3 text-xs font-bold text-slate-600 uppercase tracking-wider"
                                                >
                                                    {group.mfr}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    rows.push(
                                        <tr key={`series-${group.mfr}|${group.seriesKey}`} className="bg-slate-50">
                                            <td
                                                colSpan={11}
                                                className="py-1 px-3 text-xs font-semibold text-slate-500"
                                            >
                                                {group.seriesKey}
                                                <span className="font-normal text-slate-400 ml-1">
                                                    ({group.panels.length})
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                    for (const p of group.panels) {
                                        const isSelected = selectedPanelModel === p.model;
                                        const inc = !p.isFullyCompatible;
                                        const safeDatasheet = safeHttpUrl(p.datasheetUrl);
                                        rows.push(
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
                                                        <DiscontinuedBadge item={p} />
                                                        <button
                                                            onClick={() => onOpenInfo(p.model)}
                                                            className="text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="View Technical Specs"
                                                            aria-label="View technical specs"
                                                        >
                                                            <Info size={16} />
                                                        </button>
                                                        {safeDatasheet && (
                                                            <a
                                                                href={safeDatasheet}
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
                                                    className={!p.isVmpOk ? 'font-bold text-orange-500' : 'text-slate-700'}
                                                />
                                                <BarCell
                                                    value={p.arrayIscHot}
                                                    range={col.arrayIscHot}
                                                    incompatible={inc}
                                                    formatter={(v) => `${Number(v).toFixed(2)} A`}
                                                    className={!p.isIscOk ? 'font-bold text-orange-500' : 'text-slate-700'}
                                                />
                                                <BarCell
                                                    value={p.width}
                                                    range={col.width}
                                                    incompatible={inc}
                                                    formatter={(v) => (v != null ? `${v} mm` : '-')}
                                                    className={!p.isWidthOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                                />
                                                <BarCell
                                                    value={p.height}
                                                    range={col.height}
                                                    incompatible={inc}
                                                    formatter={(v) => (v != null ? `${v} mm` : '-')}
                                                    className={!p.isHeightOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                                />
                                                <BarCell
                                                    value={p.weight}
                                                    range={col.weight}
                                                    incompatible={inc}
                                                    formatter={(v) => (v != null ? `${v} kg` : '-')}
                                                    className={!p.isWeightOk ? 'font-bold text-red-600' : 'text-slate-700'}
                                                />
                                                <BarCell
                                                    value={p.costPerKWp}
                                                    range={col.costPerKWp}
                                                    incompatible={inc}
                                                    formatter={(v) => (v == null ? '—' : `£${Number(v).toFixed(2)}`)}
                                                />
                                                <BarCell
                                                    value={p.panelCost}
                                                    range={col.panelCost}
                                                    incompatible={inc}
                                                    formatter={(v) => (v == null ? '—' : formatMoney(v))}
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
                                    }
                                    return rows;
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
            )}
        </div>
    );
}
