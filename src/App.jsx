import React, { useEffect, useState } from 'react';
import Guide from './components/Guide';
import AppSidebar from './components/AppSidebar';
import ConfirmModal from './components/modals/ConfirmModal';
import AddAreaModal from './components/modals/AddAreaModal';
import AddArrayModal from './components/modals/AddArrayModal';
import AddPanelModal from './components/modals/AddPanelModal';
import AddChargerModal from './components/modals/AddChargerModal';
import PanelInfoModal from './components/modals/PanelInfoModal';
import ChargerInfoModal from './components/modals/ChargerInfoModal';
import ArrayPlannerModal from './components/modals/ArrayPlannerModal';
import SummaryView from './views/SummaryView';
import PanelsDbView from './views/PanelsDbView';
import ChargersDbView from './views/ChargersDbView';
import ArraySelectorView from './views/ArraySelectorView';
import Toast from './components/Toast';
import { useDataState, usePlannerState, useUiState } from './context/AppStateContext';
import { useBackupRestore } from './hooks/useBackupRestore';

export default function App() {
    const MIN_DESKTOP_WIDTH = 1024;
    const [isSmallScreen, setIsSmallScreen] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < MIN_DESKTOP_WIDTH;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleResize = () => {
            setIsSmallScreen(window.innerWidth < MIN_DESKTOP_WIDTH);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const {
        arraysData,
        areasData,
        panelsData,
        chargersData,
        userNotes,
        getArrayAnalysis,
        setPanelsData,
        setChargersData,
        handleAddArraySave,
        updateUserNote,
        getAreaSettings,
        handleAreaModalSave,
        deleteArea,
        deleteArray,
    } = useDataState();
    const {
        activeTab,
        setActiveTab,
        setAddAreaModal,
        setAddArrayModal,
        setAddPanelModal,
        setAddChargerModal,
        setInfoModalPanelId,
        setInfoModalChargerId,
        setConfirmModal,
        addAreaModal,
        addArrayModal,
        addPanelModal,
        addChargerModal,
        infoModalPanelId,
        infoModalChargerId,
        confirmModal,
        notification,
        clearNotification,
        setNotification,
        systemVoltage,
        openAddAreaModal,
        openAddArrayModal,
        openEditAreaModal,
        openEditArrayModal,
    } = useUiState();
    const { plannerModal, closePlanner, savePlannerToArray, savePlannerToDraftArray, applyPlannerCandidateToDraftArray } =
        usePlannerState();

    const { handleDownload, handleUploadClick, handleResetClick } = useBackupRestore();
    const activeArray = arraysData.find((a) => a.id === activeTab);
    const modalSystemVoltage = activeArray
        ? getAreaSettings(activeArray.area).systemVoltage
        : systemVoltage;
    const smallScreenTab = activeTab === 'GUIDE' ? 'GUIDE' : 'SUMMARY';

    if (isSmallScreen) {
        return (
            <div className="min-h-screen w-screen bg-slate-100 px-4 py-6">
                <div className="mx-auto flex w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-semibold text-slate-900">Larger screen required</h1>
                    <p className="mt-4 text-sm text-slate-600">
                        Solar Selector currently works best on desktop or large tablet screens.
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        You can still review guidance and high-level system summary below.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={`rounded-lg px-3 py-2 text-sm font-medium ${
                                smallScreenTab === 'SUMMARY'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            onClick={() => setActiveTab('SUMMARY')}
                        >
                            Summary
                        </button>
                        <button
                            type="button"
                            className={`rounded-lg px-3 py-2 text-sm font-medium ${
                                smallScreenTab === 'GUIDE'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            onClick={() => setActiveTab('GUIDE')}
                        >
                            Guide
                        </button>
                    </div>
                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        {smallScreenTab === 'GUIDE' ? <Guide /> : <SummaryView />}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
            <AppSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                arraysData={arraysData}
                areasData={areasData}
                getArrayAnalysis={getArrayAnalysis}
                onDownload={handleDownload}
                onUpload={handleUploadClick}
                onReset={handleResetClick}
                onAddArea={() => openAddAreaModal('')}
                onAddArray={(areaName) => openAddArrayModal({ area: areaName })}
                onEditArea={openEditAreaModal}
                onEditArray={openEditArrayModal}
            />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-8 relative min-h-full flex flex-col">
                    <div className="flex-1 min-h-0">
                        <div key={activeTab} className="animate-in fade-in duration-150">
                            {activeTab === 'GUIDE' ? (
                                <Guide />
                            ) : activeTab === 'SUMMARY' ? (
                                <SummaryView />
                            ) : activeTab === 'DB_PANELS' ? (
                                <PanelsDbView />
                            ) : activeTab === 'DB_CHARGERS' ? (
                                <ChargersDbView />
                            ) : (
                                <ArraySelectorView arrayId={activeTab} />
                            )}
                        </div>
                    </div>

                    <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-[10px] uppercase tracking-widest pb-4">
                        <p>© Copyright eChook 2026</p>
                        <p className="mt-1 normal-case italic tracking-normal">
                            This site uses affiliate links.
                        </p>
                    </footer>
                </div>
            </div>

            {notification && (
                <Toast
                    key={`${notification.variant}:${notification.message}`}
                    message={notification.message}
                    variant={notification.variant}
                    onClose={clearNotification}
                />
            )}

            <AddAreaModal
                open={addAreaModal.open}
                mode={addAreaModal.mode}
                value={addAreaModal.data}
                originalName={addAreaModal.originalName}
                areas={areasData}
                onClose={() =>
                    setAddAreaModal({ open: false, mode: 'add', data: '', originalName: null })
                }
                onSave={(name) => {
                    handleAreaModalSave(name);
                    setNotification(addAreaModal.mode === 'edit' ? 'Area updated.' : 'Area added.', 'success');
                }}
                onDelete={() => {
                    const targetAreaName = addAreaModal.originalName;
                    setAddAreaModal({ open: false, mode: 'add', data: '', originalName: null });
                    if (!targetAreaName) return;
                    deleteArea(targetAreaName);
                }}
            />
            <AddArrayModal
                open={addArrayModal.open}
                mode={addArrayModal.mode}
                data={addArrayModal.data}
                areas={areasData}
                onClose={() =>
                    setAddArrayModal({ open: false, mode: 'add', targetArrayId: null, data: {} })
                }
                onSave={(d) => {
                    handleAddArraySave(d);
                    setNotification(addArrayModal.mode === 'edit' ? 'Array updated.' : 'Array added.', 'success');
                }}
                onUpdateField={(field, value) =>
                    setAddArrayModal((prev) => ({
                        ...prev,
                        data: { ...prev.data, [field]: value },
                    }))
                }
                onDelete={() => {
                    const targetArrayId = addArrayModal.targetArrayId;
                    setAddArrayModal({ open: false, mode: 'add', targetArrayId: null, data: {} });
                    if (!targetArrayId) return;
                    deleteArray(targetArrayId);
                    setNotification('Array deleted.', 'success');
                }}
            />
            <AddPanelModal
                open={addPanelModal.open}
                data={addPanelModal.data}
                existingModelIds={panelsData.map((p) => p.model)}
                onClose={() => setAddPanelModal({ open: false, data: {} })}
                onSave={(d) => {
                    setPanelsData((prev) => [...prev, d]);
                    setAddPanelModal({ open: false, data: {} });
                    setNotification('Panel added.', 'success');
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
                    setChargersData((prev) => [...prev, d]);
                    setAddChargerModal({ open: false, data: {} });
                    setNotification('Controller added.', 'success');
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
                systemVoltage={modalSystemVoltage}
                userNote={infoModalChargerId ? userNotes[infoModalChargerId] || '' : ''}
                onClose={() => setInfoModalChargerId(null)}
                onUpdateNote={updateUserNote}
            />
            <ConfirmModal
                open={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                checkbox={confirmModal.checkbox}
                onConfirm={confirmModal.action}
                onCancel={() =>
                    setConfirmModal({
                        open: false,
                        title: '',
                        message: '',
                        action: null,
                        checkbox: null,
                    })
                }
            />
            <ArrayPlannerModal
                open={plannerModal.open}
                arrayId={plannerModal.arrayId}
                draftArrayData={plannerModal.draftArrayData}
                arraysData={arraysData}
                panelsData={panelsData}
                onClose={closePlanner}
                onApplyLayoutRejected={() =>
                    setNotification(
                        'No layout to apply. Wait for results or adjust the roof and filters.',
                        'warning'
                    )
                }
                onSavePlanner={(targetArrayId, plannerData) => {
                    if (targetArrayId) {
                        savePlannerToArray(targetArrayId, plannerData);
                    } else {
                        savePlannerToDraftArray(plannerData);
                    }
                    setNotification('Array updated from the previewed layout. Planner settings saved.', 'success');
                }}
                onApplyCandidateToDraft={applyPlannerCandidateToDraftArray}
            />
        </div>
    );
}
