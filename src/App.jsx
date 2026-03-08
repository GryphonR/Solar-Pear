import React from 'react';
import SolarPearLogo from './components/SolarPearLogo';
import Guide from './components/Guide';
import {
    AlertTriangle,
    LayoutDashboard,
    Database,
    Server,
    Layers,
    RotateCcw,
    Download,
    Upload,
    Info,
} from './components/Icons';
import ConfirmModal from './components/modals/ConfirmModal';
import AddAreaModal from './components/modals/AddAreaModal';
import AddArrayModal from './components/modals/AddArrayModal';
import AddPanelModal from './components/modals/AddPanelModal';
import AddChargerModal from './components/modals/AddChargerModal';
import PanelInfoModal from './components/modals/PanelInfoModal';
import ChargerInfoModal from './components/modals/ChargerInfoModal';
import SummaryView from './views/SummaryView';
import ArraysDbView from './views/ArraysDbView';
import PanelsDbView from './views/PanelsDbView';
import ChargersDbView from './views/ChargersDbView';
import ArraySelectorView from './views/ArraySelectorView';
import { useAppState } from './context/AppStateContext';

export default function App() {
    const {
        activeTab,
        setActiveTab,
        arraysData,
        areasData,
        panelsData,
        chargersData,
        userNotes,
        selections,
        systemVoltage,
        hiddenChargerMfr,
        hideHeavyPanels,
        hideMarginalPanels,
        getArrayAnalysis,
        openConfirm,
        performReset,
        setAreasData,
        setArraysData,
        setPanelsData,
        setChargersData,
        setSelections,
        setSystemVoltage,
        setHiddenChargerMfr,
        setHideHeavyPanels,
        setHideMarginalPanels,
        setUserNotes,
        addAreaModal,
        setAddAreaModal,
        addArrayModal,
        setAddArrayModal,
        addPanelModal,
        setAddPanelModal,
        addChargerModal,
        setAddChargerModal,
        infoModalPanelId,
        setInfoModalPanelId,
        infoModalChargerId,
        setInfoModalChargerId,
        confirmModal,
        setConfirmModal,
        handleAddArraySave,
        updateUserNote,
    } = useAppState();

    /** Backup file schema version; see BACKUP_SCHEMA.md */
    const BACKUP_SCHEMA_VERSION = 1;

    const handleDownload = () => {
        const exportData = {
            schemaVersion: BACKUP_SCHEMA_VERSION,
            areasData,
            arraysData,
            panelsData,
            chargersData,
            selections,
            systemVoltage,
            hiddenChargerMfr,
            hideHeavyPanels,
            hideMarginalPanels,
            userNotes,
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solar_pear_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleUploadClick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        openConfirm(
            'Upload Backup File',
            'This will completely overwrite your CURRENT configuration with the loaded file. Do you wish to proceed?',
            () => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        const version = imported.schemaVersion;
                        if (version !== undefined && version > 1) {
                            alert(
                                `This backup was created with a newer schema (version ${version}). Some data may not load correctly. Consider updating the app.`
                            );
                        }
                        if (imported.areasData) setAreasData(imported.areasData);
                        if (imported.arraysData) setArraysData(imported.arraysData);
                        if (imported.panelsData) setPanelsData(imported.panelsData);
                        if (imported.chargersData) setChargersData(imported.chargersData);
                        if (imported.selections) setSelections(imported.selections);
                        if (imported.systemVoltage) setSystemVoltage(imported.systemVoltage);
                        if (imported.hiddenChargerMfr) setHiddenChargerMfr(imported.hiddenChargerMfr);
                        if (imported.hideHeavyPanels !== undefined)
                            setHideHeavyPanels(imported.hideHeavyPanels);
                        if (imported.hideMarginalPanels !== undefined)
                            setHideMarginalPanels(imported.hideMarginalPanels);
                        if (imported.userNotes) setUserNotes(imported.userNotes);
                        alert(
                            'Backup loaded successfully! You may need to refresh the page to see all changes.'
                        );
                    } catch (err) {
                        alert('Failed to parse the backup JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        );
        e.target.value = '';
    };

    const handleResetClick = () => {
        openConfirm(
            'Reset Application',
            'Are you sure you want to completely reset the application? All custom panels, PV controllers, arrays, and selections will be permanently lost.',
            performReset
        );
    };

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
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
                                                <span className="text-sm truncate mr-2">
                                                    {array.name}
                                                </span>
                                                {analysis.status === 'error' && (
                                                    <AlertTriangle
                                                        size={16}
                                                        className={`flex-shrink-0 ${activeTab === array.id ? 'text-red-200' : 'text-red-500'}`}
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
                            onClick={handleResetClick}
                            className="flex-1 flex items-center justify-center px-1 py-2 rounded-lg text-center transition-colors text-red-500 bg-slate-800 hover:bg-slate-700 hover:text-white"
                            title="Reset all settings to factory defaults"
                            aria-label="Reset all settings to factory defaults"
                        >
                            <RotateCcw size={16} />
                        </button>
                        <button
                            onClick={handleDownload}
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
                                onChange={handleUploadClick}
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-8 relative min-h-full flex flex-col">
                    <div className="flex-1">
                        {activeTab === 'GUIDE' ? (
                            <Guide />
                        ) : activeTab === 'SUMMARY' ? (
                            <SummaryView />
                        ) : activeTab === 'DB_ARRAYS' ? (
                            <ArraysDbView />
                        ) : activeTab === 'DB_PANELS' ? (
                            <PanelsDbView />
                        ) : activeTab === 'DB_CHARGERS' ? (
                            <ChargersDbView />
                        ) : (
                            <ArraySelectorView arrayId={activeTab} />
                        )}
                    </div>

                    <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-[10px] uppercase tracking-widest pb-4">
                        <p>© Copyright eChook 2026</p>
                        <p className="mt-1 normal-case italic tracking-normal">
                            This site uses affiliate links.
                        </p>
                    </footer>
                </div>
            </div>

            <AddAreaModal
                open={addAreaModal.open}
                value={addAreaModal.data}
                areas={areasData}
                onClose={() => setAddAreaModal({ open: false, data: '' })}
                onSave={(name) => setAreasData([...areasData, name])}
                onChange={(val) => setAddAreaModal((prev) => ({ ...prev, data: val }))}
            />
            <AddArrayModal
                open={addArrayModal.open}
                data={addArrayModal.data}
                areas={areasData}
                onClose={() => setAddArrayModal({ open: false, data: {} })}
                onSave={handleAddArraySave}
                onUpdateField={(field, value) =>
                    setAddArrayModal((prev) => ({
                        ...prev,
                        data: { ...prev.data, [field]: value },
                    }))
                }
            />
            <AddPanelModal
                open={addPanelModal.open}
                data={addPanelModal.data}
                existingModelIds={panelsData.map((p) => p.model)}
                onClose={() => setAddPanelModal({ open: false, data: {} })}
                onSave={(d) => {
                    setPanelsData([...panelsData, d]);
                    setAddPanelModal({ open: false, data: {} });
                }}
                onUpdateField={(field, value) =>
                    setAddPanelModal((prev) => ({
                        ...prev,
                        data: { ...prev.data, [field]: value },
                    }))
                }
            />
            <AddChargerModal
                open={addChargerModal.open}
                data={addChargerModal.data}
                existingIds={chargersData.map((c) => c.id)}
                onClose={() => setAddChargerModal({ open: false, data: {} })}
                onSave={(d) => {
                    setChargersData([...chargersData, d]);
                    setAddChargerModal({ open: false, data: {} });
                }}
                onUpdateField={(field, value) =>
                    setAddChargerModal((prev) => ({
                        ...prev,
                        data: { ...prev.data, [field]: value },
                    }))
                }
            />
            <PanelInfoModal
                open={!!infoModalPanelId}
                panel={panelsData.find((p) => p.model === infoModalPanelId)}
                userNote={infoModalPanelId ? userNotes[infoModalPanelId] || '' : ''}
                onClose={() => setInfoModalPanelId(null)}
                onUpdateNote={updateUserNote}
            />
            <ChargerInfoModal
                open={!!infoModalChargerId}
                charger={chargersData.find((c) => c.id === infoModalChargerId)}
                userNote={infoModalChargerId ? userNotes[infoModalChargerId] || '' : ''}
                onClose={() => setInfoModalChargerId(null)}
                onUpdateNote={updateUserNote}
            />
            <ConfirmModal
                open={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.action}
                onCancel={() =>
                    setConfirmModal({ open: false, title: '', message: '', action: null })
                }
            />
        </div>
    );
}
