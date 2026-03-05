import React, { useState, useEffect, useRef } from 'react';
import initialPanels from './data/panels.json';
import initialChargers from './data/chargers.json';

// Inline SVG Icons
const AlertTriangle = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);
const CheckCircle = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
);
const Zap = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);
const LayoutDashboard = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
);
const Database = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" /></svg>
);
const Plus = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);
const Server = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>
);
const Layers = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
);
const Trash2 = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
);
const RotateCcw = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
);
const InfoIcon = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
);
const XIcon = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
const ExternalLink = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg>
);
const ShoppingCart = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
);
const ChevronDown = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);
const Cpu = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="2" x2="9" y2="4" /><line x1="15" y1="2" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="22" /><line x1="15" y1="20" x2="15" y2="22" /><line x1="20" y1="9" x2="22" y2="9" /><line x1="20" y1="14" x2="22" y2="14" /><line x1="2" y1="9" x2="4" y2="9" /><line x1="2" y1="14" x2="4" y2="14" /></svg>
);

// Smart buy button: disabled if no links, plain link if one, dropdown if many
function BuyButton({ buyLinks = {} }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const entries = Object.entries(buyLinks).filter(([, url]) => url && url.trim());

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (entries.length === 0) {
        return (
            <button disabled className="inline-flex items-center justify-center w-7 h-7 rounded bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" title="No purchase links available">
                <ShoppingCart size={14} />
            </button>
        );
    }
    if (entries.length === 1) {
        return (
            <a href={entries[0][1]} target="_blank" rel="noopener noreferrer sponsored" title={`Buy from ${entries[0][0]}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors border border-emerald-700">
                <ShoppingCart size={14} />
            </a>
        );
    }
    return (
        <div className="relative inline-block" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                title="Multiple purchase options"
                className="inline-flex items-center justify-center h-7 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors border border-emerald-700"
            >
                <ShoppingCart size={14} /> <ChevronDown size={12} className={`ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {entries.map(([supplier, url]) => (
                        <a key={supplier} href={url} target="_blank" rel="noopener noreferrer sponsored"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                            <ShoppingCart size={12} />{supplier}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

const initialArrays = [
    { id: 'NE', name: 'Array NE', orientation: 'East', count: 6, format: 'Portrait', mounting: 'In-Roof (GSE)', maxPanelHeight: '', maxPanelWidth: '' },
    { id: 'NW1', name: 'Array NW1', orientation: 'West', count: 8, format: 'Portrait', mounting: 'In-Roof (GSE)', maxPanelHeight: '', maxPanelWidth: '' },
    { id: 'NW2', name: 'Array NW2', orientation: 'West', count: 3, format: 'Landscape', mounting: 'In-Roof (GSE)', maxPanelHeight: '', maxPanelWidth: '' },
    { id: 'S', name: 'Array S', orientation: 'South', count: 5, format: 'Landscape', mounting: 'In-Roof (GSE)', maxPanelHeight: '', maxPanelWidth: '' },
    { id: 'SW', name: 'Array SW', orientation: 'West', count: 4, format: 'Portrait', mounting: 'In-Roof (GSE)', maxPanelHeight: '', maxPanelWidth: '' },
    { id: 'Garage', name: 'Array Garage', orientation: 'East', count: 3, format: 'Portrait', mounting: 'On Roof', maxPanelHeight: '', maxPanelWidth: '' },
];



const initialSelections = {
    'NE': { panel: 'trina430', controller: 'rs450_100' },
    'NW1': { panel: 'dmegc515', controller: 'rs450_100_shared' },
    'NW2': { panel: 'trina430', controller: 'm250_100_MC4' },
    'S': { panel: 'trina430', controller: 'rs450_100' },
    'SW': { panel: 'trina430', controller: 'rs450_100_shared' },
    'Garage': { panel: 'trina430', controller: 'm250_100_MC4' }
};

function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn('Error reading localStorage', error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.warn('Error setting localStorage', error);
        }
    };

    return [storedValue, setValue];
}

export default function App() {
    const [activeTab, setActiveTab] = useState('SUMMARY');

    const [arraysData, setArraysData] = useLocalStorage('victron_arrays', initialArrays);
    const [panelsData, setPanelsData] = useState(initialPanels);
    const [chargersData, setChargersData] = useLocalStorage('victron_chargers', initialChargers);
    const [selections, setSelections] = useLocalStorage('victron_selections', initialSelections);
    const [hideHeavyPanels, setHideHeavyPanels] = useLocalStorage('victron_hide_heavy_panels', false);
    const [hideMarginalPanels, setHideMarginalPanels] = useLocalStorage('victron_hide_marginal_panels', false);
    const [systemVoltage, setSystemVoltage] = useLocalStorage('victron_system_voltage', 48);
    const [hiddenChargerMfr, setHiddenChargerMfr] = useLocalStorage('victron_hidden_charger_mfr', []);

    // Modals & Sorting
    const [panelSort, setPanelSort] = useState({ key: 'peakPower', dir: 'desc' });
    const [infoModalPanelId, setInfoModalPanelId] = useState(null);
    const [addPanelModal, setAddPanelModal] = useState({ open: false, data: {} });
    const [addChargerModal, setAddChargerModal] = useState({ open: false, data: {} });
    const [isLoaded, setIsLoaded] = useState(false);
    const [userNotes, setUserNotes] = useState({});

    // Load initial data
    useEffect(() => {
        try {
            let extractedNotes = {};
            const savedNotes = localStorage.getItem('victron_user_notes');
            if (savedNotes) {
                extractedNotes = JSON.parse(savedNotes);
            }

            const savedArrays = localStorage.getItem('victron_arrays');
            if (savedArrays) {
                const parsed = JSON.parse(savedArrays);
                setArraysData(parsed.map(a => ({
                    ...a,
                    format: a.format || 'Portrait',
                    mounting: a.mounting || 'In-Roof (GSE)',
                    maxPanelHeight: a.maxPanelHeight || '',
                    maxPanelWidth: a.maxPanelWidth || ''
                })));
            }
            const savedSelections = localStorage.getItem('victron_selections');
            if (savedSelections) {
                const parsed = JSON.parse(savedSelections);
                // Migration: mppt -> controller
                const migrated = {};
                for (const arrId in parsed) {
                    migrated[arrId] = {
                        panel: parsed[arrId].panel,
                        controller: parsed[arrId].controller || parsed[arrId].mppt
                    };
                }
                setSelections(migrated);
            }

            // Migration mapping for old mppts/inverters keys to new unified chargers list
            const savedMppts = localStorage.getItem('victron_mppts');
            const savedInverters = localStorage.getItem('victron_inverters');
            const savedChargers = localStorage.getItem('victron_chargers');
            let mergedChargersMap = new Map();
            initialChargers.forEach(c => mergedChargersMap.set(c.id, { ...c }));

            if (savedChargers) {
                const parsed = JSON.parse(savedChargers);
                parsed.forEach(c => {
                    if (mergedChargersMap.has(c.id)) {
                        const initC = mergedChargersMap.get(c.id);
                        mergedChargersMap.set(c.id, { ...initC, price: c.price, notes: c.notes, active: c.active });
                    } else {
                        mergedChargersMap.set(c.id, c);
                    }
                });
            } else if (savedMppts || savedInverters) {
                // If we don't have victron_chargers but DO have old keys, migrate what we can
                if (savedMppts) {
                    const parsedMppts = JSON.parse(savedMppts);
                    parsedMppts.forEach(m => {
                        if (mergedChargersMap.has(m.id)) {
                            const initC = mergedChargersMap.get(m.id);
                            mergedChargersMap.set(m.id, { ...initC, price: m.price, notes: m.notes });
                        }
                    });
                }
                if (savedInverters) {
                    const parsedInverters = JSON.parse(savedInverters);
                    parsedInverters.forEach(i => {
                        if (mergedChargersMap.has(i.id)) {
                            const initC = mergedChargersMap.get(i.id);
                            mergedChargersMap.set(i.id, { ...initC, price: i.price, notes: i.notes });
                        }
                    });
                }
            }
            setChargersData(Array.from(mergedChargersMap.values()));

            const savedPanels = localStorage.getItem('victron_panels');
            if (savedPanels) {
                const parsed = JSON.parse(savedPanels);
                const initPanelsMap = new Map(initialPanels.map(p => [p.model, p]));
                const mergedPanels = parsed.map(savedP => {
                    const initP = initPanelsMap.get(savedP.model);
                    if (initP) {
                        return { ...initP, price: savedP.price, active: savedP.active, gseCompatibility: savedP.gseCompatibility || initP.gseCompatibility || 'Both' };
                    }
                    return savedP;
                });
                initialPanels.forEach(initP => {
                    if (!parsed.find(p => p.model === initP.model)) {
                        mergedPanels.push(initP);
                    }
                });
                setPanelsData(mergedPanels);
            }

            setUserNotes(extractedNotes);
            setIsLoaded(true);
        } catch (e) {
            console.error('Failed to load DB from localStorage', e);
            setIsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem('victron_arrays', JSON.stringify(arraysData));
            localStorage.setItem('victron_selections', JSON.stringify(selections));
            localStorage.setItem('victron_user_notes', JSON.stringify(userNotes));
            localStorage.setItem('victron_hide_heavy_panels', JSON.stringify(hideHeavyPanels));
            localStorage.setItem('victron_hide_marginal_panels', JSON.stringify(hideMarginalPanels));
        } catch (e) { }
    }, [arraysData, selections, userNotes, hideHeavyPanels, hideMarginalPanels, isLoaded]);

    const resetToDefaults = () => {
        if (!confirm('This will wipe all custom panels, settings, pricing, and system state. Are you sure?')) return;
        setArraysData(initialArrays);
        setPanelsData(initialPanels);
        setChargersData(initialChargers);
        setSelections(initialSelections);
        setHideHeavyPanels(false);
        setHideMarginalPanels(false);
        setSystemVoltage(48);
        setHiddenChargerMfr([]);
        setUserNotes({});
        localStorage.removeItem('victron_user_notes');
        setActiveTab('SUMMARY');
    };

    const updateSelection = (arrayId, unitType, valueId) => {
        setSelections(prev => ({
            ...prev,
            [arrayId]: { ...prev[arrayId], [unitType]: valueId }
        }));
    };

    const updateArray = (id, field, value) => {
        setArraysData(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const updatePanel = (model, field, value) => {
        setPanelsData(prev => prev.map(p => p.model === model ? { ...p, [field]: value } : p));
    };

    const updateUserNote = (model, note) => {
        setUserNotes(prev => ({
            ...prev,
            [model]: note
        }));
    };

    const updateCharger = (id, field, value) => {
        setChargersData(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addCharger = () => {
        setAddChargerModal({
            open: true,
            data: {
                id: `charger_${Date.now()}`,
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
                buyLinks: {}
            }
        });
    };

    // Derived manufacturer list for chargers
    const chargerManufacturers = [...new Set(chargersData.map(c => c.manufacturer || 'Unknown'))];
    const toggleChargerMfr = (mfr) => setHiddenChargerMfr(prev =>
        prev.includes(mfr) ? prev.filter(m => m !== mfr) : [...prev, mfr]
    );

    // PV Controllers visible for the current system voltage and not hidden by manufacturer
    const visibleChargers = chargersData.filter(c =>
        (c.systemVoltages || [48]).includes(systemVoltage) &&
        !hiddenChargerMfr.includes(c.manufacturer || 'Unknown')
    );

    const deleteArray = (id) => {
        setArraysData(prev => prev.filter(a => a.id !== id));
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
                notes: ''
            }
        });
    };

    const addArray = () => {
        const newId = `array_${Date.now()}`;
        setArraysData([...arraysData, { id: newId, name: 'New Array', orientation: 'South', count: 6, format: 'Portrait', mounting: 'In-Roof (GSE)', maxPanelHeight: '', maxPanelWidth: '' }]);
        setSelections(prev => ({
            ...prev,
            [newId]: { panel: panelsData[0].model, controller: chargersData[0].id }
        }));
    };

    const isCompatibleFormat = (array, panel) => {
        const aMounting = array.mounting || 'In-Roof (GSE)';
        if (aMounting === 'On Roof') return true;

        const pGseComp = panel.gseCompatibility || 'Both';
        const aFormat = array.format || 'Portrait';
        if (aFormat === 'Landscape' && pGseComp === 'Portrait Only') return false;
        if (aFormat === 'Portrait' && pGseComp === 'Landscape Only') return false;
        return true;
    };

    const getArrayAnalysis = (arrayId) => {
        const array = arraysData.find(a => a.id === arrayId);
        if (!array) return null;

        const sel = selections[arrayId] || {};

        let panel = panelsData.find(p => p.model === sel.panel);
        if (!panel) {
            panel = panelsData.find(p => p.active !== false && isCompatibleFormat(array, p)) || panelsData[0];
        }

        const controller = chargersData.find(c => c.id === sel.controller) || chargersData[0];

        const peakPower = panel.power * array.count;
        const stringVocSTC = panel.voc * array.count;
        const coldVoc = stringVocSTC * 1.084;

        const stringVmpSTC = panel.vmp * array.count;
        const hotVmp = stringVmpSTC * 0.90;

        const isVocError = coldVoc > controller.maxV;
        const isVocWarn = coldVoc > (controller.maxV * 0.94) && !isVocError;
        const isVmpError = hotVmp < controller.startupV;
        const isIscError = panel.isc > controller.maxIsc;
        const isFormatError = !isCompatibleFormat(array, panel);

        let status = 'valid';
        let messages = [];

        if (isFormatError) {
            status = 'error';
            const aFormat = array.format || 'Portrait';
            if (aFormat === 'Landscape') {
                messages.push(`FATAL PHYSICAL: The ${panel.name} is only compatible with Portrait GSE integrated trays.`);
            } else {
                messages.push(`FATAL PHYSICAL: The ${panel.name} is only compatible with Landscape GSE integrated trays.`);
            }
        }

        const isHeightOk = !array.maxPanelHeight || (panel.height && panel.height <= array.maxPanelHeight);
        const isWidthOk = !array.maxPanelWidth || (panel.width && panel.width <= array.maxPanelWidth);
        if (!isHeightOk || !isWidthOk) {
            status = 'error';
            messages.push(`FATAL PHYSICAL: The selected panel (${panel.height}x${panel.width}mm) exceeds your specified maximum dimensions for this array.`);
        }

        if (isVocError) {
            status = 'error';
            messages.push(`FATAL ELECTRICAL: Cold Voc (${coldVoc.toFixed(1)}V) exceeds PV controller limit (${controller.maxV}V). Will destroy hardware.`);
        } else if (isVocWarn) {
            if (status !== 'error') status = 'warning';
            messages.push(`Cold Voc (${coldVoc.toFixed(1)}V) is dangerously close to PV controller limit (${controller.maxV}V). Margin is too tight.`);
        }

        if (isVmpError) {
            status = 'error';
            messages.push(`FATAL ELECTRICAL: Hot Vmp (${hotVmp.toFixed(1)}V) is below PV controller startup threshold (${controller.startupV}V). Will not start on hot days.`);
        }

        if (isIscError) {
            status = 'error';
            messages.push(`FATAL ELECTRICAL: Panel Isc (${panel.isc}A) exceeds PV controller tracker limit (${controller.maxIsc}A).`);
        }

        if (messages.length === 0) {
            messages.push("Engineering verified. Configuration is safe.");
        }

        const cost = (panel.price * array.count) + controller.price;
        const costPerKWp = peakPower > 0 ? cost / (peakPower / 1000) : 0;

        return { panel, controller, array, coldVoc, hotVmp, peakPower, status, messages, cost, costPerKWp };
    };

    const renderAddPanelModal = () => {
        if (!addPanelModal.open) return null;
        const d = addPanelModal.data;
        const updateField = (field, value) => {
            setAddPanelModal(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
        };
        const handleSave = () => {
            setPanelsData([...panelsData, d]);
            setAddPanelModal({ open: false, data: {} });
        };
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                        <h2 className="text-2xl font-bold text-slate-800">Add Custom Solar Panel</h2>
                        <button onClick={() => setAddPanelModal({ open: false, data: {} })} className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors"><XIcon size={20} /></button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturer</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.manufacturer} onChange={(e) => updateField('manufacturer', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Panel Name</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.name} onChange={(e) => updateField('name', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Model ID (Unique)</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.model} onChange={(e) => updateField('model', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Peak Power (W)</label>
                                <input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.power} onChange={(e) => updateField('power', parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Electrical Specs (STC)</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Voc (V)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.voc} onChange={(e) => updateField('voc', parseFloat(e.target.value) || 0)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vmp (V)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.vmp} onChange={(e) => updateField('vmp', parseFloat(e.target.value) || 0)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Isc (A)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.isc} onChange={(e) => updateField('isc', parseFloat(e.target.value) || 0)} /></div>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Physical Specs</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Height (mm)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.height} onChange={(e) => updateField('height', parseInt(e.target.value) || 0)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Width (mm)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.width} onChange={(e) => updateField('width', parseInt(e.target.value) || 0)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Weight (kg)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.weight} onChange={(e) => updateField('weight', parseFloat(e.target.value) || 0)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GSE Compatibility</label>
                                <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.gseCompatibility} onChange={(e) => updateField('gseCompatibility', e.target.value)}>
                                    <option value="Both">Both</option>
                                    <option value="Portrait Only">Portrait Only</option>
                                    <option value="Landscape Only">Landscape Only</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price (£)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.price} onChange={(e) => updateField('price', parseFloat(e.target.value) || 0)} /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Engineering Notes</label><textarea className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.notes} onChange={(e) => updateField('notes', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Datasheet URL</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.datasheetUrl} onChange={(e) => updateField('datasheetUrl', e.target.value)} /></div>
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                        <button onClick={() => setAddPanelModal({ open: false, data: {} })} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm">Add Panel to Database</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAddChargerModal = () => {
        if (!addChargerModal.open) return null;
        const d = addChargerModal.data;
        const updateField = (field, value) => setAddChargerModal(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
        const toggleVoltage = (v) => {
            const current = d.systemVoltages || [];
            updateField('systemVoltages', current.includes(v) ? current.filter(x => x !== v) : [...current, v].sort());
        };
        const handleSave = () => {
            setChargersData([...chargersData, d]);
            setAddChargerModal({ open: false, data: {} });
        };
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                        <h2 className="text-2xl font-bold text-slate-800">Add Custom PV Controller</h2>
                        <button onClick={() => setAddChargerModal({ open: false, data: {} })} className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors"><XIcon size={20} /></button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Manufacturer</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.manufacturer} onChange={(e) => updateField('manufacturer', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Device Name</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.name} onChange={(e) => updateField('name', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Model ID (Unique)</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.id} onChange={(e) => updateField('id', e.target.value)} /></div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Device Type</label>
                                <select className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.type} onChange={(e) => updateField('type', e.target.value)}>
                                    <option value="mppt">Standalone MPPT</option>
                                    <option value="hybrid_inverter">Hybrid Inverter</option>
                                </select>
                            </div>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Supported Battery Voltages</h3>
                        <div className="flex gap-3">
                            {[12, 24, 48].map(v => (
                                <label key={v} className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded border border-slate-200 hover:bg-slate-100">
                                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" checked={(d.systemVoltages || []).includes(v)} onChange={() => toggleVoltage(v)} />
                                    <span className="text-sm font-bold text-slate-700">{v}V</span>
                                </label>
                            ))}
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">PV Input Limits (Per Tracker)</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Max PV (V)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.maxV} onChange={(e) => updateField('maxV', parseInt(e.target.value) || 0)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Startup PV (V)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.startupV} onChange={(e) => updateField('startupV', parseInt(e.target.value) || 0)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Max Isc (A)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.maxIsc} onChange={(e) => updateField('maxIsc', parseInt(e.target.value) || 0)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Number of Trackers</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.trackers} onChange={(e) => updateField('trackers', parseInt(e.target.value) || 1)} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price (£)</label><input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.price} onChange={(e) => updateField('price', parseInt(e.target.value) || 0)} /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Engineering Notes</label><textarea className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.notes} onChange={(e) => updateField('notes', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Datasheet URL</label><input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={d.datasheetUrl} onChange={(e) => updateField('datasheetUrl', e.target.value)} /></div>
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                        <button onClick={() => setAddChargerModal({ open: false, data: {} })} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors shadow-sm">Add Controller to Database</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderPanelInfoModal = () => {
        if (!infoModalPanelId) return null;

        const p = panelsData.find(panel => panel.model === infoModalPanelId);
        if (!p) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] relative animate-in zoom-in-95 duration-200">

                    {/* Header */}
                    <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{p.name}</h2>
                            <div className="flex items-center space-x-4 mt-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {p.power} Watts
                                </span>
                                <span className="text-sm font-medium text-slate-600">£{p.price} per unit</span>
                                {p.gseCompatibility === 'Both' && (
                                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">Portrait & Landscape</span>
                                )}
                                {p.gseCompatibility === 'Portrait Only' && (
                                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">Portrait GSE Only</span>
                                )}
                                {p.gseCompatibility === 'Landscape Only' && (
                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">Landscape GSE Only</span>
                                )}
                                {p.datasheetUrl && (
                                    <a href={p.datasheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors">
                                        <ExternalLink size={12} className="mr-1" /> Datasheet
                                    </a>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setInfoModalPanelId(null)}
                            className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors"
                        >
                            <XIcon size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto space-y-8 bg-white">

                        <div className="grid grid-cols-2 gap-6">
                            {/* Physical Specs */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Physical Specifications</h3>
                                <dl className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Dimensions</dt>
                                        <dd className="text-slate-800 font-semibold">{p.height || 'Unknown'} x {p.width || 'Unknown'} mm</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Weight</dt>
                                        <dd className="text-slate-800 font-semibold">{p.weight ? `${p.weight} kg` : 'Unknown'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Glass Type</dt>
                                        <dd className="text-slate-800 font-semibold">{p.glass || 'Unknown'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Bifaciality</dt>
                                        <dd className="text-slate-800 font-semibold">{p.bifacial ? 'Yes (Rear Yield)' : 'No (Mono-facial)'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Cell Layout</dt>
                                        <dd className="text-slate-800 font-semibold">{p.cells || 'Unknown'}</dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Electrical Specs */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Electrical Limits (STC)</h3>
                                <dl className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Efficiency</dt>
                                        <dd className="text-slate-800 font-semibold text-blue-700">{p.efficiency ? `${p.efficiency}%` : 'Unknown'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Voc (Open Circuit)</dt>
                                        <dd className="text-slate-800 font-semibold">{p.voc} V</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Vmp (Max Power)</dt>
                                        <dd className="text-slate-800 font-semibold">{p.vmp} V</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-500 font-medium">Isc (Short Circuit)</dt>
                                        <dd className="text-slate-800 font-semibold">{p.isc} A</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        {/* Engineering Notes */}
                        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                                <InfoIcon size={14} className="mr-2" /> Engineering Design Notes
                            </h3>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {p.notes || "No specific architectural notes for this module. Refer to standard datasheets."}
                            </p>
                        </div>

                        {/* User Custom Notes */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                                Your Persistent Notes
                            </h3>
                            <textarea
                                className="w-full p-4 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 min-h-[100px] resize-y shadow-inner"
                                placeholder="Log supplier quotes, lead times, compatibility thoughts, or personal preferences here..."
                                value={userNotes[p.model] || ''}
                                onChange={(e) => updateUserNote(p.model, e.target.value)}
                            />
                            <p className="text-xs text-slate-400 mt-2 text-right">Notes autosave to your browser.</p>
                        </div>

                    </div>
                </div>
            </div>
        );
    };

    const renderArrayTab = (arrayId) => {
        const analysis = getArrayAnalysis(arrayId);
        if (!analysis) return null;
        const { array, panel, controller, coldVoc, hotVmp, peakPower, status, messages, cost, costPerKWp } = analysis;

        const validPanels = panelsData.map(p => {
            const pPeakPower = p.power * array.count;
            const pStringVocSTC = p.voc * array.count;
            const pColdVoc = pStringVocSTC * 1.084;
            const pStringVmpSTC = p.vmp * array.count;
            const pHotVmp = pStringVmpSTC * 0.90;
            const pCost = p.price * array.count;
            const pCostPerKWp = pPeakPower > 0 ? pCost / (pPeakPower / 1000) : 0;

            const isPhysicallyOk = isCompatibleFormat(array, p);
            const isVocOk = pColdVoc <= controller.maxV;
            const isVmpOk = pHotVmp >= controller.startupV;
            const isIscOk = p.isc <= controller.maxIsc;

            const isWeightOk = !hideHeavyPanels || (p.weight && p.weight <= 25);

            const isHeightOk = !array.maxPanelHeight || (p.height && p.height <= array.maxPanelHeight);
            const isWidthOk = !array.maxPanelWidth || (p.width && p.width <= array.maxPanelWidth);
            const isSizeOk = isHeightOk && isWidthOk;

            // Marginal warning: Cold Voc within 6% of PV controller maximum limit
            const isVocWarn = pColdVoc > (controller.maxV * 0.94) && isVocOk;
            const isMarginalOk = !hideMarginalPanels || !isVocWarn;

            const isFullyCompatible = p.active !== false && isPhysicallyOk && isVocOk && isVmpOk && isIscOk && isWeightOk && isSizeOk && isMarginalOk;

            return { ...p, peakPower: pPeakPower, panelCost: pCost, costPerKWp: pCostPerKWp, isFullyCompatible, isVocWarn };
        }).filter(p => p.isFullyCompatible);

        validPanels.sort((a, b) => {
            const valA = a[panelSort.key];
            const valB = b[panelSort.key];
            if (valA < valB) return panelSort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return panelSort.dir === 'asc' ? 1 : -1;
            return 0;
        });

        const togglePanelSort = (key) => {
            setPanelSort(prev => ({
                key,
                dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
            }));
        };

        return (
            <div className="space-y-6 pb-12">
                <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{array.name}</h2>
                        <p className="text-slate-500">{array.orientation} Roof Direction • {array.count} Panels • {array.mounting === 'In-Roof (GSE)' ? `${array.format} Orientation (GSE)` : array.mounting}</p>
                    </div>
                    <div className="flex space-x-8 text-right">
                        <div>
                            <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Peak Power</p>
                            <p className="text-3xl font-light text-blue-600">{peakPower.toLocaleString()} <span className="text-xl">W</span></p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Total Cost / kWp</p>
                            <p className="text-3xl font-light text-slate-800">£{costPerKWp.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Total Array Cost</p>
                            <p className="text-3xl font-light text-slate-800">£{cost.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Currently Selected Panel</label>
                            <select
                                className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                                value={selections[arrayId]?.panel || analysis.panel.model}
                                onChange={(e) => updateSelection(arrayId, 'panel', e.target.value)}
                            >
                                {panelsData.filter(p => (p.active !== false && isCompatibleFormat(array, p)) || p.model === selections[arrayId]?.panel).map(p => (
                                    <option key={p.model} value={p.model}>{p.name} ({p.power}W) - £{p.price}</option>
                                ))}
                            </select>
                            {panelsData.some(p => p.active !== false && !isCompatibleFormat(array, p)) && (
                                <p className="text-xs text-slate-400 mt-2 italic">Some panels in the database are hidden as they physically conflict with this array's GSE requirements.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Select PV Controller</label>
                            <select
                                className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                                value={selections[arrayId]?.controller || chargersData[0]?.id}
                                onChange={(e) => updateSelection(arrayId, 'controller', e.target.value)}
                            >
                                {chargerManufacturers.filter(mfr => !hiddenChargerMfr.includes(mfr)).map(mfr => {
                                    const mfrChargers = visibleChargers.filter(c => (c.manufacturer || 'Unknown') === mfr);
                                    if (mfrChargers.length === 0) return null;
                                    return (
                                        <optgroup key={mfr} label={mfr}>
                                            {mfrChargers.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} (Max: {c.maxV}V){c.price > 0 ? ` — £${c.price}` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    );
                                })}
                            </select>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {chargerManufacturers.map(mfr => (
                                    <button key={mfr} onClick={() => toggleChargerMfr(mfr)}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${hiddenChargerMfr.includes(mfr)
                                            ? 'bg-slate-100 text-slate-400 border-slate-200'
                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                        {hiddenChargerMfr.includes(mfr) ? '+ ' : '✓ '}{mfr}
                                    </button>
                                ))}
                            </div>
                            {controller.type === 'hybrid_inverter' && (
                                <p className="text-xs text-slate-500 mt-2 italic">⚡ Hybrid inverter with built-in MPPT selected. PV string connects directly to this unit.</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg border-l-4 ${status === 'error' ? 'bg-red-50 border-red-500' : status === 'warning' ? 'bg-orange-50 border-orange-500' : 'bg-green-50 border-green-500'}`}>
                            <div className="flex items-start">
                                {status === 'error' ? <AlertTriangle className="text-red-500 mr-3 mt-1" size={20} /> : status === 'warning' ? <AlertTriangle className="text-orange-500 mr-3 mt-1" size={20} /> : <CheckCircle className="text-green-500 mr-3 mt-1" size={20} />}
                                <div>
                                    <h4 className={`font-bold ${status === 'error' ? 'text-red-800' : status === 'warning' ? 'text-orange-800' : 'text-green-800'}`}>
                                        {status === 'error' ? 'System Failure Detected' : status === 'warning' ? 'Warning' : 'System Compatible '}
                                    </h4>
                                    <ul className="mt-1 space-y-1">
                                        {messages.map((msg, i) => (
                                            <li key={i} className={`text-sm ${status === 'error' ? 'text-red-700' : status === 'warning' ? 'text-orange-700' : 'text-green-700'}`}>{msg}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cold Voc (-10°C)</p>
                                <p className={`text-2xl font-light ${coldVoc > controller.maxV ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{coldVoc.toFixed(1)} <span className="text-sm">V</span></p>
                                <p className="text-xs text-slate-400 mt-1">Controller Limit: {controller.maxV}V</p>
                            </div>

                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hot Vmp (65°C)</p>
                                <p className={`text-2xl font-light ${hotVmp < controller.startupV ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{hotVmp.toFixed(1)} <span className="text-sm">V</span></p>
                                <p className="text-xs text-slate-400 mt-1">Required to Start: {controller.startupV}V</p>
                            </div>

                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">String Isc</p>
                                <p className={`text-2xl font-light ${panel.isc > controller.maxIsc ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{panel.isc.toFixed(2)} <span className="text-sm">A</span></p>
                                <p className="text-xs text-slate-400 mt-1">Controller Limit: {controller.maxIsc}A</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Panel Info Readout */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6 mb-8">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                        <InfoIcon size={16} className="mr-2 text-blue-600" />
                        Selected Panel Intelligence: <span className="ml-2 font-normal">{panel.name}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-8 items-stretch">
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Engineering Notes</p>
                            <div className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200 shadow-inner flex-1">
                                {panel.notes || 'No specific architectural notes for this module.'}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end">
                                <span>Your Persistent Notes</span>
                                <span className="text-slate-400 text-[10px] normal-case font-normal">Autosaves</span>
                            </p>
                            <textarea
                                className="flex-1 w-full p-3 border border-yellow-300 rounded-lg bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 placeholder-slate-400 resize-y shadow-inner min-h-[80px]"
                                placeholder="Log supplier quotes, lead times, compatibility thoughts, or personal preferences here..."
                                value={userNotes[panel.model] || ''}
                                onChange={(e) => updateUserNote(panel.model, e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-200">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Compatible Panels Explorer</h3>
                            <p className="text-sm text-slate-500">Showing active panels that pass physical limits and strictly match the {controller.name} limits.</p>
                        </div>

                        <div className="flex items-stretch space-x-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex flex-col justify-center space-y-1 pr-4 border-r border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Max Allowed Dimensions</p>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        placeholder="Length (mm)"
                                        title="Maximum Panel Length (mm)"
                                        className="w-24 p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                        value={array.maxPanelHeight || ''}
                                        onChange={(e) => updateArray(array.id, 'maxPanelHeight', parseInt(e.target.value) || '')}
                                    />
                                    <span className="text-slate-400 text-xs">x</span>
                                    <input
                                        type="number"
                                        placeholder="Width (mm)"
                                        title="Maximum Panel Width (mm)"
                                        className="w-24 p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                        value={array.maxPanelWidth || ''}
                                        onChange={(e) => updateArray(array.id, 'maxPanelWidth', parseInt(e.target.value) || '')}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col justify-center space-y-2 pl-2">
                                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                                        checked={hideHeavyPanels}
                                        onChange={(e) => setHideHeavyPanels(e.target.checked)}
                                    />
                                    <span>Hide panels over 25kg</span>
                                </label>
                                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                                        checked={hideMarginalPanels}
                                        onChange={(e) => setHideMarginalPanels(e.target.checked)}
                                    />
                                    <span>Hide marginal voltage risks</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th onClick={() => togglePanelSort('name')} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none">
                                        Panel Name {panelSort.key === 'name' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th onClick={() => togglePanelSort('peakPower')} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none">
                                        Total Array Power {panelSort.key === 'peakPower' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th onClick={() => togglePanelSort('costPerKWp')} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none">
                                        Cost per kWp {panelSort.key === 'costPerKWp' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th onClick={() => togglePanelSort('panelCost')} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none">
                                        Total Panels Cost {panelSort.key === 'panelCost' && (panelSort.dir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {validPanels.length > 0 ? (
                                    validPanels.map(p => {
                                        const isSelected = (selections[arrayId]?.panel || analysis.panel.model) === p.model;
                                        return (
                                            <tr key={p.model} className={`border-b border-slate-100 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span>{p.name}</span>
                                                        <button onClick={() => setInfoModalPanelId(p.model)} className="text-slate-400 hover:text-blue-600 transition-colors" title="View Technical Specs">
                                                            <InfoIcon size={16} />
                                                        </button>
                                                        {p.datasheetUrl && (
                                                            <a href={p.datasheetUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors" title="View Manufacturer Datasheet">
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}
                                                        {p.isVocWarn && (
                                                            <AlertTriangle size={16} className="text-orange-500" title="Voltage Warning: Cold Voc is within 6% of MPPT limit. Margin is dangerously tight." />
                                                        )}
                                                        <BuyButton buyLinks={p.buyLinks} />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium text-blue-700">{p.peakPower.toLocaleString()} W</td>
                                                <td className="py-3 px-4">£{p.costPerKWp.toFixed(2)}</td>
                                                <td className="py-3 px-4">£{p.panelCost.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {isSelected ? (
                                                        <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                                            <CheckCircle size={14} className="mr-1" /> Selected
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => updateSelection(arrayId, 'panel', p.model)}
                                                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-xs font-bold rounded transition-colors"
                                                        >
                                                            Select Panel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="py-8 px-4 text-center text-slate-500 italic">
                                            <AlertTriangle className="mx-auto mb-2 text-slate-400" size={24} />
                                            No active panels meet both the physical format and the electrical constraints of the currently selected MPPT.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderArraysDb = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Array Configuration</h2>
                    <p className="text-slate-500">Add, edit, or remove physical roof arrays from the project scope.</p>
                </div>
                <button onClick={addArray} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    <Plus size={16} className="mr-2" /> Add Array
                </button>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Array Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Roof Direction</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Panel Count</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Panel Orientation</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Mounting System</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {arraysData.map(a => (
                            <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 focus-within:bg-blue-50">
                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="text" value={a.name} onChange={(e) => updateArray(a.id, 'name', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="text" value={a.orientation} onChange={(e) => updateArray(a.id, 'orientation', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={a.count} onChange={(e) => updateArray(a.id, 'count', parseInt(e.target.value) || 0)} /></td>
                                <td className="p-1">
                                    {(a.mounting || 'In-Roof (GSE)') === 'In-Roof (GSE)' ? (
                                        <select
                                            className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                            value={a.format || 'Portrait'}
                                            onChange={(e) => updateArray(a.id, 'format', e.target.value)}
                                        >
                                            <option value="Portrait">Portrait</option>
                                            <option value="Landscape">Landscape</option>
                                        </select>
                                    ) : (
                                        <div className="w-full p-2 text-slate-400 text-sm italic">Flexible (Rail)</div>
                                    )}
                                </td>
                                <td className="p-1">
                                    <select
                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                        value={a.mounting || 'In-Roof (GSE)'}
                                        onChange={(e) => updateArray(a.id, 'mounting', e.target.value)}
                                    >
                                        <option value="In-Roof (GSE)">In-Roof (GSE)</option>
                                        <option value="On Roof">On Roof</option>
                                    </select>
                                </td>
                                <td className="p-1 text-center">
                                    <button onClick={() => deleteArray(a.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Delete Array">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderPanelsDb = () => {
        const manufacturers = [...new Set(panelsData.map(p => p.manufacturer || 'Unknown'))];
        const toggleAllPanelMfr = (mfr, active) => {
            setPanelsData(prev => prev.map(p =>
                (p.manufacturer || 'Unknown') === mfr ? { ...p, active } : p
            ));
        };
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Solar Panels Database</h2>
                        <p className="text-slate-500">Edit panel specifications. Set the GSE Compatibility to auto-filter arrays.</p>
                    </div>
                    <button onClick={addPanel} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        <Plus size={16} className="mr-2" /> Add Panel
                    </button>
                </div>
                {manufacturers.map(mfr => {
                    const mfrPanels = panelsData.filter(p => (p.manufacturer || 'Unknown') === mfr);
                    const allActive = mfrPanels.every(p => p.active !== false);
                    const noneActive = mfrPanels.every(p => p.active === false);
                    return (
                        <div key={mfr}>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{mfr} <span className="font-normal text-slate-400 normal-case">({mfrPanels.length} panels)</span></h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleAllPanelMfr(mfr, true)}
                                        disabled={allActive}
                                        className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >Select All</button>
                                    <button
                                        onClick={() => toggleAllPanelMfr(mfr, false)}
                                        disabled={noneActive}
                                        className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >Deselect All</button>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase text-center">Active</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Panel Name</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Model ID</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase text-center">Info</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">GSE Compat.</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Power (W)</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Voc (V)</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Vmp (V)</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Isc (A)</th>
                                            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase">Price (£)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mfrPanels.map(p => (
                                            <tr key={p.model} className={`border-b border-slate-100 transition-colors ${p.active === false ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50 focus-within:bg-blue-50'}`}>
                                                <td className="p-1 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                        checked={p.active !== false}
                                                        onChange={(e) => updatePanel(p.model, 'active', e.target.checked)}
                                                        title="Include in array dropdown menus"
                                                    />
                                                </td>
                                                <td className="p-1"><input className="min-w-[220px] w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="text" value={p.name} onChange={(e) => updatePanel(p.model, 'name', e.target.value)} /></td>
                                                <td className="p-1 px-2"><span className="text-xs text-slate-400 font-mono whitespace-nowrap">{p.model}</span></td>
                                                <td className="p-1 text-center">
                                                    <div className="flex justify-center items-center gap-1">
                                                        <button onClick={() => setInfoModalPanelId(p.model)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="View Technical Specs">
                                                            <InfoIcon size={18} />
                                                        </button>
                                                        {p.datasheetUrl && (
                                                            <a href={p.datasheetUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="View Manufacturer Datasheet">
                                                                <ExternalLink size={18} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-1">
                                                    <select
                                                        className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm"
                                                        value={p.gseCompatibility || 'Both'}
                                                        onChange={(e) => updatePanel(p.model, 'gseCompatibility', e.target.value)}
                                                    >
                                                        <option value="Both">Both GSE</option>
                                                        <option value="Portrait Only">Portrait Only</option>
                                                        <option value="Landscape Only">Landscape Only</option>
                                                    </select>
                                                </td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={p.power} onChange={(e) => updatePanel(p.model, 'power', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="0.01" value={p.voc} onChange={(e) => updatePanel(p.model, 'voc', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="0.01" value={p.vmp} onChange={(e) => updatePanel(p.model, 'vmp', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="0.01" value={p.isc} onChange={(e) => updatePanel(p.model, 'isc', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={p.price} onChange={(e) => updatePanel(p.model, 'price', parseFloat(e.target.value) || 0)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderChargersDb = () => {
        const manufacturers = [...new Set(chargersData.map(c => c.manufacturer || 'Unknown'))];
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">PV Controllers Database</h2>
                        <p className="text-slate-500">Standalone MPPT chargers and hybrid inverters. All connect directly to your PV strings.</p>
                    </div>
                    <button onClick={addCharger} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        <Plus size={16} className="mr-2" /> Add Controller
                    </button>
                </div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">DC Bus Voltage</span>
                    <div className="flex gap-1">
                        {[12, 24, 48].map(v => (
                            <button key={v} onClick={() => setSystemVoltage(v)}
                                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${systemVoltage === v
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}>
                                {v}V
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 italic">Filters the controller selection on each array tab — not this list.</p>
                </div>
                {manufacturers.map(mfr => {
                    const mfrChargers = chargersData.filter(c => (c.manufacturer || 'Unknown') === mfr);
                    const isHidden = hiddenChargerMfr.includes(mfr);
                    return (
                        <div key={mfr}>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                    {mfr} <span className="font-normal text-slate-400 normal-case">({mfrChargers.length} controllers)</span>
                                </h3>
                                <button
                                    onClick={() => toggleChargerMfr(mfr)}
                                    className={`text-xs px-2 py-1 rounded border transition-colors ${isHidden
                                        ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                        : 'border-slate-300 text-slate-600 bg-white hover:bg-slate-100'
                                        }`}
                                >
                                    {isHidden ? 'Show in Arrays' : 'Hide from Arrays'}
                                </button>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Name</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">ID</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Voltages</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Max DC (V)</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Max Isc (A)</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Startup (V)</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Price (£)</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Buy</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chargersData.filter(c => (c.manufacturer || 'Unknown') === mfr).map(c => (
                                            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 focus-within:bg-blue-50">
                                                <td className="p-1">
                                                    <div className="flex items-center gap-1">
                                                        <input className="min-w-[220px] w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="text" value={c.name} onChange={(e) => updateCharger(c.id, 'name', e.target.value)} />
                                                        {c.datasheetUrl && (
                                                            <a href={c.datasheetUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 flex-shrink-0" title="View Datasheet"><ExternalLink size={16} /></a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-1 px-4"><span className="text-xs text-slate-400 font-mono whitespace-nowrap">{c.id}</span></td>
                                                <td className="p-1 px-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.type === 'hybrid_inverter'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {c.type === 'hybrid_inverter' ? 'Hybrid' : 'MPPT'}
                                                    </span>
                                                </td>
                                                <td className="p-1 px-4 text-xs text-slate-500">{(c.systemVoltages || [48]).join('V / ')}V</td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={c.maxV} onChange={(e) => updateCharger(c.id, 'maxV', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={c.maxIsc} onChange={(e) => updateCharger(c.id, 'maxIsc', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={c.startupV} onChange={(e) => updateCharger(c.id, 'startupV', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1"><input className="w-full p-2 bg-transparent border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" type="number" step="1" value={c.price} onChange={(e) => updateCharger(c.id, 'price', parseFloat(e.target.value) || 0)} /></td>
                                                <td className="p-1 px-4"><BuyButton buyLinks={c.buyLinks ?? {}} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderSummary = () => {
        let totalCost = 0;
        let mainSystemPower = 0;
        let mainSystemCost = 0;
        let garagePower = 0;
        let garageCost = 0;

        // Trackers for hardware ratio validation
        let rs450_100_primary = 0;
        let rs450_100_shared = 0;
        let rs450_200_primary = 0;
        let rs450_200_shared = 0;

        let hasErrors = false;

        const bomPanels = {};
        const bomControllers = {};

        const summaryRows = arraysData.map(array => {
            const analysis = getArrayAnalysis(array.id);
            if (!analysis) return null;

            totalCost += analysis.cost;

            if (array.id.toLowerCase().includes('garage') || array.name.toLowerCase().includes('garage')) {
                garagePower += analysis.peakPower;
                garageCost += analysis.cost;
            } else {
                mainSystemPower += analysis.peakPower;
                mainSystemCost += analysis.cost;
            }

            if (analysis.status === 'error') hasErrors = true;

            if (analysis.controller.id === 'rs450_100') rs450_100_primary++;
            if (analysis.controller.id === 'rs450_100_shared') rs450_100_shared++;
            if (analysis.controller.id === 'rs450_200') rs450_200_primary++;
            if (analysis.controller.id === 'rs450_200_shared') rs450_200_shared++;

            if (!bomPanels[analysis.panel.model]) {
                bomPanels[analysis.panel.model] = { item: analysis.panel, qty: 0 };
            }
            bomPanels[analysis.panel.model].qty += array.count;

            if (!bomControllers[analysis.controller.id]) {
                bomControllers[analysis.controller.id] = { item: analysis.controller, qty: 0 };
            }
            bomControllers[analysis.controller.id].qty += 1;

            return (
                <tr key={array.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold">{array.name}</td>
                    <td className="py-3 px-4">{analysis.panel.name} ({array.count}x)</td>
                    <td className="py-3 px-4 font-medium text-blue-700">{analysis.peakPower.toLocaleString()} W</td>
                    <td className="py-3 px-4">{analysis.controller.name}</td>
                    <td className="py-3 px-4">
                        {analysis.status === 'error' ? <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">FAILED</span> :
                            analysis.status === 'warning' ? <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">WARNING</span> :
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">OK</span>}
                    </td>
                    <td className="py-3 px-4">£{analysis.costPerKWp.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">£{analysis.cost.toLocaleString()}</td>
                </tr>
            );
        });

        // The RS 450/100 has 2 total trackers (1 primary + 1 shared)
        const trackerError100 = rs450_100_shared > rs450_100_primary;
        // The RS 450/200 has 4 total trackers (1 primary + up to 3 shared)
        const trackerError200 = rs450_200_shared > (rs450_200_primary * 3);
        const hasTrackerError = trackerError100 || trackerError200;

        const mainCostPerKWp = mainSystemPower > 0 ? mainSystemCost / (mainSystemPower / 1000) : 0;
        const garageCostPerKWp = garagePower > 0 ? garageCost / (garagePower / 1000) : 0;

        return (
            <div className="space-y-8">
                <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">System Summary</h2>
                        <p className="text-slate-500">Overview of all configured arrays and total hardware cost.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 p-6 rounded-lg text-white shadow-md flex justify-between items-end">
                        <div>
                            <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Main System Peak Power</p>
                            <p className="text-4xl font-light">{mainSystemPower.toLocaleString()} <span className="text-xl">W</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Hardware Cost</p>
                            <p className="text-xl font-medium text-slate-300">£{mainCostPerKWp.toFixed(2)} / kWp</p>
                        </div>
                    </div>
                    <div className="bg-slate-700 p-6 rounded-lg text-white shadow-md flex justify-between items-end">
                        <div>
                            <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Garage Peak Power (Separated)</p>
                            <p className="text-4xl font-light">{garagePower.toLocaleString()} <span className="text-xl">W</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Hardware Cost</p>
                            <p className="text-xl font-medium text-slate-300">£{garageCostPerKWp.toFixed(2)} / kWp</p>
                        </div>
                    </div>
                </div>

                {hasErrors && (
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-800 flex items-center">
                        <AlertTriangle className="mr-2" size={20} />
                        One or more arrays have fatal engineering errors. Review the tabs before procurement.
                    </div>
                )}

                {hasTrackerError && (
                    <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded text-orange-800 flex items-center">
                        <AlertTriangle className="mr-2" size={20} />
                        Tracker mismatch: You have assigned more shared RS trackers than your Primary units can physically support.
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">Array Configuration Breakdown</div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Array</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Panels</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Array Peak</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">PV Controller</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">£/kWp</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryRows}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-6">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
                        <span>Bill of Materials (BOM)</span>
                        <span className="text-sm font-normal text-slate-500">Aggregated quantities for procurement</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Component</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Unit Price</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Line Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(bomPanels).map(({ item, qty }) => (
                                <tr key={item.model} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-4 font-bold text-slate-700">{qty}</td>
                                    <td className="py-3 px-4">{item.name}</td>
                                    <td className="py-3 px-4 text-right text-slate-600">£{item.price.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right font-medium text-slate-800">£{(qty * item.price).toLocaleString()}</td>
                                </tr>
                            ))}
                            {Object.values(bomControllers).map(({ item, qty }) => (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-4 font-bold text-slate-700">{qty}</td>
                                    <td className="py-3 px-4">{item.name}</td>
                                    <td className="py-3 px-4 text-right text-slate-600">£{item.price.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right font-medium text-slate-800">£{(qty * item.price).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 text-slate-800 border-t-2 border-slate-300">
                                <td colSpan="3" className="py-4 px-4 text-right font-bold text-lg">Total Hardware Cost:</td>
                                <td className="py-4 px-4 text-right font-bold text-2xl text-blue-700">£{totalCost.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
            {renderPanelInfoModal()}

            <div className="w-64 bg-slate-900 text-slate-300 flex flex-col z-10">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-bold text-white flex items-center">
                        <Zap className="mr-2 text-blue-400" size={20} />
                        Array Config
                    </h1>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Physical Arrays</div>
                    <nav className="px-2 space-y-1">
                        {arraysData.map(array => {
                            const analysis = getArrayAnalysis(array.id);
                            if (!analysis) return null;
                            return (
                                <button
                                    key={array.id}
                                    onClick={() => setActiveTab(array.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${activeTab === array.id ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                                >
                                    <span className="text-sm truncate mr-2">{array.name}</span>
                                    {analysis.status === 'error' && <AlertTriangle size={16} className={`flex-shrink-0 ${activeTab === array.id ? 'text-red-200' : 'text-red-500'}`} />}
                                </button>
                            )
                        })}
                    </nav>

                    <nav className="px-2 space-y-1">
                        <button
                            onClick={() => setActiveTab('DB_ARRAYS')}
                            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'DB_ARRAYS' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                        >
                            <Layers className="mr-3" size={16} /> Arrays Config
                        </button>
                        <button
                            onClick={() => setActiveTab('DB_PANELS')}
                            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'DB_PANELS' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                        >
                            <Database className="mr-3" size={16} /> Panels Specs
                        </button>
                        <button
                            onClick={() => setActiveTab('DB_CHARGERS')}
                            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeTab === 'DB_CHARGERS' ? 'bg-slate-700 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                        >
                            <Server className="mr-3" size={16} /> PV Controllers
                        </button>
                    </nav>
                </div>

                <div className="p-4 border-t border-slate-800 space-y-2">
                    <button
                        onClick={resetToDefaults}
                        className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-center transition-colors text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400"
                        title="Wipe persistent storage and load factory defaults"
                    >
                        <RotateCcw className="mr-2" size={14} />
                        Reset Data
                    </button>
                    <button
                        onClick={() => setActiveTab('SUMMARY')}
                        className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-center transition-colors ${activeTab === 'SUMMARY' ? 'bg-green-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700 hover:text-white'}`}
                    >
                        <LayoutDashboard className="mr-2" size={18} />
                        System Summary
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-8 relative">
                    {activeTab === 'SUMMARY' ? renderSummary() :
                        activeTab === 'DB_ARRAYS' ? renderArraysDb() :
                            activeTab === 'DB_PANELS' ? renderPanelsDb() :
                                activeTab === 'DB_CHARGERS' ? renderChargersDb() :
                                    renderArrayTab(activeTab)}
                </div>
            </div>
            {renderAddPanelModal()}
            {renderAddChargerModal()}
            {renderPanelInfoModal()}
        </div>
    );
}