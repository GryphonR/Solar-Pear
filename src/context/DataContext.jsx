import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initialPanels, initialChargers } from '../data/loadData.js';
import { useLocalStorage } from '../hooks/useLocalStorage';
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
        maxPanelWeight: '',
    },
];

const initialSelections = {};

export const DATA_STORAGE_KEYS = [
    'solar_arrays',
    'solar_panels',
    'solar_chargers',
    'solar_site_controllers',
    'solar_selections',
    'solar_areas',
    'user_notes',
];

const DataContext = createContext(null);

export function DataProvider({ children }) {
    const [arraysData, setArraysData] = useLocalStorage('solar_arrays', initialArrays);
    const [panelsData, setPanelsData] = useLocalStorage('solar_panels', initialPanels);
    const [chargersData, setChargersData] = useLocalStorage('solar_chargers', initialChargers);
    const [siteControllers, setSiteControllers] = useLocalStorage('solar_site_controllers', []);
    const [selections, setSelections] = useLocalStorage('solar_selections', initialSelections);
    const [areasData, setAreasData] = useLocalStorage('solar_areas', ['House']);
    const [userNotes, setUserNotes] = useLocalStorage('user_notes', {});
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
        setLoadStatus('ok');
    };

    const performResetData = () => {
        DATA_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        setArraysData(initialArrays);
        setPanelsData(initialPanels);
        setChargersData(initialChargers);
        setSiteControllers([]);
        setSelections(initialSelections);
        setAreasData(['House']);
        setUserNotes({});
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

    /** Removes array from data and selections only. Caller should switch activeTab if needed. */
    const deleteArrayData = (id) => {
        setArraysData((prev) => prev.filter((a) => a.id !== id));
        setSelections((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleAddArraySave = (d) => {
        const newId = `array_${Date.now()}`;
        setArraysData([...arraysData, { id: newId, ...d }]);
        setSelections((prev) => ({
            ...prev,
            [newId]: {},
        }));
    };

    const value = useMemo(
        () => ({
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            areasData,
            userNotes,
            setArraysData,
            setPanelsData,
            setChargersData,
            setSiteControllers,
            setSelections,
            setAreasData,
            setUserNotes,
            updateArray,
            updatePanel,
            updateCharger,
            updateSelection,
            updateUserNote,
            deleteArrayData,
            deleteControllerInstance,
            createControllerInstance,
            handleAddArraySave,
            loadStatus,
            startFresh,
            performResetData,
        }),
        [
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            areasData,
            userNotes,
            loadStatus,
        ]
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
    const ctx = useContext(DataContext);
    if (!ctx) {
        throw new Error('useDataContext must be used within DataProvider');
    }
    return ctx;
}
