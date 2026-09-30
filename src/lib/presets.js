/**
 * @file presets.js
 * "What are you building?" presets (roadmap 13.5, delivers 7.1) and the system setup vocabulary.
 *
 * `installType` and `gridMode` describe the system (canvas "System Setup"). They don't filter anything
 * by themselves: the controller list is still filtered by the existing `systemType` setting
 * ("Controllers shown"), plus the battery voltage and the EPS / whole-house toggles. Picking a grid mode
 * sets a sensible `systemType`, which the user can change.
 */

export const INSTALL_TYPES = Object.freeze([
    { id: 'static', label: 'Static', text: 'House, barn or cabin. Grid-tied, hybrid or off-grid. GSE trays offered.' },
    { id: 'mobile', label: 'Mobile', text: 'Van, boat or caravan. Off-grid, 12 or 24 V, small and flexible panels.' },
]);

export const GRID_MODES = Object.freeze([
    { id: 'grid-tied', label: 'Grid-tied', systemType: 'grid-connected' },
    { id: 'hybrid', label: 'Hybrid, with battery', systemType: 'grid-connected' },
    { id: 'off-grid', label: 'Off-grid', systemType: 'any' },
]);

/** The existing controller filter (`settings.systemType`), as shown in System Setup. */
export const CONTROLLER_FILTERS = Object.freeze([
    { id: 'any', label: 'All controllers' },
    { id: 'grid-connected', label: 'Grid-connected (G98/G99)' },
    { id: 'off-grid-ac', label: 'Off-grid AC inverters' },
    { id: 'dc-charger', label: 'DC chargers' },
]);

export const BATTERY_VOLTAGES = Object.freeze([12, 24, 48]);

export const PRESETS = Object.freeze([
    {
        id: 'grid-tied',
        title: 'House roof, grid-tied',
        text: 'Panels on your roof feeding a string inverter. Export under G98 or G99.',
        tag: 'Static · Grid-tied · no battery',
        systemName: 'House',
        settings: { installType: 'static', gridMode: 'grid-tied', systemType: 'grid-connected', systemVoltage: null },
    },
    {
        id: 'hybrid',
        title: 'House with battery',
        text: 'A hybrid inverter with battery storage, optionally keeping lights on in a power cut.',
        tag: 'Static · Hybrid · 48 V',
        systemName: 'House',
        settings: { installType: 'static', gridMode: 'hybrid', systemType: 'grid-connected', systemVoltage: 48 },
    },
    {
        id: 'off-grid',
        title: 'Off-grid cabin or barn',
        text: 'No grid connection. Panels charge a battery bank through an MPPT charger or off-grid inverter.',
        tag: 'Static · Off-grid · 48 V',
        systemName: 'Cabin',
        settings: { installType: 'static', gridMode: 'off-grid', systemType: 'any', systemVoltage: 48 },
    },
    {
        id: 'mobile',
        title: 'Van, boat or caravan',
        text: 'Small or flexible panels, a 12 or 24 V leisure battery and an MPPT or DC-DC charger.',
        tag: 'Mobile · Off-grid · 12 V',
        systemName: 'Van',
        settings: { installType: 'mobile', gridMode: 'off-grid', systemType: 'dc-charger', systemVoltage: 12 },
    },
]);

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label;
