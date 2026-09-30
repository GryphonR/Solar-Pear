import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { MemoryRouter, useInRouterContext, useLocation, useNavigate } from 'react-router';
import { initialPanels, initialChargers } from '../data/loadData.js';
import { useLocalStorage, STORAGE_ERROR_EVENT } from '../hooks/useLocalStorage';
import { analyzeArray, conditionsFromAreaSettings, COLD_TEMP_C, HOT_TEMP_C } from '../lib/arrayAnalysis';
import { GSE_COMPATIBILITY } from '../lib/gseCompatibility';
import { applyReplacements, migrateArrays, migrateSelectionsAndSiteControllers } from '../lib/migration';
import replacements from '../data/replacements.json';
import {
    PROJECTS_KEY,
    addSystem,
    applyLegacyToProject,
    createProject as createProjectInStore,
    deleteProject as deleteProjectInStore,
    duplicateProject as duplicateProjectInStore,
    getActiveProject,
    legacyToProject,
    makeProject,
    makeStore,
    makeSystem,
    projectDefaults,
    projectToLegacy,
    setProjectDefaults,
    removeSystem,
    renameProject as renameProjectInStore,
    renameSystem,
    switchProject as switchProjectInStore,
    updateActiveProject,
    newId,
} from '../lib/projects';
import {
    loadProjectsStore,
    readLegacyAreas,
    removeLegacyDesignKeys,
    LEGACY_DESIGN_KEYS,
    saveProjectsStore,
} from '../lib/projectStorage';
import {
    CATALOGUE_OVERRIDES_KEY,
    LEGACY_CHARGERS_KEY,
    LEGACY_PANELS_KEY,
    STORAGE_VERSION_KEY,
    buildCatalogueOverrides,
    loadCatalogueFromStorage,
    saveCatalogueToStorage,
} from '../lib/catalogueOverrides';
import { arrayRoute, buildPath, isSamePath, resolveRoute, routeToTab, tabToPath } from '../lib/routes';

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
        // Selection fields (persisted on the array itself).
        panel: '',
        controllerInstanceId: '',
        controllerMppt: 1,
        controller: '',
    },
];

const initialSelections = {};
const DEFAULT_AREA_SETTINGS = {
    systemVoltage: null,
    systemType: 'any',
    filterEps: false,
    filterHouseBackup: false,
    designLowC: COLD_TEMP_C,
    designHighC: HOT_TEMP_C,
    strictCurrent: false,
};

const finiteOr = (value, fallback) =>
    value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value))
        ? Number(value)
        : fallback;

export const APP_STORAGE_KEYS = [
    PROJECTS_KEY,
    'solar_arrays',
    CATALOGUE_OVERRIDES_KEY,
    STORAGE_VERSION_KEY,
    'solar_site_controllers',
    'solar_hide_heavy_panels',
    'solar_hide_marginal_panels',
    'solar_hide_incompatible_panels',
    'solar_hide_incompatible_controllers',
    'solar_system_voltage',
    'solar_system_type',
    'solar_filter_eps',
    'solar_filter_house_backup',
    'solar_area_settings',
    'solar_areas',
    'user_notes',
    'solar_active_array_content_tab',
];

function freshProject() {
    return legacyToProject({
        areasData: ['House'],
        arraysData: initialArrays,
        areaSettingsByArea: { House: { ...DEFAULT_AREA_SETTINGS } },
    });
}

const AppStateContext = createContext(null);
const DataStateContext = createContext(null);
const UiStateContext = createContext(null);
const PlannerStateContext = createContext(null);

/**
 * App state. View state (which page, which array tab) lives in the URL, so the provider must sit
 * inside a router; `main.jsx` supplies a `BrowserRouter`. Without one (tests, isolated renders) it
 * falls back to an in-memory router starting at `/`.
 */
export function AppStateProvider({ children }) {
    const inRouter = useInRouterContext();
    if (!inRouter) {
        return (
            <MemoryRouter>
                <AppStateProviderInner>{children}</AppStateProviderInner>
            </MemoryRouter>
        );
    }
    return <AppStateProviderInner>{children}</AppStateProviderInner>;
}

function AppStateProviderInner({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    // Design data (systems, arrays, controller instances) lives in the active project of the projects
    // store (storage v3, roadmap 13.2). The flat shapes below are derived from it for the existing views.
    const initialStoreRef = useRef(undefined);
    if (initialStoreRef.current === undefined) initialStoreRef.current = loadProjectsStore() ?? null;
    const [projectsStore, setProjectsStore] = useState(
        () => initialStoreRef.current ?? makeStore([freshProject()])
    );
    // The catalogue lives in memory; only the user's edits are persisted (see catalogueOverrides.js).
    const [panelsData, setPanelsData] = useState(initialPanels);
    const [chargersData, setChargersData] = useState(initialChargers);
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
    const activeProject = getActiveProject(projectsStore);
    const areasData = useMemo(() => projectToLegacy(activeProject).areasData, [activeProject.systems]);
    const areaSettingsByArea = useMemo(
        () => projectToLegacy(activeProject).areaSettingsByArea,
        [activeProject.systems]
    );
    const arraysData = useMemo(
        () => projectToLegacy(activeProject).arraysData,
        [activeProject.arrays, activeProject.systems]
    );
    const siteControllers = useMemo(
        () => projectToLegacy(activeProject).siteControllers,
        [activeProject.siteControllers, activeProject.systems]
    );

    /** Builds a setter with the same API as useState for one legacy-shaped slice of the active project. */
    const legacySetter = (key) => (updater) =>
        setProjectsStore((store) =>
            updateActiveProject(store, (project) => {
                const current = projectToLegacy(project);
                const next = typeof updater === 'function' ? updater(current[key]) : updater;
                return applyLegacyToProject(project, { [key]: next });
            })
        );
    const setArraysData = legacySetter('arraysData');
    const setSiteControllers = legacySetter('siteControllers');
    const setAreasData = legacySetter('areasData');
    const setAreaSettingsByArea = legacySetter('areaSettingsByArea');

    const sanitizeAreaSettings = (settings, fallback = DEFAULT_AREA_SETTINGS) => ({
        systemVoltage:
            settings?.systemVoltage === null || Number.isFinite(Number(settings?.systemVoltage))
                ? settings?.systemVoltage ?? null
                : fallback.systemVoltage ?? null,
        systemType: settings?.systemType || fallback.systemType || 'any',
        filterEps:
            settings?.filterEps !== undefined
                ? !!settings.filterEps
                : !!fallback.filterEps,
        filterHouseBackup:
            settings?.filterHouseBackup !== undefined
                ? !!settings.filterHouseBackup
                : !!fallback.filterHouseBackup,
        designLowC: finiteOr(settings?.designLowC, finiteOr(fallback.designLowC, COLD_TEMP_C)),
        designHighC: finiteOr(settings?.designHighC, finiteOr(fallback.designHighC, HOT_TEMP_C)),
        strictCurrent:
            settings?.strictCurrent !== undefined
                ? !!settings.strictCurrent
                : !!fallback.strictCurrent,
        // Descriptive fields from System Setup (13.5). They don't filter anything by themselves.
        installType: settings?.installType ?? fallback.installType ?? null,
        gridMode: settings?.gridMode ?? fallback.gridMode ?? null,
    });

    const getAreaSettings = (areaName) => {
        const key = areaName || 'House';
        const existing = areaSettingsByArea?.[key];
        const legacyFallback = {
            systemVoltage,
            systemType,
            filterEps,
            filterHouseBackup,
        };
        return sanitizeAreaSettings(existing, legacyFallback);
    };

    const updateAreaSettings = (areaName, patch) => {
        const key = areaName || 'House';
        if (!patch || typeof patch !== 'object') return;
        setAreaSettingsByArea((prev) => {
            const next = { ...(prev || {}) };
            const current = sanitizeAreaSettings(next[key], {
                systemVoltage,
                systemType,
                filterEps,
                filterHouseBackup,
            });
            next[key] = sanitizeAreaSettings({ ...current, ...patch }, current);
            return next;
        });
    };

    // Derived shape preserved for existing UI/analysis code.
    // Selection values are stored directly on each array entry in `arraysData`.
    const selections = useMemo(() => {
        return arraysData.reduce((acc, a) => {
            const controllerMppt =
                a.controllerMppt !== undefined && Number.isFinite(Number(a.controllerMppt))
                    ? Number(a.controllerMppt)
                    : 1;
            acc[a.id] = {
                panel: a.panel ?? '',
                controllerInstanceId: a.controllerInstanceId ?? '',
                controllerMppt,
                controller: a.controller ?? '',
            };
            return acc;
        }, {});
    }, [arraysData]);

    const [panelSort, setPanelSort] = useState({ key: 'peakPower', dir: 'desc' });
    const [controllerSort, setControllerSort] = useState({ key: 'price', dir: 'asc' });
    const [activeSelectorTabs, setActiveSelectorTabs] = useState({});
    // Last content tab per array, so reopening an array from the sidebar returns to that tab.
    const [arrayTabMemory, setArrayTabMemory] = useLocalStorage('solar_active_array_content_tab', {});
    const arrayTabMemoryRef = useRef(arrayTabMemory);

    // The URL is the source of truth for the view (src/lib/routes.js, roadmap 13.3). A project id in the
    // URL selects the active project; until that switch lands the old UI shows the neutral summary.
    const { route, canonicalPath } = useMemo(
        () => resolveRoute(location.pathname, projectsStore),
        [location.pathname, projectsStore]
    );
    const routePending = !!route.projectId && route.projectId !== activeProject.id;
    const { tab: activeTab, contentTab: routeContentTab } = routePending
        ? { tab: 'SUMMARY', contentTab: null }
        : routeToTab(route);
    const activeArrayContentTab = useMemo(
        () => (routeContentTab ? { ...arrayTabMemory, [activeTab]: routeContentTab } : arrayTabMemory),
        [arrayTabMemory, activeTab, routeContentTab]
    );
    const locationRef = useRef(location);
    locationRef.current = location;

    // Remember the tab when the user arrives by URL, Back or Forward.
    useEffect(() => {
        if (!routeContentTab || arrayTabMemoryRef.current[activeTab] === routeContentTab) return;
        const next = { ...arrayTabMemoryRef.current, [activeTab]: routeContentTab };
        arrayTabMemoryRef.current = next;
        setArrayTabMemory(next);
    }, [activeTab, routeContentTab]);

    // Opening a link to another project makes it the active one (before paint, so nothing flickers).
    useLayoutEffect(() => {
        if (routePending && projectsStore.projects.some((p) => p.id === route.projectId)) {
            setProjectsStore((store) => switchProjectInStore(store, route.projectId));
        }
    }, [routePending, route.projectId, projectsStore.projects]);

    /**
     * Navigates to a view. Any tab that isn't a fixed view is an array id.
     *
     * @param {string} tab
     * @param {{ hash?: string, replace?: boolean }} [options] - `hash` scrolls to an in-page section
     */
    const setActiveTab = (tab, { hash, replace = false } = {}) => {
        const path = tabToPath(tab, { project: activeProject, contentTab: arrayTabMemoryRef.current[tab] });
        const target = hash ? `${path}#${hash}` : path;
        const current = locationRef.current;
        if (isSamePath(path, current.pathname) && (hash || '') === current.hash.replace(/^#/, '')) {
            // Already there: a repeat click on a section link should still scroll to it.
            if (hash) document.getElementById(hash)?.scrollIntoView?.({ block: 'start' });
            return;
        }
        navigate(target, { replace });
    };

    /** Same API as a state setter over `{ [arrayId]: contentTab }`; navigates when the open array's tab changes. */
    const setActiveArrayContentTab = (update) => {
        const next = typeof update === 'function' ? update(activeArrayContentTab) : update;
        arrayTabMemoryRef.current = next;
        setArrayTabMemory(next);
        if (routeContentTab && next[activeTab] && next[activeTab] !== routeContentTab) {
            const target = arrayRoute(activeProject, activeTab, next[activeTab]);
            if (target) navigate(buildPath(target));
        }
    };
    const [infoModalPanelId, setInfoModalPanelId] = useState(null);
    const [infoModalChargerId, setInfoModalChargerId] = useState(null);
    const [addPanelModal, setAddPanelModal] = useState({ open: false, data: {} });
    const [addChargerModal, setAddChargerModal] = useState({ open: false, data: {} });
    const [addAreaModal, setAddAreaModal] = useState({
        open: false,
        mode: 'add',
        data: '',
        originalName: null,
    });
    const [addArrayModal, setAddArrayModal] = useState({
        open: false,
        mode: 'add',
        targetArrayId: null,
        data: {},
    });
    const [plannerModal, setPlannerModal] = useState({
        open: false,
        arrayId: null,
        draftArrayData: null,
        returnTo: null, // 'addArray' | null
    });
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        title: '',
        message: '',
        action: null,
        checkbox: null,
    });
    const [userNotes, setUserNotes] = useLocalStorage('user_notes', {});
    const [hiddenChargerMfr, setHiddenChargerMfr] = useState(null);
    const [loadStatus, setLoadStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
    const [notification, setNotificationState] = useState(null); // { message, variant: 'success'|'error'|'warning'|'info' }

    const clearNotification = () => {
        setNotificationState(null);
    };

    /** `action` ({ label, onClick }) adds a button such as Undo to the toast. */
    const setNotification = (message, variant = 'info', action = null) => {
        setNotificationState({ message, variant, action });
    };

    useEffect(() => {
        try {
            let baseProject = null; // set when a v2 design is migrated
            if (!initialStoreRef.current && LEGACY_DESIGN_KEYS.some((k) => localStorage.getItem(k) != null)) {
                // Storage v2 -> v3: build one Local project called "My design" from the flat keys.
                const savedArrays = localStorage.getItem('solar_arrays');
                const migratedArrays = migrateArrays(savedArrays, initialArrays);
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
                const arraysWithSelections = migratedArrays.map((a) => ({
                    ...a,
                    ...(migratedSelections?.[a.id] || {}),
                }));
                const { areasData: savedAreas, areaSettingsByArea: savedSettings } = readLegacyAreas();
                baseProject = legacyToProject({
                    areasData: savedAreas ?? ['House'],
                    arraysData: arraysWithSelections,
                    siteControllers: migratedSiteControllers,
                    areaSettingsByArea: savedSettings ?? { House: { ...DEFAULT_AREA_SETTINGS } },
                });
            }

            const catalogue = loadCatalogueFromStorage(initialPanels, initialChargers);
            setPanelsData(catalogue.panels);
            setChargersData(catalogue.chargers);
            const notices = [];

            // Move saved designs off discontinued or renamed products (src/data/replacements.json).
            // Fresh visitors have nothing to migrate or replace, so the default project stays as it is.
            const baseStore = baseProject ? makeStore([baseProject]) : initialStoreRef.current;
            const replacedChanges = [];
            let migratedStore = baseStore;
            if (baseStore) {
                migratedStore = {
                    ...baseStore,
                    projects: baseStore.projects.map((project) => {
                        const result = applyReplacements(
                            { arrays: project.arrays, siteControllers: project.siteControllers },
                            replacements,
                            {
                                panelModels: new Set(catalogue.panels.map((p) => p.model)),
                                controllerIds: new Set(catalogue.chargers.map((c) => c.id)),
                            }
                        );
                        replacedChanges.push(...result.changes);
                        return result.changes.length === 0
                            ? project
                            : { ...project, arrays: result.arrays, siteControllers: result.siteControllers };
                    }),
                };
                // Only swap the state if nothing has edited it since it was loaded.
                if (baseProject) setProjectsStore(migratedStore);
                else if (replacedChanges.length > 0) {
                    setProjectsStore((current) => (current === initialStoreRef.current ? migratedStore : current));
                }
            }
            if (baseProject) {
                // Save now, and only remove the v2 keys once the v3 copy is safely written.
                try {
                    saveProjectsStore(migratedStore);
                    removeLegacyDesignKeys();
                } catch (error) {
                    console.warn('Error saving migrated projects', error);
                    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key: PROJECTS_KEY } }));
                }
            }
            const replaced = { changes: replacedChanges };
            if (replaced.changes.length > 0) {
                const byId = (list, key, id) => list.find((x) => x[key] === id)?.name || id;
                const lines = replaced.changes.map((c) =>
                    c.kind === 'panel'
                        ? byId(catalogue.panels, 'model', c.to)
                        : byId(catalogue.chargers, 'id', c.to)
                );
                notices.push(
                    `Some products in your design have been discontinued or renamed, so they were switched to their replacements: ${lines.join(', ')}. Check the array results.`
                );
            }
            if (catalogue.droppedEdits > 0) {
                notices.push(
                    `Catalogue prices have been refreshed. ${catalogue.droppedEdits} price or note ${
                        catalogue.droppedEdits === 1 ? 'value' : 'values'
                    } saved by an older version of Solar Pear ${
                        catalogue.droppedEdits === 1 ? 'was' : 'were'
                    } replaced with current data.`
                );
            }
            if (notices.length > 0) {
                setNotification(notices.join(' '), replaced.changes.length > 0 ? 'warning' : 'info');
            }
            setLoadStatus('ok');
        } catch (e) {
            console.error('Failed to migrate localStorage', e);
            setLoadStatus('error');
        }
    }, []);

    // Replace aliases, stale area names and unknown or deleted targets with the canonical URL.
    // Waits for the initial load so a link to a saved array isn't redirected before it exists.
    useEffect(() => {
        if (loadStatus !== 'ok' || isSamePath(canonicalPath, location.pathname)) return;
        navigate(`${canonicalPath}${location.hash}`, { replace: true });
    }, [loadStatus, canonicalPath, location.pathname, location.hash, navigate]);

    // Persist only the user's catalogue edits, once the initial load/migration has run.
    useEffect(() => {
        if (loadStatus !== 'ok') return;
        try {
            saveCatalogueToStorage(
                buildCatalogueOverrides(panelsData, chargersData, initialPanels, initialChargers)
            );
        } catch (error) {
            console.warn('Error saving catalogue overrides', error);
            window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key: CATALOGUE_OVERRIDES_KEY } }));
        }
    }, [panelsData, chargersData, loadStatus]);

    // Persist the projects store once the initial load/migration has run.
    useEffect(() => {
        if (loadStatus !== 'ok') return;
        try {
            saveProjectsStore(projectsStore);
        } catch (error) {
            console.warn('Error saving projects', error);
            window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key: PROJECTS_KEY } }));
        }
    }, [projectsStore, loadStatus]);

    // Warn once per session when the browser refuses to save (storage full, private mode, etc.).
    const storageWarningShown = useRef(false);
    useEffect(() => {
        const onStorageError = () => {
            if (storageWarningShown.current) return;
            storageWarningShown.current = true;
            setNotification(
                'Your browser could not save your latest changes (storage may be full or blocked). Download a backup now so you do not lose your design.',
                'error'
            );
        };
        window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
        return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
    }, []);

    useEffect(() => {
        setAreaSettingsByArea((prev) => {
            const source = prev && typeof prev === 'object' ? prev : {};
            const next = {};
            const legacyFallback = {
                systemVoltage,
                systemType,
                filterEps,
                filterHouseBackup,
            };
            areasData.forEach((area) => {
                next[area] = sanitizeAreaSettings(source[area], legacyFallback);
            });
            const sourceKeys = Object.keys(source);
            const nextKeys = Object.keys(next);
            if (
                sourceKeys.length === nextKeys.length &&
                sourceKeys.every((k) => next[k] && JSON.stringify(source[k]) === JSON.stringify(next[k]))
            ) {
                return prev;
            }
            return next;
        });
    }, [
        areasData,
        systemVoltage,
        systemType,
        filterEps,
        filterHouseBackup,
        setAreaSettingsByArea,
    ]);

    const startFresh = () => {
        performReset();
        setLoadStatus('ok');
    };

    const openConfirm = (title, message, action, options = {}) => {
        const checkbox = options.checkbox
            ? {
                  label: options.checkbox.label || '',
                  defaultChecked: !!options.checkbox.defaultChecked,
              }
            : null;
        setConfirmModal({ open: true, title, message, action, checkbox });
    };

    const performReset = () => {
        APP_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        // Legacy keys: no longer persisted by the app, but still cleared on reset.
        localStorage.removeItem('solar_selections');
        localStorage.removeItem(LEGACY_PANELS_KEY);
        localStorage.removeItem(LEGACY_CHARGERS_KEY);
        setPanelsData(initialPanels);
        setChargersData(initialChargers);
        setHideHeavyPanels(false);
        setHideMarginalPanels(false);
        setHideIncompatiblePanels(true);
        setHideIncompatibleControllers(true);
        setSystemVoltage(null);
        setSystemType('any');
        setFilterEps(false);
        setFilterHouseBackup(false);
        setUserNotes({});
        setHiddenChargerMfr(null);
        setPlannerModal({ open: false, arrayId: null, draftArrayData: null, returnTo: null });
        const fresh = makeStore([freshProject()]);
        setProjectsStore(fresh);
        navigate(buildPath({ view: 'summary', projectId: fresh.activeProjectId }));
    };

    const createControllerInstance = (modelId, area = areasData[0] || 'House') => {
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
        // Clear controller assignment from any arrays bound to the deleted instance.
        setArraysData((prev) =>
            prev.map((a) =>
                a.controllerInstanceId === instanceId
                    ? { ...a, controllerInstanceId: '', controllerMppt: 1, controller: '' }
                    : a
            )
        );
    };

    /**
     * Swaps a controller unit's model (13.6, "Replace…"). Arrays keep their port if the new model has it;
     * arrays on ports it doesn't have are unassigned. Returns how many were unassigned.
     */
    const replaceControllerInstance = (instanceId, modelId) => {
        const model = chargersData.find((c) => c.id === modelId);
        const instance = siteControllers.find((sc) => sc.id === instanceId);
        if (!model || !instance) return 0;
        const ports = Math.max(1, Number(model.trackers) || 1);
        const dropped = arraysData.filter(
            (a) => a.controllerInstanceId === instanceId && (Number(a.controllerMppt) || 1) > ports
        ).length;
        setSiteControllers((prev) =>
            prev.map((sc) =>
                sc.id === instanceId
                    ? { ...sc, modelId, name: `${model.manufacturer ? model.manufacturer + ' ' : ''}${model.name}` }
                    : sc
            )
        );
        if (dropped > 0) {
            setArraysData((prev) =>
                prev.map((a) =>
                    a.controllerInstanceId === instanceId && (Number(a.controllerMppt) || 1) > ports
                        ? { ...a, controllerInstanceId: '', controllerMppt: 1, controller: '' }
                        : a
                )
            );
        }
        return dropped;
    };

    const updateSelection = (arrayId, unitType, valueId, mpptIndex = 1) => {
        setArraysData((prev) =>
            prev.map((a) => {
                if (a.id !== arrayId) return a;
                if (unitType === 'controllerInstance') {
                    return { ...a, controllerInstanceId: valueId, controllerMppt: mpptIndex };
                }
                if (unitType === 'clearController') {
                    return { ...a, controllerInstanceId: '', controllerMppt: 1, controller: '' };
                }
                // e.g. unitType === 'panel' or 'controller' (legacy).
                return { ...a, [unitType]: valueId };
            })
        );
    };

    /** Update one field, or pass an object of fields as the second argument. */
    const updateArray = (id, fieldOrFields, value) => {
        if (fieldOrFields && typeof fieldOrFields === 'object' && !Array.isArray(fieldOrFields)) {
            setArraysData((prev) =>
                prev.map((a) => (a.id === id ? { ...a, ...fieldOrFields } : a))
            );
            return;
        }
        setArraysData((prev) => prev.map((a) => (a.id === id ? { ...a, [fieldOrFields]: value } : a)));
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
                type: 'charger',
                systemVoltages: systemVoltage != null ? [systemVoltage] : [48],
                maxV: 0,
                maxIsc: 0,
                startupV: 0,
                trackers: 1,
                price: 0,
                notes: '',
                datasheetUrl: '',
                discontinued: false,
                discontinuedNote: '',
                buyLinks: {},
            },
        });
    };

    const availableChargers = useMemo(
        () =>
            chargersData.filter((c) => {
                if (c.active === false) return false;
                return true;
            }),
        [chargersData]
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
                'panel-series': '',
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
                flexible: false,
                discontinued: false,
                discontinuedNote: '',
                cells: '',
                notes: '',
                datasheetUrl: '',
            },
        });
    };

    const openAddAreaModal = (initialName = '') => {
        setAddAreaModal({
            open: true,
            mode: 'add',
            data: initialName,
            originalName: null,
        });
    };

    const openEditAreaModal = (areaName) => {
        setAddAreaModal({
            open: true,
            mode: 'edit',
            data: areaName,
            originalName: areaName,
        });
    };

    const handleAreaModalSave = (name) => {
        const mode = addAreaModal.mode || 'add';
        if (mode === 'edit') {
            const previousName = addAreaModal.originalName;
            if (!previousName || name === previousName) return;
            // Systems have stable ids, so a rename leaves their arrays, controllers and settings attached.
            setProjectsStore((store) =>
                updateActiveProject(store, (project) => {
                    const system = project.systems.find((s) => s.name === previousName);
                    return system ? renameSystem(project, system.id, name) : project;
                })
            );
            return;
        }
        // New systems start from the project's default design temperatures (13.5).
        const settings = sanitizeAreaSettings(null, {
            systemVoltage,
            systemType,
            filterEps,
            filterHouseBackup,
            ...projectDefaults(activeProject),
        });
        setProjectsStore((store) =>
            updateActiveProject(store, (project) =>
                project.systems.some((s) => s.name === name) ? project : addSystem(project, name, settings).project
            )
        );
    };

    const openAddArrayModal = (options = {}) => {
        const area = options.area || areasData[0] || 'House';
        setAddArrayModal({
            open: true,
            mode: 'add',
            targetArrayId: null,
            data: {
                name: options.name || 'New Array',
                area,
                orientation: 'South',
                count: 6,
                format: 'Portrait',
                mounting: 'On Roof',
                maxPanelHeight: '',
                maxPanelWidth: '',
                maxPanelWeight: '',
            },
        });
    };

    const openEditArrayModal = (arrayId) => {
        const target = arraysData.find((array) => array.id === arrayId);
        if (!target) return;
        setAddArrayModal({
            open: true,
            mode: 'edit',
            targetArrayId: arrayId,
            data: {
                name: target.name || '',
                area: target.area || areasData[0] || 'House',
            },
        });
    };

    const openPlannerForNewArray = (draftArrayData) => {
        setAddArrayModal({
            open: false,
            mode: 'add',
            targetArrayId: null,
            data: draftArrayData || {},
        });
        setPlannerModal({
            open: true,
            arrayId: null,
            draftArrayData: draftArrayData || {},
            returnTo: 'addArray',
        });
    };

    const closePlanner = () => {
        // Read current modal from closure - do not nest setAddArrayModal inside a setState updater.
        const prev = plannerModal;
        setPlannerModal({ open: false, arrayId: null, draftArrayData: null, returnTo: null });
        if (prev.returnTo === 'addArray') {
            setAddArrayModal({
                open: true,
                mode: 'add',
                targetArrayId: null,
                data: prev.draftArrayData || {},
            });
        }
    };

    const savePlannerToArray = (arrayId, plannerData) => {
        if (!arrayId) return;
        setArraysData((prev) =>
            prev.map((a) => (a.id === arrayId ? { ...a, planner: plannerData } : a))
        );
    };

    const savePlannerToDraftArray = (plannerData) => {
        setPlannerModal((prev) => ({
            ...prev,
            draftArrayData: { ...(prev.draftArrayData || {}), planner: plannerData },
        }));
        setAddArrayModal((prev) => ({
            ...prev,
            data: { ...(prev.data || {}), planner: plannerData },
        }));
    };

    const applyPlannerCandidateToDraftArray = (fields) => {
        if (!fields || typeof fields !== 'object') return;
        setPlannerModal((prev) => ({
            ...prev,
            draftArrayData: { ...(prev.draftArrayData || {}), ...fields },
        }));
        setAddArrayModal((prev) => ({
            ...prev,
            data: { ...(prev.data || {}), ...fields },
        }));
    };

    const deleteArea = (areaName) => {
        if (areasData.length <= 1) {
            setNotification('You must have at least one Area remaining.', 'warning');
            return;
        }
        openConfirm(
            'Delete Area',
            `Are you sure you want to delete the Area "${areaName}"? Any arrays assigned to it will be safely moved to the first available area.`,
            (deleteArraysInArea = false) => {
                setProjectsStore((store) =>
                    updateActiveProject(store, (project) => {
                        const system = project.systems.find((s) => s.name === areaName);
                        return system
                            ? removeSystem(project, system.id, { deleteContents: deleteArraysInArea })
                            : project;
                    })
                );
            },
            {
                checkbox: {
                    label: 'Also delete all arrays in this area',
                    defaultChecked: false,
                },
            }
        );
    };

    const getArrayAnalysis = (arrayId) =>
        (() => {
            const array = arraysData.find((a) => a.id === arrayId);
            const areaSettings = getAreaSettings(array?.area || 'House');
            return analyzeArray(arrayId, {
                arraysData,
                panelsData,
                chargersData,
                siteControllers,
                selections,
                systemVoltage: areaSettings.systemVoltage,
                hideHeavyPanels,
                conditions: conditionsFromAreaSettings(areaSettings),
            });
        })();

    /**
     * Analysis of an array as it would be after `patch` (e.g. a previewed planner layout), without saving
     * anything (roadmap 13.8). Same engine and inputs as getArrayAnalysis; only the array's fields differ.
     */
    const analyzeArrayWith = (arrayId, patch) => {
        const patched = arraysData.map((a) => (a.id === arrayId ? { ...a, ...patch } : a));
        const array = patched.find((a) => a.id === arrayId);
        const areaSettings = getAreaSettings(array?.area || 'House');
        const patchedSelections = { ...selections };
        if (array) patchedSelections[arrayId] = { ...selections[arrayId], panel: array.panel ?? '' };
        return analyzeArray(arrayId, {
            arraysData: patched,
            panelsData,
            chargersData,
            siteControllers,
            selections: patchedSelections,
            systemVoltage: areaSettings.systemVoltage,
            hideHeavyPanels,
            conditions: conditionsFromAreaSettings(areaSettings),
        });
    };

    const handleAddArraySave = (d) => {
        if ((addArrayModal.mode || 'add') === 'edit' && addArrayModal.targetArrayId) {
            setArraysData((prev) =>
                prev.map((array) =>
                    array.id === addArrayModal.targetArrayId
                        ? { ...array, name: d.name, area: d.area }
                        : array
                )
            );
            return;
        }
        const newArrayId = newId('array');
        setArraysData((prev) => [
            ...prev,
            {
                id: newArrayId,
                ...d,
                panel: d.panel ?? '',
                controllerInstanceId: d.controllerInstanceId ?? '',
                controllerMppt: d.controllerMppt !== undefined ? d.controllerMppt : 1,
                controller: d.controller ?? '',
            },
        ]);
    };

    // First run (13.5): nothing was saved before this visit, so the new shell opens the chooser.
    const [isFirstRun, setIsFirstRun] = useState(
        () =>
            initialStoreRef.current === null &&
            !LEGACY_DESIGN_KEYS.some((k) => {
                try {
                    return localStorage.getItem(k) != null;
                } catch {
                    return false;
                }
            })
    );

    /**
     * Starts a project from a "What are you building?" preset. On first run it replaces the untouched
     * starter project rather than adding a second one. Opens the new system.
     */
    const startProjectFromPreset = (preset, name) => {
        const { area, ...starterArray } = initialArrays[0];
        const settings = sanitizeAreaSettings({ ...(preset?.settings || {}) }, { ...DEFAULT_AREA_SETTINGS });
        const system = makeSystem(preset?.systemName || 'House', settings);
        const project = makeProject({
            name: name || 'My design',
            systems: [system],
            arrays: [{ ...starterArray, id: newId('array'), systemId: system.id }],
        });
        const base = isFirstRun ? { ...projectsStore, projects: projectsStore.projects.filter((p) => p.id !== activeProject.id) } : projectsStore;
        setProjectsStore({ ...base, activeProjectId: project.id, projects: [...base.projects, project] });
        navigate(buildPath({ view: 'system', projectId: project.id, systemId: system.id }));
    };
    // First run ends once the user has left `/` (chosen a preset or skipped). Clearing it on navigation,
    // not on click, avoids a render at `/` without the chooser, which would redirect to the project.
    useEffect(() => {
        if (isFirstRun && route.view !== 'home' && route.view !== 'new') setIsFirstRun(false);
    }, [isFirstRun, route.view]);

    const updateProjectDefaults = (patch) =>
        setProjectsStore((store) => updateActiveProject(store, (project) => setProjectDefaults(project, patch)));

    // Project actions. Each one navigates to the resulting project, since the URL names the project.
    /** Navigates to a route object (see src/lib/routes.js). */
    const goTo = (target, options) => navigate(buildPath(target), options);
    const goToProject = (projectId) => goTo({ view: 'project', projectId });
    const createProject = (name) => {
        const { store, project } = createProjectInStore(projectsStore, name);
        setProjectsStore(store);
        goToProject(project.id);
    };
    const duplicateProject = (projectId = activeProject.id) => {
        const { store, project } = duplicateProjectInStore(projectsStore, projectId);
        if (!project) return;
        setProjectsStore(store);
        goToProject(project.id);
    };
    const renameProject = (projectId, name) => setProjectsStore((store) => renameProjectInStore(store, projectId, name));
    const switchProject = (projectId) => {
        setProjectsStore((store) => switchProjectInStore(store, projectId));
        goToProject(projectId);
    };
    const deleteProject = (projectId) => {
        const next = deleteProjectInStore(projectsStore, projectId);
        setProjectsStore(next);
        if (projectId === activeProject.id) goToProject(next.activeProjectId);
    };

    const value = useMemo(
        () => ({
            // State
            projectsStore,
            activeProject,
            route: routePending ? { view: 'pending' } : route,
            goTo,
            isFirstRun,
            startProjectFromPreset,
            updateProjectDefaults,
            activeTab,
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            areasData,
            areaSettingsByArea,
            userNotes,
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
            plannerModal,
            confirmModal,
            hiddenChargerMfr,
            notification,
            // Derived
            availableChargers,
            getArrayAnalysis,
            analyzeArrayWith,
            // Actions
            setProjectsStore,
            createProject,
            duplicateProject,
            renameProject,
            switchProject,
            deleteProject,
            setActiveTab,
            setArraysData,
            setPanelsData,
            setChargersData,
            setSiteControllers,
            setAreasData,
            setAreaSettingsByArea,
            setUserNotes,
            setHideHeavyPanels,
            setHideMarginalPanels,
            setHideIncompatiblePanels,
            setHideIncompatibleControllers,
            setSystemVoltage,
            setSystemType,
            setFilterEps,
            setFilterHouseBackup,
            getAreaSettings,
            updateAreaSettings,
            setPanelSort,
            setControllerSort,
            setActiveSelectorTabs,
            setActiveArrayContentTab,
            setInfoModalPanelId,
            setInfoModalChargerId,
            setAddPanelModal,
            setAddChargerModal,
            setAddAreaModal,
            setAddArrayModal,
            setPlannerModal,
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
            replaceControllerInstance,
            createControllerInstance,
            openConfirm,
            addPanel,
            addCharger,
            openAddArrayModal,
            openAddAreaModal,
            openEditAreaModal,
            openEditArrayModal,
            handleAreaModalSave,
            handleAddArraySave,
            openPlannerForNewArray,
            closePlanner,
            savePlannerToArray,
            savePlannerToDraftArray,
            applyPlannerCandidateToDraftArray,
            performReset,
            loadStatus,
            startFresh,
            setNotification,
            clearNotification,
        }),
        [
            projectsStore,
            isFirstRun,
            route,
            routePending,
            activeTab,
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections,
            areasData,
            areaSettingsByArea,
            userNotes,
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
            plannerModal,
            confirmModal,
            hiddenChargerMfr,
            notification,
            availableChargers,
            loadStatus,
        ]
    );

    const dataStateValue = useMemo(
        () => ({
            projectsStore: value.projectsStore,
            activeProject: value.activeProject,
            setProjectsStore: value.setProjectsStore,
            createProject: value.createProject,
            duplicateProject: value.duplicateProject,
            renameProject: value.renameProject,
            switchProject: value.switchProject,
            deleteProject: value.deleteProject,
            startProjectFromPreset: value.startProjectFromPreset,
            updateProjectDefaults: value.updateProjectDefaults,
            arraysData: value.arraysData,
            panelsData: value.panelsData,
            chargersData: value.chargersData,
            siteControllers: value.siteControllers,
            selections: value.selections,
            areasData: value.areasData,
            areaSettingsByArea: value.areaSettingsByArea,
            userNotes: value.userNotes,
            availableChargers: value.availableChargers,
            getArrayAnalysis: value.getArrayAnalysis,
            analyzeArrayWith: value.analyzeArrayWith,
            getAreaSettings: value.getAreaSettings,
            updateAreaSettings: value.updateAreaSettings,
            setArraysData: value.setArraysData,
            setPanelsData: value.setPanelsData,
            setChargersData: value.setChargersData,
            setSiteControllers: value.setSiteControllers,
            setAreasData: value.setAreasData,
            setAreaSettingsByArea: value.setAreaSettingsByArea,
            setUserNotes: value.setUserNotes,
            updateArray: value.updateArray,
            updatePanel: value.updatePanel,
            updateCharger: value.updateCharger,
            updateSelection: value.updateSelection,
            updateUserNote: value.updateUserNote,
            deleteArray: value.deleteArray,
            deleteArea: value.deleteArea,
            deleteControllerInstance: value.deleteControllerInstance,
            replaceControllerInstance: value.replaceControllerInstance,
            createControllerInstance: value.createControllerInstance,
            handleAreaModalSave: value.handleAreaModalSave,
            handleAddArraySave: value.handleAddArraySave,
            performReset: value.performReset,
            loadStatus: value.loadStatus,
            startFresh: value.startFresh,
        }),
        [value]
    );

    const uiStateValue = useMemo(
        () => ({
            activeTab: value.activeTab,
            route: value.route,
            goTo: value.goTo,
            isFirstRun: value.isFirstRun,
            hideHeavyPanels: value.hideHeavyPanels,
            hideMarginalPanels: value.hideMarginalPanels,
            hideIncompatiblePanels: value.hideIncompatiblePanels,
            hideIncompatibleControllers: value.hideIncompatibleControllers,
            systemVoltage: value.systemVoltage,
            systemType: value.systemType,
            filterEps: value.filterEps,
            filterHouseBackup: value.filterHouseBackup,
            panelSort: value.panelSort,
            controllerSort: value.controllerSort,
            activeSelectorTabs: value.activeSelectorTabs,
            activeArrayContentTab: value.activeArrayContentTab,
            infoModalPanelId: value.infoModalPanelId,
            infoModalChargerId: value.infoModalChargerId,
            addPanelModal: value.addPanelModal,
            addChargerModal: value.addChargerModal,
            addAreaModal: value.addAreaModal,
            addArrayModal: value.addArrayModal,
            confirmModal: value.confirmModal,
            hiddenChargerMfr: value.hiddenChargerMfr,
            notification: value.notification,
            setActiveTab: value.setActiveTab,
            setHideHeavyPanels: value.setHideHeavyPanels,
            setHideMarginalPanels: value.setHideMarginalPanels,
            setHideIncompatiblePanels: value.setHideIncompatiblePanels,
            setHideIncompatibleControllers: value.setHideIncompatibleControllers,
            setSystemVoltage: value.setSystemVoltage,
            setSystemType: value.setSystemType,
            setFilterEps: value.setFilterEps,
            setFilterHouseBackup: value.setFilterHouseBackup,
            setPanelSort: value.setPanelSort,
            setControllerSort: value.setControllerSort,
            setActiveSelectorTabs: value.setActiveSelectorTabs,
            setActiveArrayContentTab: value.setActiveArrayContentTab,
            setInfoModalPanelId: value.setInfoModalPanelId,
            setInfoModalChargerId: value.setInfoModalChargerId,
            setAddPanelModal: value.setAddPanelModal,
            setAddChargerModal: value.setAddChargerModal,
            setAddAreaModal: value.setAddAreaModal,
            setAddArrayModal: value.setAddArrayModal,
            setConfirmModal: value.setConfirmModal,
            setHiddenChargerMfr: value.setHiddenChargerMfr,
            addPanel: value.addPanel,
            addCharger: value.addCharger,
            openConfirm: value.openConfirm,
            openAddArrayModal: value.openAddArrayModal,
            openAddAreaModal: value.openAddAreaModal,
            openEditAreaModal: value.openEditAreaModal,
            openEditArrayModal: value.openEditArrayModal,
            clearNotification: value.clearNotification,
            setNotification: value.setNotification,
        }),
        [value]
    );

    const plannerStateValue = useMemo(
        () => ({
            plannerModal: value.plannerModal,
            setPlannerModal: value.setPlannerModal,
            openPlannerForNewArray: value.openPlannerForNewArray,
            closePlanner: value.closePlanner,
            savePlannerToArray: value.savePlannerToArray,
            savePlannerToDraftArray: value.savePlannerToDraftArray,
            applyPlannerCandidateToDraftArray: value.applyPlannerCandidateToDraftArray,
        }),
        [value]
    );

    const renderStateProviders = (content) => (
        <AppStateContext.Provider value={value}>
            <DataStateContext.Provider value={dataStateValue}>
                <UiStateContext.Provider value={uiStateValue}>
                    <PlannerStateContext.Provider value={plannerStateValue}>
                        {content}
                    </PlannerStateContext.Provider>
                </UiStateContext.Provider>
            </DataStateContext.Provider>
        </AppStateContext.Provider>
    );

    if (loadStatus === 'loading') {
        if (import.meta.env?.VITEST) {
            return renderStateProviders(children);
        }
        return (
            renderStateProviders(
                <div className="fixed inset-0 flex items-center justify-center bg-slate-100" aria-live="polite" aria-busy="true">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-600 font-medium">Loading saved data…</p>
                    </div>
                </div>
            )
        );
    }

    if (loadStatus === 'error') {
        return (
            renderStateProviders(
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
            )
        );
    }

    return renderStateProviders(children);
}

export function useAppState() {
    const ctx = useContext(AppStateContext);
    if (!ctx) {
        throw new Error('useAppState must be used within AppStateProvider');
    }
    return ctx;
}

export function useDataState() {
    const ctx = useContext(DataStateContext);
    if (!ctx) {
        throw new Error('useDataState must be used within AppStateProvider');
    }
    return ctx;
}

export function useUiState() {
    const ctx = useContext(UiStateContext);
    if (!ctx) {
        throw new Error('useUiState must be used within AppStateProvider');
    }
    return ctx;
}

export function usePlannerState() {
    const ctx = useContext(PlannerStateContext);
    if (!ctx) {
        throw new Error('usePlannerState must be used within AppStateProvider');
    }
    return ctx;
}
