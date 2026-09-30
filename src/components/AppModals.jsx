/**
 * @file AppModals.jsx
 * The toast and every app-level modal, used by the app shell (roadmap 13.4).
 */

import React from 'react';
import ConfirmModal from './modals/ConfirmModal';
import AddAreaModal from './modals/AddAreaModal';
import AddArrayModal from './modals/AddArrayModal';
import AddPanelModal from './modals/AddPanelModal';
import AddChargerModal from './modals/AddChargerModal';
import PanelInfoModal from './modals/PanelInfoModal';
import ChargerInfoModal from './modals/ChargerInfoModal';
import Toast from './Toast';
import { useDataState, useUiState } from '../context/AppStateContext';

/** @param {{ systemNoun?: string }} props - the UI calls an area a System (decision D9). */
export default function AppModals({ systemNoun = 'System' }) {
    const {
        arraysData,
        areasData,
        panelsData,
        chargersData,
        userNotes,
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
        openConfirm,
    } = useUiState();

    const activeArray = arraysData.find((a) => a.id === activeTab);
    const modalSystemVoltage = activeArray ? getAreaSettings(activeArray.area).systemVoltage : systemVoltage;

    return (
        <>
            {notification && (
                <Toast
                    key={`${notification.variant}:${notification.message}`}
                    message={notification.message}
                    variant={notification.variant}
                    action={notification.action || undefined}
                    onClose={clearNotification}
                />
            )}

            <AddAreaModal
                open={addAreaModal.open}
                mode={addAreaModal.mode}
                value={addAreaModal.data}
                originalName={addAreaModal.originalName}
                areas={areasData}
                noun={systemNoun}
                onClose={() =>
                    setAddAreaModal({ open: false, mode: 'add', data: '', originalName: null })
                }
                onSave={(name) => {
                    handleAreaModalSave(name);
                    setNotification(`${systemNoun} ${addAreaModal.mode === 'edit' ? 'updated' : 'added'}.`, 'success');
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
                systemNoun={systemNoun}
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
                    if (!targetArrayId) {
                        setAddArrayModal({ open: false, mode: 'add', targetArrayId: null, data: {} });
                        return;
                    }
                    openConfirm(
                        'Delete Array',
                        'Are you sure you want to delete this array? Its layout, panel selection, and controller assignment will be lost.',
                        () => {
                            setAddArrayModal({ open: false, mode: 'add', targetArrayId: null, data: {} });
                            deleteArray(targetArrayId);
                            setNotification('Array deleted.', 'success');
                        }
                    );
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
        </>
    );
}
