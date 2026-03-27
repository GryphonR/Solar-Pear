import React, { createContext, useContext, useState, useMemo, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { GSE_COMPATIBILITY } from '../lib/gseCompatibility';

export const UI_STORAGE_KEYS = [
    'solar_hide_heavy_panels',
    'solar_hide_marginal_panels',
    'solar_hide_incompatible_panels',
    'solar_hide_incompatible_controllers',
    'solar_system_voltage',
    'solar_system_type',
    'solar_filter_eps',
    'solar_filter_house_backup',
    'solar_active_array_content_tab',
];

const UIContext = createContext(null);

export function UIProvider({ children }) {
    const [activeTab, setActiveTab] = useState('GUIDE');
    const [hideHeavyPanels, setHideHeavyPanels] = useLocalStorage('solar_hide_heavy_panels', false);
    const [hideMarginalPanels, setHideMarginalPanels] = useLocalStorage(
        'solar_hide_marginal_panels',
        false
    );
    const [hideIncompatiblePanels, setHideIncompatiblePanels] = useLocalStorage(
        'solar_hide_incompatible_panels',
        true
    );
    const [hideIncompatibleControllers, setHideIncompatibleControllers] = useLocalStorage(
        'solar_hide_incompatible_controllers',
        true
    );
    const [systemVoltage, setSystemVoltage] = useLocalStorage('solar_system_voltage', null);
    const [systemType, setSystemType] = useLocalStorage('solar_system_type', 'any');
    const [filterEps, setFilterEps] = useLocalStorage('solar_filter_eps', false);
    const [filterHouseBackup, setFilterHouseBackup] = useLocalStorage(
        'solar_filter_house_backup',
        false
    );
    const [panelSort, setPanelSort] = useState({ key: 'peakPower', dir: 'desc' });
    const [controllerSort, setControllerSort] = useState({ key: 'price', dir: 'asc' });
    const [activeSelectorTabs, setActiveSelectorTabs] = useState({});
    const [activeArrayContentTab, setActiveArrayContentTab] = useLocalStorage(
        'solar_active_array_content_tab',
        {}
    );
    const [infoModalPanelId, setInfoModalPanelId] = useState(null);
    const [infoModalChargerId, setInfoModalChargerId] = useState(null);
    const [addPanelModal, setAddPanelModal] = useState({ open: false, data: {} });
    const [addChargerModal, setAddChargerModal] = useState({ open: false, data: {} });
    const [addAreaModal, setAddAreaModal] = useState({ open: false, data: '' });
    const [addArrayModal, setAddArrayModal] = useState({ open: false, data: {} });
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        title: '',
        message: '',
        action: null,
    });
    const [hiddenChargerMfr, setHiddenChargerMfr] = useState(null);
    const [notification, setNotificationState] = useState(null);
    const notificationTimeoutRef = useRef(null);

    const clearNotification = () => {
        if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
        setNotificationState(null);
    };

    const setNotification = (message, variant = 'info') => {
        if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
        setNotificationState({ message, variant });
        notificationTimeoutRef.current = setTimeout(clearNotification, 5000);
    };

    const openConfirm = (title, message, action) => {
        setConfirmModal({ open: true, title, message, action });
    };

    const resetUI = () => {
        UI_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        setActiveTab('SUMMARY');
        setHideHeavyPanels(false);
        setHideMarginalPanels(false);
        setHideIncompatiblePanels(true);
        setHideIncompatibleControllers(true);
        setSystemVoltage(null);
        setSystemType('any');
        setFilterEps(false);
        setFilterHouseBackup(false);
        setActiveArrayContentTab({});
        setPanelSort({ key: 'peakPower', dir: 'desc' });
        setControllerSort({ key: 'price', dir: 'asc' });
        setHiddenChargerMfr(null);
        setNotificationState(null);
        setAddPanelModal({ open: false, data: {} });
        setAddChargerModal({ open: false, data: {} });
        setAddAreaModal({ open: false, data: '' });
        setAddArrayModal({ open: false, data: {} });
        setConfirmModal({ open: false, title: '', message: '', action: null });
    };

    const addPanel = () => {
        setAddPanelModal({
            open: true,
            data: {
                model: `panel_${Date.now()}`,
                name: '',
                manufacturer: '',
                power: 0,
                voc: 0,
                vmp: 0,
                isc: 0,
                price: 0,
                active: true,
                gseCompatibility: GSE_COMPATIBILITY.BOTH,
                height: 0,
                width: 0,
                weight: 0,
                efficiency: 0,
                glass: '',
                bifacial: false,
                cells: '',
                notes: '',
            },
        });
    };

    const addCharger = () => {
        setAddChargerModal({
            open: true,
            data: {
                id: '',
                name: '',
                manufacturer: '',
                type: 'charger',
                systemVoltages: systemVoltage != null ? [systemVoltage] : [48],
                maxV: 0,
                maxIsc: 0,
                startupV: 0,
                trackers: 1,
                price: 0,
                notes: '',
                datasheetUrl: '',
                buyLinks: {},
            },
        });
    };

    const value = useMemo(
        () => ({
            activeTab,
            setActiveTab,
            hideHeavyPanels,
            hideMarginalPanels,
            hideIncompatiblePanels,
            hideIncompatibleControllers,
            setHideHeavyPanels,
            setHideMarginalPanels,
            setHideIncompatiblePanels,
            setHideIncompatibleControllers,
            systemVoltage,
            systemType,
            filterEps,
            filterHouseBackup,
            setSystemVoltage,
            setSystemType,
            setFilterEps,
            setFilterHouseBackup,
            panelSort,
            controllerSort,
            activeSelectorTabs,
            activeArrayContentTab,
            setPanelSort,
            setControllerSort,
            setActiveSelectorTabs,
            setActiveArrayContentTab,
            infoModalPanelId,
            infoModalChargerId,
            addPanelModal,
            addChargerModal,
            addAreaModal,
            addArrayModal,
            confirmModal,
            setInfoModalPanelId,
            setInfoModalChargerId,
            setAddPanelModal,
            setAddChargerModal,
            setAddAreaModal,
            setAddArrayModal,
            setConfirmModal,
            hiddenChargerMfr,
            setHiddenChargerMfr,
            notification,
            setNotification,
            clearNotification,
            openConfirm,
            addPanel,
            addCharger,
            resetUI,
        }),
        [
            activeTab,
            hideHeavyPanels,
            hideMarginalPanels,
            hideIncompatiblePanels,
            hideIncompatibleControllers,
            systemVoltage,
            systemType,
            filterEps,
            filterHouseBackup,
            panelSort,
            controllerSort,
            activeSelectorTabs,
            activeArrayContentTab,
            infoModalPanelId,
            infoModalChargerId,
            addPanelModal,
            addChargerModal,
            addAreaModal,
            addArrayModal,
            confirmModal,
            hiddenChargerMfr,
            notification,
        ]
    );

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext() {
    const ctx = useContext(UIContext);
    if (!ctx) {
        throw new Error('useUIContext must be used within UIProvider');
    }
    return ctx;
}
