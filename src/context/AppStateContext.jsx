import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import initialPanels from '../data/panels.json';
import initialChargers from '../data/chargers.json';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { analyzeArray } from '../lib/arrayAnalysis';
import {
    migrateArrays,
    migrateSelectionsAndSiteControllers,
    mergeChargers,
    mergePanels,
} from '../lib/migration';

const initialArrays = [
    {
        id: 'A1',
        name: 'Array 1',
        area: 'House',
        orientation: 'South',
        count: 1,
        format: 'Portrait',
        mounting: 'On Roof',
        maxPanelHeight: '',
        maxPanelWidth: '',
    },
];

const initialSelections = {};

export const APP_STORAGE_KEYS = [
    'solar_arrays',
    'solar_panels',
    'solar_chargers',
    'solar_site_controllers',
    'solar_selections',
    'solar_hide_heavy_panels',
    'solar_hide_marginal_panels',
    'solar_system_voltage',
    'solar_system_type',
    'solar_filter_eps',
    'solar_filter_house_backup',
    'solar_areas',
    'user_notes',
];

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
    const [activeTab, setActiveTab] = useState('GUIDE');

    const [arraysData, setArraysData] = useLocalStorage('solar_arrays', initialArrays);
    const [panelsData, setPanelsData] = useLocalStorage('solar_panels', initialPanels);
    const [chargersData, setChargersData] = useLocalStorage('solar_chargers', initialChargers);
    const [siteControllers, setSiteControllers] = useLocalStorage('solar_site_controllers', []);
    const [selections, setSelections] = useLocalStorage('solar_selections', initialSelections);
    const [hideHeavyPanels, setHideHeavyPanels] = useLocalStorage('solar_hide_heavy_panels', false);
    const [hideMarginalPanels, setHideMarginalPanels] = useLocalStorage(
        'solar_hide_marginal_panels',
        false
    );
    const [systemVoltage, setSystemVoltage] = useLocalStorage('solar_system_voltage', 48);
    const [systemType, setSystemType] = useLocalStorage('solar_system_type', 'grid-connected');
    const [filterEps, setFilterEps] = useLocalStorage('solar_filter_eps', false);
    const [filterHouseBackup, setFilterHouseBackup] = useLocalStorage(
        'solar_filter_house_backup',
        false
    );
    const [areasData, setAreasData] = useLocalStorage('solar_areas', ['House']);

    const [panelSort, setPanelSort] = useState({ key: 'peakPower', dir: 'desc' });
    const [controllerSort, setControllerSort] = useState({ key: 'price', dir: 'asc' });
    const [activeSelectorTabs, setActiveSelectorTabs] = useState({});
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
    const [userNotes, setUserNotes] = useLocalStorage('user_notes', {});
    const [hiddenChargerMfr, setHiddenChargerMfr] = useState(null);
    const [loadStatus, setLoadStatus] = useState('loading'); // 'loading' | 'ok' | 'error'

    useEffect(() => {
        try {
            const savedArrays = localStorage.getItem('solar_arrays');
            const migratedArrays = migrateArrays(savedArrays, initialArrays);
            setArraysData(migratedArrays);

            const savedSiteControllers = localStorage.getItem('solar_site_controllers');
            const savedSelections = localStorage.getItem('solar_selections');
            const { selections: migratedSelections, siteControllers: migratedSiteControllers } =
                migrateSelectionsAndSiteControllers({
                    savedSelectionsJson: savedSelections,
                    savedSiteControllersJson: savedSiteControllers,
                    savedArraysJson: savedArrays,
                    initialArrays,
                    initialSelections,
                    initialChargers,
                });
            setSelections(migratedSelections);
            setSiteControllers(migratedSiteControllers);

            const savedChargers = localStorage.getItem('solar_chargers');
            const mergedChargers = mergeChargers(initialChargers, { savedChargersJson: savedChargers });
            setChargersData(mergedChargers);

            const savedPanels = localStorage.getItem('solar_panels');
            if (savedPanels) {
                const mergedPanels = mergePanels(initialPanels, savedPanels);
                setPanelsData(mergedPanels);
            }
            setLoadStatus('ok');
        } catch (e) {
            console.error('Failed to migrate localStorage', e);
            setLoadStatus('error');
        }
    }, []);

    const startFresh = () => {
        performReset();
        setLoadStatus('ok');
    };

    const openConfirm = (title, message, action) => {
        setConfirmModal({ open: true, title, message, action });
    };

    const performReset = () => {
        APP_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        setArraysData(initialArrays);
        setPanelsData(initialPanels);
        setChargersData(initialChargers);
        setSiteControllers([]);
        setSelections(initialSelections);
        setAreasData(['House']);
        setHideHeavyPanels(false);
        setHideMarginalPanels(false);
        setSystemVoltage(48);
        setSystemType('grid-connected');
        setFilterEps(false);
        setFilterHouseBackup(false);
        setUserNotes({});
        setHiddenChargerMfr(null);
        setActiveTab('SUMMARY');
    };

    const createControllerInstance = (modelId, area = 'House') => {
        const model = chargersData.find((c) => c.id === modelId);
        if (!model) return null;
        const newInstanceId = `inst_${modelId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        setSiteControllers((prev) => {
            const newInstance = {
                id: newInstanceId,
                modelId,
                area,
                name: `${model.manufacturer ? model.manufacturer + ' ' : ''}${model.name} (#${prev.length + 1})`,
            };
            return [...prev, newInstance];
        });
        return newInstanceId;
    };

    const deleteControllerInstance = (instanceId) => {
        setSiteControllers((prev) => prev.filter((sc) => sc.id !== instanceId));
        setSelections((prev) => {
            const next = { ...prev };
            Object.entries(next).forEach(([arrId, sel]) => {
                if (sel.controllerInstanceId === instanceId) {
                    next[arrId] = { ...sel, controllerInstanceId: '', controllerMppt: 1, controller: '' };
                }
            });
            return next;
        });
    };

    const updateSelection = (arrayId, unitType, valueId, mpptIndex = 1) => {
        setSelections((prev) => {
            if (unitType === 'controllerInstance') {
                return {
                    ...prev,
                    [arrayId]: { ...prev[arrayId], controllerInstanceId: valueId, controllerMppt: mpptIndex },
                };
            }
            if (unitType === 'clearController') {
                return {
                    ...prev,
                    [arrayId]: { ...prev[arrayId], controllerInstanceId: '', controllerMppt: 1, controller: '' },
                };
            }
            return {
                ...prev,
                [arrayId]: { ...prev[arrayId], [unitType]: valueId },
            };
        });
    };

    const updateArray = (id, field, value) => {
        setArraysData((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    };

    const updatePanel = (model, field, value) => {
        setPanelsData((prev) => prev.map((p) => (p.model === model ? { ...p, [field]: value } : p)));
    };

    const updateUserNote = (model, note) => {
        setUserNotes((prev) => ({ ...prev, [model]: note }));
    };

    const updateCharger = (id, field, value) => {
        setChargersData((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    };

    const addCharger = () => {
        setAddChargerModal({
            open: true,
            data: {
                id: '',
                name: '',
                manufacturer: '',
                type: 'mppt',
                systemVoltages: [systemVoltage],
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

    const availableChargers = useMemo(
        () =>
            chargersData.filter((c) => {
                if (c.active === false) return false;
                if (
                    systemVoltage !== null &&
                    !(c.systemVoltages || [48]).includes(systemVoltage)
                )
                    return false;
                return true;
            }),
        [chargersData, systemVoltage]
    );

    const deleteArray = (id) => {
        setArraysData((prev) => prev.filter((a) => a.id !== id));
        if (activeTab === id) setActiveTab('SUMMARY');
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
                gseCompatibility: 'Both',
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

    const openAddArrayModal = () => {
        setAddArrayModal({
            open: true,
            data: {
                name: 'New Array',
                area: areasData[0] || 'House',
                orientation: 'South',
                count: 6,
                format: 'Portrait',
                mounting: 'On Roof',
                maxPanelHeight: '',
                maxPanelWidth: '',
            },
        });
    };

    const deleteArea = (areaName) => {
        if (areasData.length <= 1) {
            alert('You must have at least one Area remaining.');
            return;
        }
        openConfirm(
            'Delete Area',
            `Are you sure you want to delete the Area "${areaName}"? Any arrays assigned to it will be safely moved to the first available area.`,
            () => {
                const newAreas = areasData.filter((a) => a !== areaName);
                setAreasData(newAreas);
                setArraysData((prev) =>
                    prev.map((a) => (a.area === areaName ? { ...a, area: newAreas[0] } : a))
                );
            }
        );
    };

    const getArrayAnalysis = (arrayId) =>
        analyzeArray(arrayId, {
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
        });

    const handleAddArraySave = (d) => {
        const newId = `array_${Date.now()}`;
        setArraysData([...arraysData, { id: newId, ...d }]);
        setSelections((prev) => ({
            ...prev,
            [newId]: { panel: panelsData[0].model, controller: chargersData[0].id },
        }));
    };

    const value = useMemo(
        () => ({
            // State
            activeTab,
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            areasData,
            userNotes,
            hideHeavyPanels,
            hideMarginalPanels,
            systemVoltage,
            systemType,
            filterEps,
            filterHouseBackup,
            panelSort,
            controllerSort,
            activeSelectorTabs,
            infoModalPanelId,
            infoModalChargerId,
            addPanelModal,
            addChargerModal,
            addAreaModal,
            addArrayModal,
            confirmModal,
            hiddenChargerMfr,
            // Derived
            availableChargers,
            getArrayAnalysis,
            // Actions
            setActiveTab,
            setArraysData,
            setPanelsData,
            setChargersData,
            setSiteControllers,
            setSelections,
            setAreasData,
            setUserNotes,
            setHideHeavyPanels,
            setHideMarginalPanels,
            setSystemVoltage,
            setSystemType,
            setFilterEps,
            setFilterHouseBackup,
            setPanelSort,
            setControllerSort,
            setActiveSelectorTabs,
            setInfoModalPanelId,
            setInfoModalChargerId,
            setAddPanelModal,
            setAddChargerModal,
            setAddAreaModal,
            setAddArrayModal,
            setConfirmModal,
            setHiddenChargerMfr,
            updateArray,
            updatePanel,
            updateCharger,
            updateSelection,
            updateUserNote,
            deleteArray,
            deleteArea,
            deleteControllerInstance,
            createControllerInstance,
            openConfirm,
            addPanel,
            addCharger,
            openAddArrayModal,
            handleAddArraySave,
            performReset,
            loadStatus,
            startFresh,
        }),
        [
            activeTab,
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            areasData,
            userNotes,
            hideHeavyPanels,
            hideMarginalPanels,
            systemVoltage,
            systemType,
            filterEps,
            filterHouseBackup,
            panelSort,
            controllerSort,
            activeSelectorTabs,
            infoModalPanelId,
            infoModalChargerId,
            addPanelModal,
            addChargerModal,
            addAreaModal,
            addArrayModal,
            confirmModal,
            hiddenChargerMfr,
            availableChargers,
            loadStatus,
        ]
    );

    if (loadStatus === 'loading') {
        return (
            <AppStateContext.Provider value={value}>
                <div className="fixed inset-0 flex items-center justify-center bg-slate-100" aria-live="polite" aria-busy="true">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-600 font-medium">Loading saved data…</p>
                    </div>
                </div>
            </AppStateContext.Provider>
        );
    }

    if (loadStatus === 'error') {
        return (
            <AppStateContext.Provider value={value}>
                <div className="fixed inset-0 flex items-center justify-center bg-slate-100 p-6" role="alert">
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to load saved data</h2>
                        <p className="text-slate-600 text-sm mb-6">
                            There was a problem reading or migrating your stored configuration. You can start fresh with default settings.
                        </p>
                        <button
                            type="button"
                            onClick={startFresh}
                            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Start fresh
                        </button>
                    </div>
                </div>
            </AppStateContext.Provider>
        );
    }

    return (
        <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
    );
}

export function useAppState() {
    const ctx = useContext(AppStateContext);
    if (!ctx) {
        throw new Error('useAppState must be used within AppStateProvider');
    }
    return ctx;
}
