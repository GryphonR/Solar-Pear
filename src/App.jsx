import React from 'react';
import Guide from './components/Guide';
import AppSidebar from './components/AppSidebar';
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
import Toast from './components/Toast';
import { useAppState } from './context/AppStateContext';
import { useBackupRestore } from './hooks/useBackupRestore';

export default function App() {
    const {
        activeTab,
        setActiveTab,
        arraysData,
        areasData,
        panelsData,
        chargersData,
        userNotes,
        getArrayAnalysis,
        setAreasData,
        setArraysData,
        setPanelsData,
        setChargersData,
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
        handleAddArraySave,
        updateUserNote,
        notification,
        clearNotification,
        setNotification,
        systemVoltage,
    } = useAppState();

    const { handleDownload, handleUploadClick, handleResetClick } = useBackupRestore();

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
            />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-8 relative min-h-full flex flex-col">
                    {notification && (
                        <div className="mb-4">
                            <Toast
                                message={notification.message}
                                variant={notification.variant}
                                onClose={clearNotification}
                            />
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
                        <div key={activeTab} className="animate-in fade-in duration-150">
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
                onSave={(name) => {
                    setAreasData([...areasData, name]);
                    setNotification('Area added.', 'success');
                }}
                onChange={(val) => setAddAreaModal((prev) => ({ ...prev, data: val }))}
            />
            <AddArrayModal
                open={addArrayModal.open}
                data={addArrayModal.data}
                areas={areasData}
                onClose={() => setAddArrayModal({ open: false, data: {} })}
                onSave={(d) => {
                    handleAddArraySave(d);
                    setNotification('Array added.', 'success');
                }}
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
                    setChargersData([...chargersData, d]);
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
                systemVoltage={systemVoltage}
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
