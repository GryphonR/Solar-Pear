import React from 'react';
import { AlertTriangle, CheckCircle, Info, XIcon, ExternalLink } from '../../components/Icons';
import ArrayOverviewGraphs from '../../components/ArrayOverviewGraphs';
import { isCompatibleFormat } from '../../lib/arrayAnalysis';

export default function ArrayOverviewTab({
    array,
    arrayId,
    panel,
    controller,
    status,
    messages,
    coldVoc,
    hotVmp,
    arrayIscHot,
    effectiveStartupV,
    panelsData,
    userNotes,
    setActiveArrayContentTab,
    updateSelection,
    updateUserNote,
}) {
    return (
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
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Panel</span>
                                {panel ? (
                                    <span className="text-sm font-bold text-slate-800">{panel.name} ({panel.power}W)</span>
                                ) : (
                                    <span className="text-sm font-bold text-blue-600">Select Panel</span>
                                )}
                            </div>
                            {panel && (
                                <button onClick={() => updateSelection(arrayId, 'panel', '')} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Clear Panel Selection" aria-label="Clear panel selection">
                                    <XIcon size={16} />
                                </button>
                            )}
                        </div>
                        {panelsData.some((p) => p.active !== false && !isCompatibleFormat(array, p)) && (
                            <p className="text-xs text-slate-400 mt-2 italic">
                                Some panels in the database are hidden as they physically conflict with this array's GSE requirements.
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
                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Controller</span>
                                {controller ? (
                                    <span className="text-sm font-bold text-slate-800">{controller.manufacturer ? `${controller.manufacturer} ${controller.name}` : controller.name}</span>
                                ) : (
                                    <span className="text-sm font-bold text-blue-600">Select Controller</span>
                                )}
                            </div>
                            {controller && (
                                <button onClick={() => updateSelection(arrayId, 'clearController')} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Clear Controller Selection" aria-label="Clear controller selection">
                                    <XIcon size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className={`p-4 rounded-lg border-l-4 ${status === 'error' ? 'bg-red-50 border-red-500' : status === 'warning' ? 'bg-orange-50 border-orange-500' : 'bg-green-50 border-green-500'}`}>
                        <div className="flex items-start">
                            {status === 'error' ? <AlertTriangle className="text-red-500 mr-3 mt-1" size={20} /> : status === 'warning' ? <AlertTriangle className="text-orange-500 mr-3 mt-1" size={20} /> : <CheckCircle className="text-green-500 mr-3 mt-1" size={20} />}
                            <div>
                                <h4 className={`font-bold ${status === 'error' ? 'text-red-800' : status === 'warning' ? 'text-orange-800' : 'text-green-800'}`}>
                                    {status === 'error' ? 'System Failure Detected' : status === 'warning' ? 'Warning' : 'System Compatible '}
                                </h4>
                                <ul className="mt-1 space-y-1">
                                    {messages.map((msg, i) => (
                                        <li key={i} className={`text-sm ${status === 'error' ? 'text-red-700' : status === 'warning' ? 'text-orange-700' : 'text-green-700'}`}>{msg}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                    {panel && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200" title="Open-circuit voltage of the string at −10°C. Must stay below your MPPT's maximum PV input.">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cold Voc (-10°C)</p>
                                <p className={`text-2xl font-light ${controller && coldVoc > controller.maxV ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{coldVoc.toFixed(1)} <span className="text-sm">V</span></p>
                                {controller ? <p className="text-xs text-slate-400 mt-1">Controller Limit: {controller.maxV}V</p> : <p className="text-xs text-slate-400 mt-1">Select a controller to compare limits</p>}
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200" title="Maximum power point voltage of the string at 65°C. Must stay above your MPPT's minimum startup voltage.">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hot Vmp (65°C)</p>
                                <p className={`text-2xl font-light ${controller && effectiveStartupV != null && hotVmp < effectiveStartupV ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{hotVmp.toFixed(1)} <span className="text-sm">V</span></p>
                                {controller && effectiveStartupV != null ? <p className="text-xs text-slate-400 mt-1">Required to Start: {effectiveStartupV}V</p> : <p className="text-xs text-slate-400 mt-1">Select a controller to compare limits</p>}
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200" title="Short-circuit current at 65°C (hot). Must not exceed the MPPT's max Isc.">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Array Isc (Hot 65°C)</p>
                                <p className={`text-2xl font-light ${controller && arrayIscHot > controller.maxIsc ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{arrayIscHot.toFixed(2)} <span className="text-sm">A</span></p>
                                {controller ? <p className="text-xs text-slate-400 mt-1">Controller Limit: {controller.maxIsc}A</p> : <p className="text-xs text-slate-400 mt-1">Select a controller to compare limits</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {panel && (
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6 mb-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center"><Info size={16} className="mr-2 text-blue-600" /> Panel: <span className="ml-2 font-normal">{panel.name}</span></h3>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{panel.power} W</span>
                        <span className="text-sm font-medium text-slate-600">£{panel.price} per unit</span>
                        {panel.datasheetUrl && <a href={panel.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"><ExternalLink size={12} className="mr-1" /> Datasheet</a>}
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
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Engineering Notes</p>
                            <p className="text-xs text-slate-400 italic mb-2">AI generated, may not be accurate.</p>
                            <div className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200 shadow-inner flex-1">{panel.notes || 'No specific architectural notes for this module.'}</div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end"><span>Your Notes</span><span className="text-slate-400 text-[10px] normal-case font-normal">Autosaves</span></p>
                            <textarea className="flex-1 w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]" placeholder="Log supplier quotes, lead times, compatibility thoughts..." value={userNotes[panel.model] || ''} onChange={(e) => updateUserNote(panel.model, e.target.value)} />
                        </div>
                    </div>
                </div>
            )}
            {controller && (
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center"><Info size={16} className="mr-2 text-emerald-600" /> Controller: <span className="ml-2 font-normal">{controller.manufacturer ? `${controller.manufacturer} ${controller.name}` : controller.name}</span></h3>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${controller.type === 'hybrid_inverter' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{controller.type === 'hybrid_inverter' ? 'Hybrid Inverter' : 'Charger'}</span>
                        <span className="text-sm font-medium text-slate-600">£{controller.price || 0} per unit</span>
                        {controller.datasheetUrl && <a href={controller.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"><ExternalLink size={12} className="mr-1" /> Datasheet</a>}
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
                            <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Battery voltages</dt><dd className="text-slate-800 font-medium">{(controller.systemVoltages || [48]).join('V, ')}V</dd></div></dl>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-3 mb-2 border-b border-slate-100 pb-1">UK grid certifications</h4>
                            <div className="flex flex-wrap gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${controller.g98_cert ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{controller.g98_cert ? <CheckCircle size={12} /> : <XIcon size={12} />} G98</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${controller.g99_cert ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{controller.g99_cert ? <CheckCircle size={12} /> : <XIcon size={12} />} G99</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${controller.g100_cert ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{controller.g100_cert ? <CheckCircle size={12} /> : <XIcon size={12} />} G100</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8 items-stretch">
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Engineering Notes</p>
                            <p className="text-xs text-slate-400 italic mb-2">AI generated, may not be accurate.</p>
                            <div className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200 shadow-inner flex-1">{controller.notes || 'No specific architectural notes for this controller.'}</div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end"><span>Your Notes</span><span className="text-slate-400 text-[10px] normal-case font-normal">Autosaves</span></p>
                            <textarea className="flex-1 w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]" placeholder="Log supplier quotes, lead times..." value={userNotes[controller.id] || ''} onChange={(e) => updateUserNote(controller.id, e.target.value)} />
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center"><Info size={16} className="mr-2 text-indigo-600" /> Array Notes: <span className="ml-2 font-normal">{array.name}</span></h3>
                <div className="flex flex-col">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end"><span>Your Notes</span><span className="text-slate-400 text-[10px] normal-case font-normal">Autosaves</span></p>
                    <textarea className="w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]" placeholder="Log installation notes, conduit routing, shading issues..." value={userNotes[`array_${array.id}`] || ''} onChange={(e) => updateUserNote(`array_${array.id}`, e.target.value)} />
                </div>
            </div>
            {panel && <ArrayOverviewGraphs panel={panel} array={array} controller={controller} effectiveStartupV={effectiveStartupV} />}
        </>
    );
}
