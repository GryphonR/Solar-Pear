import { describe, it, expect } from 'vitest';
import { outputTemplate, sldLayout } from './sldLayout';
import { systemIssues, issueCounts } from './systemIssues';
import { ISSUE_ADVICE, adviceFor } from './issueAdvice';
import { DOCUMENTED_CODES } from './methodology';

const panel = { model: 'P430', name: 'Panel 430 W', power: 430, voc: 38, vmp: 32, isc: 14, imp: 13.4, price: 100, tempCoefVoc: -0.25 };
const hybrid = { id: 'hyb', name: 'Hybrid 6kW', manufacturer: 'Acme', type: 'hybrid_inverter', trackers: 2, maxV: 500, maxIsc: 17, mpptRangeMin: 150, mpptRangeMax: 450, eps: true, g99_cert: true, price: 1000 };
const micro = { id: 'iq8', name: 'IQ8M', manufacturer: 'Enphase', type: 'microinverter', trackers: 1, maxV: 60, price: 0 };

function entry(id, { count = 10, withPanel = true, controller = hybrid, issues = [], port = 1 } = {}) {
    const analysis = {
        array: { id, count, parallelStrings: 1 },
        panel: withPanel ? panel : null,
        controller,
        mpptIndex: port,
        issues,
        peakPower: withPanel ? count * 430 : 0,
        coldVoc: 426,
        coldVmp: 350,
        hotVmp: 293,
        arrayIscHot: 14.3,
        arrayImpHot: 13.6,
        effectiveStartupV: 120,
        currentClipLimit: 17,
        controllerUnits: controller?.type === 'microinverter' ? count : 1,
        power: { totalWp: 6450, limitW: 7800, basis: 'dc', batteryV: null },
    };
    const status = !withPanel || !controller ? 'unset' : issues.some((i) => i.severity === 'error') ? 'error' : issues.some((i) => i.severity === 'warning') ? 'warning' : 'valid';
    return { id, name: `Array ${id}`, status, progress: { layout: count > 0, panel: withPanel, controller: !!controller, done: 0 }, analysis };
}
const unit = (id, model, ports) => ({ instance: { id, modelId: model.id, name: model.name }, model, ports: ports.map((arrayId, i) => ({ port: i + 1, arrayId })) });
const pos = (layout) => Object.fromEntries(layout.nodes.map((n) => [n.id, [n.x, n.y, n.w, n.h]]));

describe('sldLayout (roadmap 13.7)', () => {
    it('lays out arrays → protection → controller → outputs, with a row per port', () => {
        const arrays = [entry('A'), entry('B', { issues: [{ code: 'mpptMin', severity: 'warning', message: 'Hot Vmp (147V at 65°C) is below the MPPT operating range (150V minimum).' }] })];
        const layout = sldLayout({ arrays, units: [unit('u1', hybrid, ['A', 'B'])] });
        const kinds = layout.nodes.map((n) => n.kind);
        expect(kinds).toEqual(['array', 'protection', 'array', 'protection', 'controller', 'output', 'output', 'output']);
        const [a, b] = layout.nodes.filter((n) => n.kind === 'array');
        expect(a.x).toBeLessThan(layout.nodes.find((n) => n.kind === 'protection').x);
        expect(b.y - a.y).toBe(140);
        // Each array's centre lines up with its port on the controller.
        const ctrl = layout.nodes.find((n) => n.kind === 'controller');
        expect(ctrl.ports.map((p) => ctrl.y + p.y)).toEqual([a.y + a.h / 2, b.y + b.h / 2]);
        expect(layout.nodes.filter((n) => n.kind === 'output').map((n) => n.title)).toEqual(['EPS output', 'Grid', 'Battery']);
    });

    it('puts the key figures on each link, highlighting the failing one', () => {
        const arrays = [entry('A'), entry('B', { issues: [{ code: 'mpptMin', severity: 'warning', message: 'Hot Vmp (147V at 65°C) is below the MPPT operating range (150V minimum). More.' }] })];
        const layout = sldLayout({ arrays, units: [unit('u1', hybrid, ['A', 'B'])] });
        const [ok, warn] = layout.edges.filter((e) => e.chip);
        expect(ok.status).toBe('valid');
        expect(ok.chip.lines.flat().map((m) => m.text)).toEqual(['Voc 426 / 500 V', 'Vmp 293 V', 'Isc 14.3 A']);
        expect(ok.chip.label).toBe('Array A to MPPT 1: all checks pass');
        expect(warn.status).toBe('warning');
        expect(warn.chip.lines[1]).toEqual([{ text: 'Vmp 293 V < 150 min', status: 'warning' }]);
        expect(warn.chip.label).toMatch(/warning: Hot Vmp \(147V at 65°C\) is below the MPPT operating range/);
    });

    it('stays stable as arrays are added and assigned', () => {
        const u = unit('u1', hybrid, ['A', null]);
        const before = pos(sldLayout({ arrays: [entry('A')], units: [u] }));
        const added = pos(sldLayout({ arrays: [entry('A'), entry('C', { controller: null })], units: [u] }));
        const assigned = pos(sldLayout({ arrays: [entry('A'), entry('C')], units: [unit('u1', hybrid, ['A', 'C'])] }));
        for (const [id, box] of Object.entries(before)) {
            if (id.startsWith('free:')) continue;
            expect(added[id]).toEqual(box);
            expect(assigned[id]).toEqual(box);
        }
        // The new array takes the free port's row.
        expect(assigned['array:C'][1] + 48).toBe(before['free:u1:2'][1] + 24);
    });

    it('lists nodes in power-flow order for keyboard and the list view', () => {
        const layout = sldLayout({ arrays: [entry('A'), entry('W', { controller: null })], units: [unit('u1', hybrid, ['A', null])] });
        expect(layout.order).toEqual([
            'array:A',
            'link:A',
            'dcp:A',
            'free:u1:2',
            'ctrl:u1',
            'out:u1:eps',
            'out:u1:grid',
            'out:u1:battery',
            'array:W',
            'slot:W',
        ]);
        expect(layout.nodes.find((n) => n.id === 'slot:W')).toMatchObject({ action: 'assign', title: 'Not on a controller. 1 free MPPT port' });
    });

    it('offers "Add a controller" when no port is free', () => {
        const layout = sldLayout({ arrays: [entry('A'), entry('W', { controller: null })], units: [unit('u1', hybrid, ['A'])] });
        expect(layout.nodes.find((n) => n.id === 'slot:W')).toMatchObject({ action: 'addController', title: 'No free MPPT port in this system' });
    });

    it('draws an empty system as placeholders only', () => {
        const layout = sldLayout({ arrays: [], units: [], settings: { gridMode: 'hybrid', systemVoltage: 48 } });
        expect(layout.nodes.map((n) => n.id)).toEqual(['add:array', 'ctrl:none', 'out:none:grid', 'out:none:battery']);
        expect(layout.nodes.every((n) => n.placeholder)).toBe(true);
        expect(layout.nodes.find((n) => n.kind === 'output' && n.key === 'battery').title).toBe('Battery · 48 V');
    });

    it('never shows an unchecked array or link as OK', () => {
        const layout = sldLayout({ arrays: [entry('A', { withPanel: false })], units: [unit('u1', hybrid, ['A', null])] });
        expect(layout.nodes.find((n) => n.id === 'array:A')).toMatchObject({ status: 'unset', placeholder: true, next: 'panel' });
        expect(layout.edges.find((e) => e.id === 'link:A')).toMatchObject({ status: 'unset', dashed: true, chip: null });
        expect(layout.nodes.find((n) => n.kind === 'controller').status).toBe('unset');
    });

    it('collapses microinverters to a count and expands on request', () => {
        const arrays = [entry('M', { count: 10, controller: micro })];
        const units = [unit('m1', micro, ['M'])];
        const collapsed = sldLayout({ arrays, units });
        expect(collapsed.nodes.some((n) => n.kind === 'protection')).toBe(false);
        expect(collapsed.edges.find((e) => e.chip).chip.lines[0][0].text).toBe('10 panels → 10 micros');
        const ctrl = collapsed.nodes.find((n) => n.kind === 'controller');
        expect(ctrl.micro).toMatchObject({ units: 10, expanded: false });
        const expanded = sldLayout({ arrays, units, expanded: new Set(['m1']) });
        const ctrl2 = expanded.nodes.find((n) => n.kind === 'controller');
        expect(ctrl2.micro).toMatchObject({ expanded: true, rows: 2 });
        expect(ctrl2.h).toBeGreaterThan(ctrl.h);
        expect(expanded.nodes.find((n) => n.kind === 'output').subtitle).toMatch(/^AC trunk · consumer unit/);
    });

    it('has a template for every controller type', () => {
        const types = ['charger', 'dc-dc-charger', 'hybrid_inverter', 'string_inverter', 'microinverter', 'ac_coupled_inverter', 'inverter_charger'];
        for (const type of types) expect(outputTemplate({ type }, { systemVoltage: 12 }).length).toBeGreaterThan(0);
        expect(outputTemplate({ type: 'charger' }, { systemVoltage: 12 }).map((o) => o.title)).toEqual(['Battery · 12 V', 'DC loads']);
        expect(outputTemplate({ type: 'string_inverter', g98_cert: true }).map((o) => [o.title, o.placeholder])).toEqual([['Grid', false]]);
        const dcdc = { id: 'orion', name: 'Orion', type: 'dc-dc-charger', trackers: 1, maxV: 25 };
        const layout = sldLayout({ arrays: [], units: [unit('d1', dcdc, [null])] });
        expect(layout.nodes.find((n) => n.kind === 'source')).toMatchObject({ title: 'Alternator', placeholder: true });
    });
});

describe('systemIssues (roadmap 13.7, 7.5)', () => {
    it('gives every finding a cause, the fields used and a fix, and deduplicates controller power', () => {
        const dcPower = { code: 'dcPower', severity: 'warning', message: 'The 2 arrays on this controller total 8600W, above the maximum PV input power (7800W).' };
        const arrays = [
            entry('A', { issues: [dcPower] }),
            entry('B', { issues: [{ code: 'voc', severity: 'error', message: 'FATAL: Cold Voc (520V at -10°C) exceeds PV controller limit (500V). Will destroy hardware.' }, dcPower] }),
            entry('C', { withPanel: false, controller: null }),
        ];
        const items = systemIssues({ arrays, units: [unit('u1', hybrid, ['A', 'B'])] });
        expect(items.map((i) => i.code)).toEqual(['voc', 'dcPower', 'unset']);
        const voc = items[0];
        expect(voc).toMatchObject({ where: 'Array B → Hybrid 6kW MPPT 2', title: 'Cold Voc is above the controller maximum' });
        expect(voc.why).toBe('Cold Voc (520V at -10°C) exceeds PV controller limit (500V). Will destroy hardware.');
        expect(voc.fields).toEqual(['voc 38 V', 'tempCoefVoc -0.25 %/°C', 'maxV 500 V']);
        expect(voc.fix).toMatch(/fewer panels in series/);
        expect(items[1].where).toBe('Hybrid 6kW');
        expect(items[2]).toMatchObject({ severity: 'info', missing: 'panel' });
        expect(issueCounts(items)).toEqual({ error: 1, warning: 1, info: 1 });
    });

    it('notes unknown controller prices', () => {
        const items = systemIssues({ arrays: [entry('M', { controller: micro })], units: [unit('m1', micro, ['M'])] });
        expect(items.find((i) => i.code === 'price')).toMatchObject({ where: 'IQ8M', severity: 'info' });
    });

    it('has advice for every check the engine documents', () => {
        const missing = [...DOCUMENTED_CODES].filter((c) => !ISSUE_ADVICE[c]);
        expect(missing).toEqual([]);
        expect(adviceFor({ code: 'nope', message: 'x' }).fix).toMatch(/How we check/);
    });
});

describe('sldToSvg (roadmap 13.7)', () => {
    it('draws the same layout as a standalone, escaped SVG with statuses in words', async () => {
        const { sldToSvg } = await import('./sldExport');
        const arrays = [entry('A'), entry('B', { issues: [{ code: 'mpptMin', severity: 'warning', message: 'Hot Vmp low.' }] })];
        const svg = sldToSvg(sldLayout({ arrays, units: [unit('u1', hybrid, ['A', 'B'])] }), { title: 'Home & <House>' });
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg).toContain('Home &amp; &lt;House&gt;');
        expect(svg).toContain('Array A  (OK)');
        expect(svg).toContain('Warning: Voc 426 / 500 V');
        expect(svg).toContain('MPPT 2  Array B');
    });
});
