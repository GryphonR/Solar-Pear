import { describe, it, expect } from 'vitest';
import { analyzeArray } from './arrayAnalysis';
import { computePlannerLayouts } from './plannerEngine';
import {
    insetPolygon,
    layoutChangeSummary,
    layoutCostPerKWp,
    layoutPatch,
    plannerFromStart,
    roofPolygonFor,
    estimatedRidge,
    gridLabel,
    groupLayouts,
    ASSUMED_PITCH_DEG,
    samePanelArrays,
    slopeLengthFromPlan,
    slotKey,
    sortLayouts,
    withEmptySlots,
} from './plannerLayouts';

const panel = { model: 'P430', name: 'Panel 430', power: 430, width: 1134, height: 1722, voc: 38.9, vmp: 32.5, isc: 14, imp: 13.2, tempCoefVoc: -0.25, tempCoefPmax: -0.29, price: 90, active: true };
const cheap = { ...panel, model: 'P400', name: 'Panel 400', power: 400, price: 50 };
const controller = { id: 'hyb', name: 'Hybrid', type: 'hybrid_inverter', trackers: 2, maxV: 500, maxIsc: 20, maxOperatingI: 16, mpptRangeMin: 150, mpptRangeMax: 450, startupV: 90, MaxDCPower: 7800, price: 900 };

describe('roof from the first-use card (roadmap 13.8)', () => {
    it('corrects a plan depth for the pitch, and waits for the pitch', () => {
        expect(slopeLengthFromPlan(3.1, 35)).toBeCloseTo(3.784, 3);
        expect(slopeLengthFromPlan(3.1, '')).toBe(0);
        expect(plannerFromStart({ shape: 'rectangle', measure: 'map', width: 6.2, depth: 3.1, pitch: '' })).toBeNull();
        const p = plannerFromStart({ shape: 'rectangle', measure: 'map', width: 6.2, depth: 3.1, pitch: 35 });
        expect(p.roofInput).toMatchObject({ mode: 'projected', projectedX_m: 6.2, projectedY_m: 3.1, tilt_deg: 35 });
        expect(p.roofPolygon[2].y).toBeCloseTo(3.784, 3);
        expect(p.roofPolygonAuto).toBe(true);
    });

    it('draws a hipped face as a trapezoid, estimating the ridge from the pitch', () => {
        // Same pitch on every face: each hip runs in by slope × cos(pitch).
        expect(estimatedRidge(10, 3, 60)).toBeCloseTo(7, 6);
        expect(estimatedRidge(10, 3)).toBeCloseTo(10 - 6 * Math.cos((ASSUMED_PITCH_DEG * Math.PI) / 180), 6);
        expect(estimatedRidge(4, 3, 10)).toBe(0); // a pyramid
        const hip = roofPolygonFor('hipped', 10, 3, null, 60);
        expect(hip.map((p) => [+p.x.toFixed(6), p.y])).toEqual([[1.5, 0], [8.5, 0], [10, 3], [0, 3]]);
        expect(roofPolygonFor('hipped', 10, 3, 6)[0]).toEqual({ x: 2, y: 0 });
        // A map measurement gives the pitch; a tape one assumes it.
        const fromMap = plannerFromStart({ shape: 'hipped', measure: 'map', width: 10, depth: 1.5, pitch: 60 });
        expect(fromMap.roofPolygon[1].x - fromMap.roofPolygon[0].x).toBeCloseTo(7, 6);
        expect(plannerFromStart({ shape: 'hipped', measure: 'tape', width: 10, length: 3 }).roofPolygonAuto).toBe(false);
    });
});

describe('layouts, empty slots and the apply preview (roadmap 13.8)', () => {
    const roof = roofPolygonFor('rectangle', 6, 4.2);
    const { ranked } = computePlannerLayouts({ roofPolygon_m: roof, spacing: { edge_mm: 300, gap_mm: 20 }, panelsData: [panel], options: { orientation: 'portrait', topN: 5 } });
    const layout = ranked[0];

    it('switches individual slots off and keeps the rest of the grid in place', () => {
        expect(layout.count).toBe(8);
        const off = [slotKey(layout.rects_m[0]), slotKey(layout.rects_m[7])];
        const trimmed = withEmptySlots(layout, off, panel);
        expect(trimmed.count).toBe(6);
        expect(trimmed.totalW).toBe(6 * 430);
        expect(trimmed.emptyRects).toHaveLength(2);
        expect(trimmed.rects_m).toEqual(layout.rects_m.slice(1, 7));
        expect(withEmptySlots(layout, [], panel)).toMatchObject({ count: 8, emptyRects: [] });
    });

    it('sets the panel, count, size limits and a wiring the controller accepts', () => {
        const array = { id: 'A', count: 4, parallelStrings: 1 };
        const patch = layoutPatch(array, layout, panel, { controller, conditions: { coldTempC: -10, hotTempC: 65 } });
        expect(patch).toEqual({ panel: 'P430', count: 8, parallelStrings: 1, maxPanelWidth: 1134, maxPanelHeight: 1722 });
        // Without a controller, keep the old wiring if it still divides the count.
        expect(layoutPatch({ parallelStrings: 2 }, layout, panel).parallelStrings).toBe(2);
        expect(layoutPatch({ parallelStrings: 3 }, layout, panel).parallelStrings).toBe(1);
    });

    it('analyses the previewed layout with the engine and says what would change', () => {
        const base = { id: 'A', name: 'East', area: 'House', count: 4, parallelStrings: 1, panel: 'P430', controllerInstanceId: 'sc1', controllerMppt: 1 };
        const ctx = (arrays) => ({
            arraysData: arrays,
            panelsData: [panel],
            chargersData: [controller],
            siteControllers: [{ id: 'sc1', modelId: 'hyb', name: 'Hybrid', area: 'House' }],
            selections: Object.fromEntries(arrays.map((a) => [a.id, { panel: a.panel, controllerInstanceId: a.controllerInstanceId, controllerMppt: a.controllerMppt }])),
            conditions: { coldTempC: -10, hotTempC: 65 },
        });
        const before = analyzeArray('A', ctx([base]));
        const patch = layoutPatch(base, layout, panel, { controller, conditions: { coldTempC: -10, hotTempC: 65 } });
        const after = analyzeArray('A', ctx([{ ...base, ...patch }]));
        const change = layoutChangeSummary(before, after);
        expect(before.issues.map((i) => i.code)).toContain('mpptMin');
        expect(change).toMatchObject({ panels: [4, 8], wiring: ['4S1P', '8S1P'], status: ['warning', 'valid'], cleared: ['mpptMin'], added: [] });
        expect(change.checks).toBe('Clears: Hot Vmp falls below the MPPT window');
        expect(layoutChangeSummary(after, before).checks).toBe('New: Hot Vmp falls below the MPPT window');
    });

    it('hints when another array already uses the panel, and sorts by £/kWp with unknown prices last', () => {
        const arrays = [{ id: 'A', name: 'East', panel: 'P430' }, { id: 'B', name: 'South', panel: 'P430' }, { id: 'C', name: 'Barn', panel: 'X' }];
        expect(samePanelArrays('P430', arrays, 'A')).toEqual(['South']);
        expect(samePanelArrays('', arrays, 'A')).toEqual([]);
        const byModel = new Map([[panel.model, panel], [cheap.model, cheap], ['NOPRICE', { ...panel, model: 'NOPRICE', price: 0 }]]);
        const list = [{ panelModel: 'P430', count: 8, totalW: 3440 }, { panelModel: 'NOPRICE', count: 8, totalW: 3440 }, { panelModel: 'P400', count: 8, totalW: 3200 }];
        expect(sortLayouts(list, 'cost', byModel).map((r) => r.panelModel)).toEqual(['P400', 'P430', 'NOPRICE']);
        expect(sortLayouts(list, 'power', byModel)).toBe(list);
        expect(layoutCostPerKWp({ ...panel, price: 0 }, 8)).toBeNull();
    });
});

describe('layouts grouped by layout, not by panel', () => {
    const big = { ...panel, model: 'BIG', name: 'Big 500', power: 500, height: 2094, width: 1134, price: 120 };
    const panelByModel = new Map([panel, cheap, big].map((p) => [p.model, p]));
    const roof = roofPolygonFor('rectangle', 6, 4.2);
    const { ranked } = computePlannerLayouts({ roofPolygon_m: roof, exclusions_m: [], spacing: { edge_mm: 300, gap_mm: 20 }, panelsData: [panel, cheap, big], options: { orientation: 'either', topN: 50 } });

    it('puts panels that give the same grid together, with the size band that gives it', () => {
        const groups = groupLayouts(ranked, 'size', panelByModel);
        const same = groups.find((g) => g.candidates.some((c) => c.panelModel === 'P430'));
        // P430 and P400 are the same size, so they share every layout; the big panel gives different ones.
        expect(same.candidates.map((c) => c.panelModel).sort()).toEqual(['P400', 'P430']);
        expect(same.size).toEqual({ minH: 1722, maxH: 1722, minW: 1134, maxW: 1134 });
        expect(same.best.panelModel).toBe('P430'); // most power first inside a group
        expect(groups.every((g) => g.candidates.every((c) => c.count === g.count && c.orientation === g.orientation))).toBe(true);
        // Largest panels first, so each band ends where the next layout starts.
        expect(groups[0].size.maxH).toBe(2094);
    });

    it('sorts groups by power or by £/kWp', () => {
        const byPower = groupLayouts(ranked, 'power', panelByModel);
        // Most power first, except that a layout within 3% of a better one and with fewer panels may lead it.
        for (let i = 0; i < byPower.length; i++) {
            for (let j = i + 1; j < byPower.length; j++) expect(byPower[i].power[1]).toBeGreaterThanOrEqual(byPower[j].power[1] * 0.97);
        }
        const byCost = groupLayouts(ranked, 'cost', panelByModel);
        expect(byCost[0].best.panelModel).toBe('P400');
        expect(byCost[0].bestCostPerKWp).toBe(125);
    });
});

describe('gridLabel', () => {
    it('describes a full grid as columns × rows and a ragged one row by row', () => {
        expect(gridLabel({ rows: 2, cols: 4, rowCounts: [4, 4] })).toBe('4 × 2');
        expect(gridLabel({ rows: 3, cols: 4, rowCounts: [2, 3, 4] })).toBe('rows of 2, 3, 4');
        expect(gridLabel({ rows: 0, cols: 0, rowCounts: [] })).toBe('');
    });
});

describe('insetPolygon (roadmap 13.8)', () => {
    it('moves every edge inwards by the setback', () => {
        const inset = insetPolygon(roofPolygonFor('rectangle', 6, 4), 0.3);
        expect(inset.map((p) => [+p.x.toFixed(6), +p.y.toFixed(6)])).toEqual([[0.3, 0.3], [5.7, 0.3], [5.7, 3.7], [0.3, 3.7]]);
        const hip = insetPolygon(roofPolygonFor('hipped', 10, 3), 0.3);
        expect(hip[3].y).toBeCloseTo(2.7, 6);
        expect(hip[0].y).toBeCloseTo(0.3, 6);
    });
});
