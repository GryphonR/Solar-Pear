/**
 * @file designStatus.js
 * Status and progress summaries for the new shell (roadmap 13.4). Pure: reads `analyzeArray` output
 * and never adds checks of its own (`evaluateElectrical` stays the single source of truth).
 *
 * The engine reports an incomplete array (no panel or no controller) as a warning. The new UI shows it as
 * "not set" instead, because nothing has been checked yet, and "not set" is never green.
 */

import { GRID_MODES, INSTALL_TYPES, labelOf } from './presets';

/** Labels for a system's `settings.systemType`. */
export const SYSTEM_TYPE_LABELS = Object.freeze({
    any: 'Any type',
    'dc-charger': 'DC charger',
    'grid-connected': 'Grid-connected',
    'off-grid-ac': 'Off-grid AC',
});

/** Which of an array's three slots (layout, panel, controller) are filled. */
export function arrayProgress(analysis) {
    const layout = !!analysis?.array && Number(analysis.array.count) > 0;
    const panel = !!analysis?.panel;
    const controller = !!analysis?.controller;
    return { layout, panel, controller, done: [layout, panel, controller].filter(Boolean).length };
}

/** 'error' | 'warning' | 'valid' | 'unset' for one array. Info messages never change it. */
export function arrayStatus(analysis) {
    if (!analysis || !analysis.panel || !analysis.controller) return 'unset';
    return analysis.status === 'error' || analysis.status === 'warning' ? analysis.status : 'valid';
}

/**
 * Rolls array statuses up for a system or project.
 * @param {Array<'error'|'warning'|'valid'|'unset'>} statuses
 * @returns {{ status: 'error'|'warning'|'valid'|'unset', errors: number, warnings: number, unset: number, label: string }}
 */
export function summariseStatuses(statuses) {
    const count = (s) => statuses.filter((x) => x === s).length;
    const errors = count('error');
    const warnings = count('warning');
    const unset = count('unset');
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    if (statuses.length === 0) return { status: 'unset', errors, warnings, unset, label: 'No arrays' };
    if (errors) return { status: 'error', errors, warnings, unset, label: plural(errors, 'error') };
    if (warnings) return { status: 'warning', errors, warnings, unset, label: plural(warnings, 'warning') };
    if (unset) return { status: 'unset', errors, warnings, unset, label: `${unset} to finish` };
    return { status: 'valid', errors, warnings, unset, label: 'OK' };
}

/** One-line description of a system, e.g. "Static · Hybrid · 48 V · 3 arrays". */
export function systemMeta(settings = {}, arrayCount = 0) {
    const parts = [];
    const install = labelOf(INSTALL_TYPES, settings.installType);
    const grid = GRID_MODES.find((m) => m.id === settings.gridMode);
    if (install) parts.push(install);
    if (grid) parts.push(grid.id === 'hybrid' ? 'Hybrid' : grid.label);
    else if (settings.systemType && settings.systemType !== 'any') {
        parts.push(SYSTEM_TYPE_LABELS[settings.systemType] || settings.systemType);
    }
    if (Number.isFinite(Number(settings.systemVoltage)) && settings.systemVoltage !== null && settings.systemVoltage !== '') {
        parts.push(`${Number(settings.systemVoltage)} V`);
    }
    parts.push(`${arrayCount} ${arrayCount === 1 ? 'array' : 'arrays'}`);
    return parts.join(' · ');
}

/** Totals for a set of analyses: peak power (W), known cost (£) and whether the cost is incomplete. */
export function totals(analyses) {
    return analyses.reduce(
        (acc, a) => ({
            peakPower: acc.peakPower + (a?.peakPower || 0),
            cost: acc.cost + (a?.cost || 0),
            costIncomplete: acc.costIncomplete || !!a?.costIncomplete,
        }),
        { peakPower: 0, cost: 0, costIncomplete: false }
    );
}
