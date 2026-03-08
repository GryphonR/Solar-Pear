import React from 'react';
import { AlertTriangle } from '../components/Icons';
import { useAppState } from '../context/AppStateContext';

export default function SummaryView() {
    const {
        arraysData,
        areasData,
        panelsData,
        chargersData,
        siteControllers,
        selections,
        getArrayAnalysis,
    } = useAppState();

    let totalCost = 0;
    const areaTotals = {};
    areasData.forEach((area) => {
        areaTotals[area] = { power: 0, cost: 0 };
    });

    let rs450_100_primary = 0;
    let rs450_100_shared = 0;
    let rs450_200_primary = 0;
    let rs450_200_shared = 0;
    let hasErrors = false;
    const bomPanels = {};
    const bomControllers = {};

    const summaryRows = arraysData.map((array) => {
        const analysis = getArrayAnalysis(array.id);
        if (!analysis) return null;

        totalCost += analysis.cost;
        const assignedArea = array.area || 'House';
        if (!areaTotals[assignedArea]) {
            areaTotals[assignedArea] = { power: 0, cost: 0 };
        }
        areaTotals[assignedArea].power += analysis.peakPower;
        areaTotals[assignedArea].cost += analysis.cost;
        if (analysis.status === 'error') hasErrors = true;

        if (analysis.panel) {
            if (!bomPanels[analysis.panel.model]) {
                bomPanels[analysis.panel.model] = { item: analysis.panel, qty: 0 };
            }
            bomPanels[analysis.panel.model].qty += array.count;
        }

        return (
            <tr key={array.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-semibold">{array.name}</td>
                <td className="py-3 px-4">
                    {analysis.panel ? (
                        `${analysis.panel.name} (${array.count}x)`
                    ) : (
                        <span className="text-slate-400 italic">No Panel</span>
                    )}
                </td>
                <td className="py-3 px-4 font-medium text-blue-700">
                    {analysis.peakPower.toLocaleString()} W
                </td>
                <td className="py-3 px-4">
                    {analysis.controllerInstance ? (
                        <span>
                            {analysis.controllerInstance.name}{' '}
                            <span className="text-xs text-slate-400">
                                ({analysis.controller?.modelNumber ?? analysis.controller?.id}) MPPT {analysis.mpptIndex}
                            </span>
                        </span>
                    ) : (
                        <span className="text-slate-400 italic">No Controller</span>
                    )}
                </td>
                <td className="py-3 px-4">
                    {analysis.status === 'error' ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">FAILED</span>
                    ) : analysis.status === 'warning' ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">WARNING</span>
                    ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">OK</span>
                    )}
                </td>
                <td className="py-3 px-4">£{analysis.costPerKWp.toFixed(2)}</td>
                <td className="py-3 px-4 text-right text-slate-500 italic">
                    £{analysis.cost.toLocaleString()} (Panels)
                </td>
            </tr>
        );
    });

    const activeInstanceIds = new Set(
        arraysData.map((a) => getArrayAnalysis(a.id)?.controllerInstance?.id).filter(Boolean)
    );

    siteControllers.forEach((sc) => {
        if (activeInstanceIds.has(sc.id)) {
            const model = chargersData.find((c) => c.id === sc.modelId);
            if (model) {
                if (!bomControllers[model.id]) {
                    bomControllers[model.id] = { item: model, qty: 0 };
                }
                bomControllers[model.id].qty += 1;
                totalCost += model.price;
                const assignedArrayId = Object.entries(selections).find(
                    ([_, sel]) => sel.controllerInstanceId === sc.id
                )?.[0];
                if (assignedArrayId) {
                    const arr = arraysData.find((a) => a.id === assignedArrayId);
                    if (arr && areaTotals[arr.area || 'House']) {
                        areaTotals[arr.area || 'House'].cost += model.price;
                    }
                }
                if (model.id === 'rs450_100') rs450_100_primary++;
                if (model.id === 'rs450_100_shared') rs450_100_shared++;
                if (model.id === 'rs450_200') rs450_200_primary++;
                if (model.id === 'rs450_200_shared') rs450_200_shared++;
            }
        }
    });

    const trackerError100 = rs450_100_shared > rs450_100_primary;
    const trackerError200 = rs450_200_shared > rs450_200_primary * 3;
    const hasTrackerError = trackerError100 || trackerError200;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">System Summary</h2>
                    <p className="text-slate-500">Overview of all configured arrays and total hardware cost.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {areasData.length > 1 &&
                    (() => {
                        const systemTotalPower = Object.values(areaTotals).reduce((s, t) => s + t.power, 0);
                        const systemTotalCost = Object.values(areaTotals).reduce((s, t) => s + t.cost, 0);
                        const systemCostPerKWp =
                            systemTotalPower > 0 ? systemTotalCost / (systemTotalPower / 1000) : 0;
                        return (
                            <div className="bg-emerald-700 p-6 rounded-lg text-white shadow-md flex justify-between items-end col-span-full md:col-span-1">
                                <div>
                                    <p className="text-sm text-emerald-300 uppercase tracking-wider font-semibold mb-1">
                                        System Total Peak
                                    </p>
                                    <p className="text-4xl font-light">
                                        {systemTotalPower.toLocaleString()} <span className="text-xl">W</span>
                                    </p>
                                    <p className="text-sm text-emerald-300 mt-1">
                                        £{systemTotalCost.toLocaleString()} total
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold mb-1">
                                        Blended Cost
                                    </p>
                                    <p className="text-xl font-medium text-emerald-100">
                                        £{systemCostPerKWp.toFixed(2)} / kWp
                                    </p>
                                </div>
                            </div>
                        );
                    })()}
                {Object.entries(areaTotals).map(([areaName, totals], index) => {
                    const costPerKWp = totals.power > 0 ? totals.cost / (totals.power / 1000) : 0;
                    const bgClass = index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700';
                    return (
                        <div
                            key={areaName}
                            className={`${bgClass} p-6 rounded-lg text-white shadow-md flex justify-between items-end`}
                        >
                            <div>
                                <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">
                                    {areaName} Peak Power
                                </p>
                                <p className="text-4xl font-light">
                                    {totals.power.toLocaleString()} <span className="text-xl">W</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                                    Hardware Cost
                                </p>
                                <p className="text-xl font-medium text-slate-300">
                                    £{costPerKWp.toFixed(2)} / kWp
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasErrors && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-800 flex items-center">
                    <AlertTriangle className="mr-2" size={20} />
                    One or more arrays have fatal engineering errors. Review the tabs before procurement.
                </div>
            )}

            {hasTrackerError && (
                <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded text-orange-800 flex items-center">
                    <AlertTriangle className="mr-2" size={20} />
                    Tracker mismatch: You have assigned more shared RS trackers than your Primary units can
                    physically support.
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    Array Configuration Breakdown
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
                            <tr>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Array
                                </th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Panels
                                </th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Array Peak
                                </th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    PV Controller
                                </th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    £/kWp
                                </th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                    Cost
                                </th>
                            </tr>
                        </thead>
                        <tbody>{summaryRows}</tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-6">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
                    <span>Bill of Materials (BOM)</span>
                    <span className="text-sm font-normal text-slate-500">
                        Aggregated quantities for procurement
                    </span>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Qty
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Component
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                Unit Price
                            </th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                Line Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.values(bomPanels).map(({ item, qty }) => (
                            <tr key={item.model} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-4 font-bold text-slate-700">{qty}</td>
                                <td className="py-3 px-4">{item.name}</td>
                                <td className="py-3 px-4 text-right text-slate-600">
                                    £{item.price.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-slate-800">
                                    £{(qty * item.price).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {Object.values(bomControllers).map(({ item, qty }) => (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-4 font-bold text-slate-700">{qty}</td>
                                <td className="py-3 px-4">{item.name}</td>
                                <td className="py-3 px-4 text-right text-slate-600">
                                    £{item.price.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-slate-800">
                                    £{(qty * item.price).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 text-slate-800 border-t-2 border-slate-300">
                            <td colSpan="3" className="py-4 px-4 text-right font-bold text-lg">
                                Total Hardware Cost:
                            </td>
                            <td className="py-4 px-4 text-right font-bold text-2xl text-blue-700">
                                £{totalCost.toLocaleString()}
                            </td>
                        </tr>
                    </tfoot>
                </table>
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <p className="text-xs text-slate-500 italic">
                        * Reminder: This hardware cost estimate includes ONLY the selected solar panels and PV
                        controllers/inverters. It does not include mounting hardware, cabling, batteries, or
                        installation labor.
                    </p>
                </div>
            </div>
        </div>
    );
}
