import React from 'react';
import SolarPearLogo from './SolarPearLogo';
import {
    AlertTriangle,
    CheckCircle,
    LayoutDashboard,
    Database,
    Server,
    Layers,
    RotateCcw,
    Download,
    Upload,
    Info,
} from './Icons';

/**
 * Main app sidebar: logo, nav (Guide, Array Config, PV Controllers, Panels),
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
                        onClick={() => setActiveTab('DB_ARRAYS')}
                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'DB_ARRAYS' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                    >
                        <Layers className="mr-3" size={16} /> Array Config
                    </button>
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
                    if (areaArrays.length === 0) return null;
                    return (
                        <div key={areaName} className="mb-4">
                            <div className="p-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {areaName} Arrays
                            </div>
                            <nav className="px-2 space-y-1">
                                {areaArrays.map((array) => {
                                    const analysis = getArrayAnalysis(array.id);
                                    if (!analysis) return null;
                                    return (
                                        <button
                                            key={array.id}
                                            onClick={() => setActiveTab(array.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${activeTab === array.id ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <span className="text-sm truncate mr-2 min-w-0">
                                                {array.name}
                                            </span>
                                            {analysis.status === 'error' && (
                                                <AlertTriangle
                                                    size={16}
                                                    className={`flex-shrink-0 ${activeTab === array.id ? 'text-red-200' : 'text-red-500'}`}
                                                    title="System failure"
                                                    aria-hidden
                                                />
                                            )}
                                            {analysis.status === 'warning' && (
                                                <AlertTriangle
                                                    size={16}
                                                    className={`flex-shrink-0 ${activeTab === array.id ? 'text-orange-200' : 'text-orange-500'}`}
                                                    title="Warning"
                                                    aria-hidden
                                                />
                                            )}
                                            {analysis.status !== 'error' &&
                                                analysis.status !== 'warning' && (
                                                    <CheckCircle
                                                        size={16}
                                                        className={`flex-shrink-0 ${activeTab === array.id ? 'text-green-200' : 'text-green-500'}`}
                                                        title="System compatible"
                                                        aria-hidden
                                                    />
                                                )}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    );
                })}
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
