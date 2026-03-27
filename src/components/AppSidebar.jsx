import React from 'react';
import SolarPearLogo from './SolarPearLogo';
import {
    AlertTriangle,
    CheckCircle,
    LayoutDashboard,
    Database,
    Server,
    Pencil,
    RotateCcw,
    Download,
    Upload,
    Info,
} from './Icons';

/**
 * Main app sidebar: logo, nav (Guide, PV Controllers, Panels),
 * per-area array list, System Summary, and Reset/Backup/Upload actions.
 */
export default function AppSidebar({
    activeTab,
    setActiveTab,
    arraysData,
    areasData,
    getArrayAnalysis,
    onDownload,
    onUpload,
    onReset,
    onAddArea,
    onAddArray,
    onEditArea,
    onEditArray,
}) {
    return (
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col z-10">
            <div className="p-4 border-b border-slate-800 flex justify-center">
                <SolarPearLogo className="w-48 h-auto text-slate-100" />
            </div>

            <div className="flex-1 overflow-y-auto">
                <nav className="px-2 pt-4 space-y-1">
                    <button
                        onClick={() => setActiveTab('GUIDE')}
                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'GUIDE' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                    >
                        <Info className="mr-3" size={16} /> Guide
                    </button>
                </nav>

                <div className="my-4 mx-4 border-t border-slate-800" />

                <nav className="px-2 space-y-1">
                    <button
                        onClick={() => setActiveTab('DB_CHARGERS')}
                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'DB_CHARGERS' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                    >
                        <Server className="mr-3" size={16} /> PV Controllers
                    </button>
                    <button
                        onClick={() => setActiveTab('DB_PANELS')}
                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'DB_PANELS' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                    >
                        <Database className="mr-3" size={16} /> Panels
                    </button>
                </nav>

                <div className="my-4 mx-4 border-t border-slate-800" />

                {areasData.map((areaName) => {
                    const areaArrays = arraysData.filter((a) => a.area === areaName);
                    const isAreaActive = areaArrays.some((array) => array.id === activeTab);
                    return (
                        <div key={areaName} className="mb-4 group/area">
                            <div className="px-2">
                                <div className="p-1 pl-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between gap-2">
                                    <span className="truncate">{areaName} Arrays</span>
                                    <button
                                        type="button"
                                        onClick={() => onEditArea?.(areaName)}
                                        className={`p-1 rounded transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isAreaActive ? 'opacity-100 text-slate-300' : 'opacity-0 group-hover/area:opacity-100 focus:opacity-100 text-slate-500'}`}
                                        title={`Edit area ${areaName}`}
                                        aria-label={`Edit area ${areaName}`}
                                    >
                                        <Pencil size={12} />
                                    </button>
                                </div>
                            </div>
                            <nav className="px-2 ml-3 pl-2 border-l border-slate-700/80 space-y-1">
                                {areaArrays.map((array) => {
                                    const analysis = getArrayAnalysis(array.id);
                                    if (!analysis) return null;
                                    const isActive = activeTab === array.id;
                                    return (
                                        <div
                                            key={array.id}
                                            className={`w-full flex items-center gap-1 px-1 py-0.5 rounded-lg transition-colors group/array ${isActive ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab(array.id)}
                                                className="flex-1 flex items-center justify-between px-2 py-2 text-left min-w-0"
                                            >
                                                <span className="text-sm truncate mr-2 min-w-0">
                                                    {array.name}
                                                </span>
                                                {analysis.status === 'error' && (
                                                    <AlertTriangle
                                                        size={16}
                                                        className={`flex-shrink-0 ${isActive ? 'text-red-200' : 'text-red-500'}`}
                                                        title="System failure"
                                                        aria-hidden
                                                    />
                                                )}
                                                {analysis.status === 'warning' && (
                                                    <AlertTriangle
                                                        size={16}
                                                        className={`flex-shrink-0 ${isActive ? 'text-orange-200' : 'text-orange-500'}`}
                                                        title="Warning"
                                                        aria-hidden
                                                    />
                                                )}
                                                {analysis.status !== 'error' &&
                                                    analysis.status !== 'warning' && (
                                                        <CheckCircle
                                                            size={16}
                                                            className={`flex-shrink-0 ${isActive ? 'text-green-200' : 'text-green-500'}`}
                                                            title="System compatible"
                                                            aria-hidden
                                                        />
                                                    )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onEditArray?.(array.id)}
                                                className={`p-1 rounded transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isActive ? 'opacity-100 text-slate-100' : 'opacity-0 group-hover/array:opacity-100 focus:opacity-100 text-slate-400'}`}
                                                title={`Edit array ${array.name}`}
                                                aria-label={`Edit array ${array.name}`}
                                            >
                                                <Pencil size={13} />
                                            </button>
                                        </div>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => onAddArray?.(areaName)}
                                    className="w-full mt-1 px-3 py-1 text-left text-[11px] font-medium text-slate-400 hover:text-white transition-colors"
                                >
                                    Add Array
                                </button>
                            </nav>
                        </div>
                    );
                })}
                <div className="px-2 pb-3">
                    <button
                        type="button"
                        onClick={() => onAddArea?.()}
                        className="w-full px-3 py-1 text-left text-[11px] font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Add Area
                    </button>
                </div>
            </div>

            <div className="p-4 border-t border-slate-800 space-y-2">
                <button
                    onClick={() => setActiveTab('SUMMARY')}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-center transition-colors ${activeTab === 'SUMMARY' ? 'bg-green-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700 hover:text-white'}`}
                >
                    <LayoutDashboard className="mr-2" size={18} />
                    System Summary
                </button>
                <div className="border-t border-slate-800 my-2" />
                <div className="flex gap-2 w-full pt-1">
                    <button
                        onClick={onReset}
                        className="flex-1 flex items-center justify-center px-1 py-2 rounded-lg text-center transition-colors text-red-500 bg-slate-800 hover:bg-slate-700 hover:text-white"
                        title="Reset all settings to factory defaults"
                        aria-label="Reset all settings to factory defaults"
                    >
                        <RotateCcw size={16} />
                    </button>
                    <button
                        onClick={onDownload}
                        className="flex-1 flex items-center justify-center px-1 py-2 rounded-lg text-center transition-colors text-blue-500 bg-slate-800 hover:bg-slate-700 hover:text-white"
                        title="Download backup of all current data"
                        aria-label="Download backup of all current data"
                    >
                        <Download size={16} />
                    </button>
                    <label
                        className="flex-1 flex items-center justify-center px-1 py-2 rounded-lg text-center transition-colors text-emerald-500 bg-slate-800 hover:bg-slate-700 hover:text-white cursor-pointer"
                        title="Upload backup file to restore"
                        aria-label="Upload backup file to restore"
                    >
                        <Upload size={16} />
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={onUpload}
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
