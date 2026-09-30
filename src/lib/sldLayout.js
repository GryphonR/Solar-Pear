/**
 * @file sldLayout.js
 * Single line diagram layout (roadmap 13.7, brief section 7, canvas board "System Overview"). Pure: turns
 * a system's arrays, controller units and analyses into positioned nodes and edges. The diagram and its
 * list view both render from this output, so they can't disagree. It reads `analyzeArray` output and
 * adds no checks of its own.
 *
 * Power flows left to right: PV arrays → DC protection → controller → battery, loads and grid. There is
 * one row per MPPT port, grouped by controller unit in store order, then one row per array without a
 * port. Rows never move when an array is added (it joins the end) or assigned (it takes a free port's
 * row), so the layout is stable as the design grows.
 */

import { isMicroinverter } from './arrayAnalysis';

export const SLD_COLUMNS = Object.freeze([
    { id: 'arrays', label: 'PV ARRAYS', x: 0, width: 424 },
    { id: 'protection', label: 'DC PROTECTION', x: 424, width: 160 },
    { id: 'controller', label: 'CONTROLLER', x: 584, width: 264 },
    { id: 'outputs', label: 'BATTERY · LOADS · GRID', x: 848, width: 160 },
]);

// Geometry in px, from the canvas, tightened so the diagram fits beside the sidebar at 1440 px.
const ARRAY = { x: 0, w: 208, h: 96 };
const CHIP = { x: 220, w: 190, h: 48 };
const PROTECTION = { x: 424, w: 120, h: 60 };
const CONTROLLER = { x: 584, w: 224 };
const OUTPUT = { x: 848, w: 160, h: 64, step: 80, top: 16 };
const SLOT = { x: 424, w: 384, h: 60 };
const ROW = 140;
const HEADER = 150; // controller name and load meter, above the first port row's centre
const FOOTER = 82; // spec line under the last port
const BLOCK_GAP = 32;
const MICRO_ROW = 26;
const MICROS_PER_ROW = 8;
export const SLD_WIDTH = 1008;

const SEVERITY_RANK = { valid: 0, info: 0, unset: 0, warning: 1, error: 2 };
const worst = (statuses) => statuses.reduce((w, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[w] ? s : w), 'valid');

/** Issue codes shown on the array-to-port link, split by the metric they concern. */
const VOLTAGE_CODES = ['voc', 'vocMargin', 'panelSystemVoltage', 'noPvInput', 'wiring'];
const VMP_CODES = ['vmpStartup', 'mpptMin', 'mpptMax'];
const CURRENT_CODES = ['iscRating', 'currentClip'];
const MICRO_CODES = ['microModulePower', 'microAcClip'];
export const LINK_CODES = Object.freeze([...VOLTAGE_CODES, ...VMP_CODES, ...CURRENT_CODES, ...MICRO_CODES]);
const POWER_CODES = ['chargerPower', 'dcPower'];

const r = (v) => (Number.isFinite(v) ? Math.round(v) : '—');
const TYPE_LABELS = {
    charger: 'MPPT charger',
    'dc-dc-charger': 'DC-DC charger',
    hybrid_inverter: 'Hybrid',
    string_inverter: 'String inverter',
    microinverter: 'Microinverter',
    ac_coupled_inverter: 'AC-coupled',
    inverter_charger: 'Inverter-charger',
};

export const wiringLabel = (array) => {
    const p = Number(array?.parallelStrings) || 1;
    return `${Math.round((Number(array?.count) || 0) / p)}S${p}P`;
};

/** Worst non-info severity among `issues` whose code is in `codes`, or 'valid'. */
function statusOf(issues, codes) {
    return worst((issues || []).filter((i) => codes.includes(i.code)).map((i) => (i.severity === 'info' ? 'valid' : i.severity)));
}

const gridCerts = (model) => [model?.g98_cert ? 'G98' : null, model?.g99_cert ? 'G99' : null].filter(Boolean).join(' · ') || 'no G98/G99 listed';
const batteryV = (settings) => (Number(settings?.systemVoltage) > 0 ? ` · ${Number(settings.systemVoltage)} V` : '');

/**
 * Output nodes for a controller type (brief 7.2). Placeholders are things the catalogue doesn't hold yet
 * (batteries, loads, isolators): they are drawn dashed so they never read as checked.
 */
export function outputTemplate(model, settings = {}) {
    const battery = { key: 'battery', title: `Battery${batteryV(settings)}`, subtitle: 'not specified', placeholder: true };
    const grid = (subtitle) => ({ key: 'grid', title: 'Grid', subtitle, placeholder: false });
    switch (model?.type) {
        case 'charger':
            return [battery, { key: 'loads', title: 'DC loads', subtitle: 'not specified', placeholder: true }];
        case 'dc-dc-charger':
            return [{ ...battery, title: `Leisure battery${batteryV(settings)}` }];
        case 'inverter_charger':
            return [battery, { key: 'loads', title: 'AC loads', subtitle: 'not specified', placeholder: true }];
        case 'hybrid_inverter':
            return [
                ...(model.eps ? [{ key: 'eps', title: 'EPS output', subtitle: 'backup loads', placeholder: true }] : []),
                ...(settings.gridMode === 'off-grid' ? [] : [grid(`consumer unit · ${gridCerts(model)}`)]),
                battery,
            ];
        case 'string_inverter':
            return [grid(`consumer unit · ${gridCerts(model)}`)];
        case 'microinverter':
            return [grid(`AC trunk · consumer unit · ${gridCerts(model)}`)];
        case 'ac_coupled_inverter':
            return [grid(`consumer unit · ${gridCerts(model)}`), battery];
        default:
            if (!model) return settingsOutputs(settings);
            return [{ key: 'output', title: 'Output', subtitle: 'not specified', placeholder: true }];
    }
}

/** Outputs implied by the system's setup when no controller has been chosen. */
function settingsOutputs(settings = {}) {
    const battery = { key: 'battery', title: `Battery${batteryV(settings)}`, subtitle: 'not specified', placeholder: true };
    const grid = { key: 'grid', title: 'Grid', subtitle: 'consumer unit', placeholder: true };
    if (settings.gridMode === 'grid-tied') return [grid];
    if (settings.gridMode === 'hybrid') return [grid, battery];
    if (settings.gridMode === 'off-grid') return [battery, { key: 'loads', title: 'Loads', subtitle: 'not specified', placeholder: true }];
    return Number(settings.systemVoltage) > 0 ? [battery] : [{ key: 'output', title: 'Outputs', subtitle: 'depend on the controller', placeholder: true }];
}

/** The metric chip on an array-to-port link. */
function linkChip(entry, model) {
    const a = entry.analysis;
    const issues = a.issues || [];
    const has = (code) => issues.some((i) => i.code === code);
    if (isMicroinverter(model)) {
        const units = a.controllerUnits || 0;
        return {
            lines: [
                [{ text: `${a.array.count} panels → ${units} micro${units === 1 ? '' : 's'}`, status: 'valid' }],
                [{ text: `Voc ${r(a.coldVoc)} / ${model.maxV ?? '—'} V per panel`, status: statusOf(issues, [...VOLTAGE_CODES, ...MICRO_CODES]) }],
            ],
        };
    }
    const voc = { text: `Voc ${r(a.coldVoc)} / ${model?.maxV ?? '—'} V`, status: statusOf(issues, VOLTAGE_CODES) };
    const vmpStatus = statusOf(issues, VMP_CODES);
    const vmp = {
        text: has('vmpStartup')
            ? `Vmp ${r(a.hotVmp)} V < ${r(a.effectiveStartupV)} start`
            : has('mpptMin')
              ? `Vmp ${r(a.hotVmp)} V < ${model.mpptRangeMin} min`
              : has('mpptMax')
                ? `Vmp ${r(a.coldVmp)} V > ${model.mpptRangeMax} max`
                : `Vmp ${r(a.hotVmp)} V`,
        status: vmpStatus,
    };
    const iscStatus = statusOf(issues, CURRENT_CODES);
    const isc = {
        text: has('iscRating')
            ? `Isc ${a.arrayIscHot.toFixed(1)} A > ${model.maxIsc}`
            : has('currentClip')
              ? `Imp ${a.arrayImpHot.toFixed(1)} A > ${a.currentClipLimit}`
              : `Isc ${a.arrayIscHot.toFixed(1)} A`,
        status: iscStatus,
    };
    const failing = [vmp, isc].filter((m) => m.status !== 'valid');
    return { lines: [[voc], failing.length ? failing : [vmp, isc]] };
}

function linkLabel(entry, portName, status) {
    const titles = (entry.analysis?.issues || [])
        .filter((i) => LINK_CODES.includes(i.code) && i.severity !== 'info')
        .map((i) => i.message.replace(/^FATAL:\s*/, '').split('. ')[0]);
    const verdict = status === 'valid' ? 'all checks pass' : `${status}: ${titles.join('; ')}`;
    return `${entry.name} to ${portName}: ${verdict}`;
}

/**
 * Lays out one system.
 *
 * @param {object} input
 * @param {Array<{ id, name, status, progress, analysis }>} input.arrays - The system's arrays (useDesignSummary order)
 * @param {Array<{ instance, model, ports }>} input.units - From `unitPorts`, in store order
 * @param {object} [input.settings] - System settings
 * @param {Set<string>} [input.expanded] - Microinverter unit ids to draw unit by unit
 * @returns {{ width: number, height: number, columns: object[], nodes: object[], edges: object[], order: string[] }}
 */
export function sldLayout({ arrays = [], units = [], settings = {}, expanded = new Set() }) {
    const nodes = [];
    const edges = [];
    const order = [];
    const byId = new Map(arrays.map((a) => [a.id, a]));
    const onPort = new Set(units.flatMap((u) => u.ports.map((p) => p.arrayId).filter(Boolean)));
    const waiting = arrays.filter((a) => !onPort.has(a.id));
    const freeCount = units.reduce((n, u) => n + u.ports.filter((p) => !p.arrayId).length, 0);

    const node = (n) => {
        nodes.push(n);
        order.push(n.id);
        return n;
    };
    const edge = (e) => {
        edges.push(e);
        if (e.chip) order.push(e.id);
        return e;
    };

    const arrayNode = (entry, cy) => {
        const a = entry.analysis;
        const unset = entry.status === 'unset';
        return node({
            kind: 'array',
            id: `array:${entry.id}`,
            arrayId: entry.id,
            x: ARRAY.x,
            y: cy - ARRAY.h / 2,
            w: ARRAY.w,
            h: ARRAY.h,
            status: entry.status,
            placeholder: unset,
            title: entry.name,
            panel: a?.panel ? `${a.array.count} × ${a.panel.name || a.panel.model}` : null,
            wiring: a?.panel ? `${wiringLabel(a.array)} · ${((a.peakPower || 0) / 1000).toFixed(2)} kWp` : null,
            progress: entry.progress,
            next: !entry.progress?.layout ? 'layout' : !entry.progress?.panel ? 'panel' : !entry.progress?.controller ? 'controller' : null,
        });
    };

    // One block per controller unit: its port rows, the controller node and its outputs.
    let y = 0;
    const block = (unit, rows, micro) => {
        const top = y;
        const model = unit?.model || null;
        const microUnits = micro ? rows.reduce((n, row) => n + (row.entry?.analysis?.controllerUnits || 0), 0) : 0;
        const isExpanded = micro && unit && expanded.has(unit.instance.id);
        const microRows = isExpanded ? Math.ceil(microUnits / MICROS_PER_ROW) : 0;
        const header = HEADER + microRows * MICRO_ROW;
        const centres = rows.map((_, i) => top + header + i * ROW);
        const outputs = outputTemplate(model, settings);
        const lastCentre = centres.length ? centres[centres.length - 1] : top + header;
        const bottom = Math.max(lastCentre + FOOTER, top + OUTPUT.top + outputs.length * OUTPUT.step);
        const ctrlId = unit ? `ctrl:${unit.instance.id}` : 'ctrl:none';
        const ports = [];

        rows.forEach((row, i) => {
            const cy = centres[i];
            if (row.type === 'array') {
                const entry = row.entry;
                const a = entry.analysis;
                arrayNode(entry, cy);
                const portName = unit ? `${model?.name || unit.instance.name} MPPT ${row.port}` : 'a controller';
                if (!unit) {
                    edge({ id: `link:${entry.id}`, from: `array:${entry.id}`, to: ctrlId, status: 'unset', dashed: true, points: [[ARRAY.w, cy], [CONTROLLER.x, cy]] });
                    return;
                }
                const checked = !!a?.panel && !!a?.controller;
                // The link and its port show the port's own checks; controller-wide power is on the controller.
                const status = checked ? statusOf(a.issues, LINK_CODES) : 'unset';
                ports.push({ port: row.port, arrayId: entry.id, name: entry.name, y: cy - top, status });
                const chip = checked
                    ? { ...linkChip(entry, model), x: CHIP.x, y: cy - CHIP.h / 2, w: CHIP.w, h: CHIP.h, label: linkLabel(entry, `MPPT ${row.port}`, status) }
                    : null;
                if (micro) {
                    edge({ id: `link:${entry.id}`, from: `array:${entry.id}`, to: ctrlId, arrayId: entry.id, status, dashed: !checked, arrow: checked, chip, points: [[ARRAY.w, cy], [CONTROLLER.x, cy]] });
                    return;
                }
                edge({ id: `link:${entry.id}`, from: `array:${entry.id}`, to: `dcp:${entry.id}`, arrayId: entry.id, status, dashed: !checked, arrow: checked, chip, points: [[ARRAY.w, cy], [PROTECTION.x, cy]] });
                const fuse = (a?.issues || []).find((i) => i.code === 'stringFuses');
                node({
                    kind: 'protection',
                    id: `dcp:${entry.id}`,
                    arrayId: entry.id,
                    x: PROTECTION.x,
                    y: cy - PROTECTION.h / 2,
                    w: PROTECTION.w,
                    h: PROTECTION.h,
                    placeholder: true,
                    status: fuse?.severity === 'warning' ? 'warning' : 'unset',
                    title: fuse ? 'String fuses' : 'DC isolator',
                    subtitle: fuse ? `${a.array.parallelStrings} strings · isolator not specified` : 'not specified',
                    note: fuse ? fuse.message : 'Not in the catalogue yet',
                });
                edge({ id: `dc:${entry.id}`, from: `dcp:${entry.id}`, to: ctrlId, status, dashed: !checked, arrow: checked, points: [[PROTECTION.x + PROTECTION.w, cy], [CONTROLLER.x, cy]] });
            } else if (row.type === 'free') {
                ports.push({ port: row.port, arrayId: null, y: cy - top, status: 'unset' });
                node({
                    kind: 'freePort',
                    id: `free:${unit.instance.id}:${row.port}`,
                    instanceId: unit.instance.id,
                    port: row.port,
                    x: CHIP.x,
                    y: cy - CHIP.h / 2,
                    w: CHIP.w,
                    h: CHIP.h,
                    placeholder: true,
                    status: 'unset',
                    title: `MPPT ${row.port} is free`,
                    waiting: waiting.map((w) => ({ id: w.id, name: w.name })),
                });
                edge({ id: `free:${unit.instance.id}:${row.port}:edge`, from: `free:${unit.instance.id}:${row.port}`, to: ctrlId, status: 'unset', dashed: true, points: [[CHIP.x + CHIP.w, cy], [CONTROLLER.x, cy]] });
            } else if (row.type === 'source') {
                node({
                    kind: 'source',
                    id: `source:${unit.instance.id}`,
                    x: ARRAY.x,
                    y: cy - ARRAY.h / 2,
                    w: ARRAY.w,
                    h: ARRAY.h,
                    placeholder: true,
                    status: 'unset',
                    title: 'Alternator',
                    subtitle: 'starter battery · not specified',
                });
                edge({ id: `source:${unit.instance.id}:edge`, from: `source:${unit.instance.id}`, to: ctrlId, status: 'unset', dashed: true, points: [[ARRAY.w, cy], [CONTROLLER.x, cy]] });
            }
        });

        const onUnit = rows.filter((row) => row.type === 'array').map((row) => row.entry);
        const power = onUnit.find((e) => e.analysis?.power)?.analysis.power || null;
        const powerIssue = onUnit.flatMap((e) => e.analysis?.issues || []).find((i) => POWER_CODES.includes(i.code));
        const anyChecked = onUnit.some((e) => e.status !== 'unset');
        node({
            kind: 'controller',
            id: ctrlId,
            instanceId: unit?.instance.id || null,
            x: CONTROLLER.x,
            y: top,
            w: CONTROLLER.w,
            h: bottom - top,
            placeholder: !unit,
            status: !unit || !anyChecked ? 'unset' : powerIssue?.severity === 'warning' ? 'warning' : 'valid',
            kicker: model ? [model.manufacturer, TYPE_LABELS[model.type] || model.type].filter(Boolean).join(' · ').toUpperCase() : null,
            title: unit ? model?.name || unit.instance.name || 'Unknown controller' : 'No controller yet',
            ports,
            meter: power && power.limitW > 0 ? { value: power.totalWp, max: power.limitW, basis: power.basis, batteryV: power.batteryV } : null,
            powerIssue: powerIssue || null,
            spec: model && !micro ? [`${model.maxV ?? '—'} V`, model.maxIsc ? `${model.maxIsc} A Isc per port` : null].filter(Boolean).join(' · ') : null,
            micro: micro ? { units: microUnits, perUnit: Number(model?.panelsPerUnit) || 1, expanded: isExpanded, rows: microRows } : null,
        });

        outputs.forEach((out, i) => {
            const oy = top + OUTPUT.top + i * OUTPUT.step;
            const id = `out:${unit ? unit.instance.id : 'none'}:${out.key}`;
            node({ kind: 'output', id, x: OUTPUT.x, y: oy, w: OUTPUT.w, h: OUTPUT.h, status: 'unset', ...out });
            edge({
                id: `${id}:edge`,
                from: ctrlId,
                to: id,
                status: 'neutral',
                dashed: !unit,
                arrow: out.key !== 'battery',
                points: [[CONTROLLER.x + CONTROLLER.w, oy + OUTPUT.h / 2], [OUTPUT.x, oy + OUTPUT.h / 2]],
            });
        });
        y = bottom + BLOCK_GAP;
    };

    for (const unit of units) {
        const micro = isMicroinverter(unit.model);
        const rows = unit.ports.map((p) => (p.arrayId && byId.has(p.arrayId) ? { type: 'array', port: p.port, entry: byId.get(p.arrayId) } : { type: 'free', port: p.port }));
        if (unit.model?.type === 'dc-dc-charger') rows.push({ type: 'source' });
        block(unit, rows, micro);
    }

    if (units.length === 0) {
        // No controller yet: waiting arrays converge on a placeholder controller.
        if (waiting.length) block(null, waiting.map((entry) => ({ type: 'array', entry })), false);
        else {
            // Nothing at all yet: a placeholder array feeding the placeholder controller.
            const cy = HEADER;
            node({ kind: 'addArray', id: 'add:array', x: ARRAY.x, y: cy - ARRAY.h / 2, w: ARRAY.w, h: ARRAY.h, placeholder: true, status: 'unset', title: 'No arrays yet' });
            edge({ id: 'add:array:edge', from: 'add:array', to: 'ctrl:none', status: 'unset', dashed: true, points: [[ARRAY.w, cy], [CONTROLLER.x, cy]] });
            block(null, [], false);
        }
    } else {
        waiting.forEach((entry, i) => {
            const cy = y + ARRAY.h / 2 + i * ROW;
            arrayNode(entry, cy);
            node({
                kind: 'slot',
                id: `slot:${entry.id}`,
                arrayId: entry.id,
                x: SLOT.x,
                y: cy - SLOT.h / 2,
                w: SLOT.w,
                h: SLOT.h,
                placeholder: true,
                status: 'unset',
                title: freeCount > 0 ? `Not on a controller. ${freeCount} free MPPT port${freeCount === 1 ? '' : 's'}` : 'No free MPPT port in this system',
                action: freeCount > 0 ? 'assign' : 'addController',
            });
            edge({ id: `link:${entry.id}`, from: `array:${entry.id}`, to: `slot:${entry.id}`, status: 'unset', dashed: true, points: [[ARRAY.w, cy], [SLOT.x, cy]] });
        });
        if (waiting.length) y += (waiting.length - 1) * ROW + ARRAY.h + BLOCK_GAP;
    }

    const height = Math.max(0, ...nodes.map((n) => n.y + n.h));
    return { width: SLD_WIDTH, height, columns: SLD_COLUMNS, nodes, edges, order };
}
