/**
 * @file plannerLayouts.js
 * Pure helpers for the redesigned layout planner (roadmap 13.8, canvas boards "Layout planner"): roof
 * shapes from the first-use card, empty slots, what applying a layout would change, and the "same panel
 * as another array" hint. Packing stays in `plannerEngine.js`; checks stay in the engine (the preview is
 * analysed with the same `analyzeArray`, see `analyzeArrayWith` in AppStateContext).
 */

import { bestParallelStringsForController, formatWiringLabel } from './arrayAnalysis';
import { arrayStatus } from './designStatus';
import { ISSUE_ADVICE } from './issueAdvice';
import { rankByPowerWithNearTies } from './layoutRanking';
import { knownPrice } from './pricing';

export const ROOF_SHAPES = Object.freeze([
    { id: 'rectangle', label: 'Rectangle', hint: 'gable roofs, lean-tos' },
    { id: 'hipped', label: 'Hipped', hint: 'sloping ends' },
    { id: 'draw', label: 'Draw my own', hint: 'click the corners' },
]);

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Length along the slope from a plan (map) depth and the pitch in degrees; 0 when the pitch is unknown. */
export function slopeLengthFromPlan(depth_m, pitch_deg) {
    const pitch = num(pitch_deg);
    if (!(pitch > 0 && pitch < 90)) return 0;
    return num(depth_m) / Math.cos((pitch * Math.PI) / 180);
}

/** Pitch assumed for a hipped roof's ridge estimate when only tape measurements are known (typical UK tiled roof). */
export const ASSUMED_PITCH_DEG = 35;

/**
 * Estimated ridge length of a hipped face. When every face has the same pitch (the usual case), each hip
 * runs inwards by the face's depth seen from above, slope × cos(pitch), so the ridge is the eaves width
 * less twice that. 0 means the face is a triangle (a pyramid roof).
 */
export function estimatedRidge(width_m, slope_m, pitch_deg) {
    const pitch = num(pitch_deg) > 0 && num(pitch_deg) < 90 ? num(pitch_deg) : ASSUMED_PITCH_DEG;
    return Math.max(0, num(width_m) - 2 * num(slope_m) * Math.cos((pitch * Math.PI) / 180));
}

/**
 * Roof face outline in metres, y down from the ridge. A hipped face is a trapezoid: the ridge is shorter
 * than the eaves by the hip on each side (default: `estimatedRidge`, from the pitch when it is known).
 */
export function roofPolygonFor(shape, width_m, slope_m, ridge_m, pitch_deg) {
    const w = Math.max(0.1, num(width_m));
    const h = Math.max(0.1, num(slope_m));
    if (shape === 'hipped') {
        const ridge = ridge_m == null || ridge_m === '' ? estimatedRidge(w, h, pitch_deg) : Math.min(w, Math.max(0, num(ridge_m)));
        const inset = (w - ridge) / 2;
        return [
            { x: inset, y: 0 },
            { x: inset + ridge, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
        ];
    }
    return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
    ];
}

/** The pitch the user gave, if any: only a map measurement asks for it. */
export const knownPitch = (roofInput) => (roofInput?.mode === 'projected' ? roofInput.tilt_deg : null);

/**
 * Planner state from the first-use card. Returns null while something needed is missing (e.g. the pitch
 * for a plan measurement), so the card can keep "Continue" disabled and say why.
 * @param {{ shape, measure: 'tape'|'map', width, length, depth, pitch, ridge }} start
 */
export function plannerFromStart(start) {
    const width = num(start.width);
    const slope = start.measure === 'map' ? slopeLengthFromPlan(start.depth, start.pitch) : num(start.length);
    if (!(width > 0) || !(slope > 0)) return null;
    const roofInput =
        start.measure === 'map'
            ? { mode: 'projected', projectedX_m: width, projectedY_m: num(start.depth), tilt_deg: num(start.pitch), x_m: width, y_m: slope }
            : { mode: 'actual', x_m: width, y_m: slope, projectedX_m: width, projectedY_m: slope, tilt_deg: 30 };
    return {
        roofInput,
        roofShape: start.shape === 'hipped' ? 'hipped' : start.shape === 'draw' ? 'draw' : 'rectangle',
        roofPolygon: roofPolygonFor(start.shape, width, slope, start.ridge, start.measure === 'map' ? start.pitch : null),
        roofPolygonAuto: start.shape !== 'hipped' && start.shape !== 'draw',
        ridge_m: start.shape === 'hipped' && start.ridge !== '' && start.ridge != null ? num(start.ridge) : null,
        exclusions: [],
        spacing: { edge_mm: 300, gap_mm: 20 },
        options: { orientation: 'either' },
        layoutOverride: { enabled: false },
        emptySlots: {},
        lastResult: null,
    };
}

/** Stable key for a slot in a layout (its position to the millimetre). */
export const slotKey = (rect) => `${Math.round(rect.x * 1000)},${Math.round(rect.y * 1000)}`;

/**
 * A ranked candidate with some slots left empty. The engine packs a full grid; the user can switch
 * individual slots off (a vent, a shaded corner) and the count, power and wiring follow.
 */
export function withEmptySlots(candidate, emptyKeys = [], panel = null) {
    if (!candidate) return null;
    const empty = new Set(emptyKeys);
    const rects = candidate.rects_m || [];
    const kept = rects.filter((r) => !empty.has(slotKey(r)));
    const emptyRects = rects.filter((r) => empty.has(slotKey(r)));
    const power = Number(panel?.power) || (candidate.count ? candidate.totalW / candidate.count : 0);
    return { ...candidate, rects_m: kept, emptyRects, count: kept.length, totalW: kept.length * power };
}

/**
 * The array fields a layout would set, as the old planner's Apply did: panel, count, the maximum panel
 * size (swapped for landscape) and a wiring that the assigned controller accepts where there is one.
 */
export function layoutPatch(array, candidate, panel, { controller = null, systemVoltage = null, conditions } = {}) {
    const rects = candidate.rects_m || [];
    const count = rects.length;
    const mm = (m) => Math.round(m * 1000);
    const maxW = rects.length ? Math.max(...rects.map((r) => mm(r.w))) : 0;
    const maxH = rects.length ? Math.max(...rects.map((r) => mm(r.h))) : 0;
    const landscape = candidate.orientation === 'landscape';
    let parallelStrings = 1;
    const best = controller && panel && count > 0 ? bestParallelStringsForController(array, panel, count, controller, systemVoltage, conditions) : null;
    if (best != null) parallelStrings = best;
    else {
        const prev = Number(array?.parallelStrings) || 1;
        parallelStrings = count > 0 && count % prev === 0 ? prev : 1;
    }
    return {
        panel: candidate.panelModel,
        count,
        parallelStrings,
        ...(rects.length ? { maxPanelWidth: landscape ? maxH : maxW, maxPanelHeight: landscape ? maxW : maxH } : {}),
    };
}

const titleOf = (code) => ISSUE_ADVICE[code]?.title || code;
const seriousCodes = (analysis) =>
    new Set((analysis?.issues || []).filter((i) => i.severity === 'error' || i.severity === 'warning').map((i) => i.code));

/**
 * What applying a layout would change, from two analyses of the same array (now and previewed).
 * @returns {{ panels: [number, number], wiring: [string, string], peakPower: [number, number],
 *            status: [string, string], cleared: string[], added: string[], checks: string }}
 */
export function layoutChangeSummary(before, after) {
    const wiring = (a) => (a?.array ? formatWiringLabel(a.array.count, a.array.parallelStrings || 1) || '—' : '—');
    const b = seriousCodes(before);
    const a = seriousCodes(after);
    const cleared = [...b].filter((c) => !a.has(c));
    const added = [...a].filter((c) => !b.has(c));
    const statusAfter = arrayStatus(after);
    let checks;
    if (!after?.controller) checks = 'Not checked: the array has no controller yet';
    else if (added.length) checks = `New: ${added.map(titleOf).join('; ')}`;
    else if (cleared.length) checks = `Clears: ${cleared.map(titleOf).join('; ')}`;
    else if (statusAfter === 'valid') checks = 'Passes every check';
    else checks = 'No change to the checks';
    return {
        panels: [before?.array?.count || 0, after?.array?.count || 0],
        wiring: [wiring(before), wiring(after)],
        peakPower: [before?.peakPower || 0, after?.peakPower || 0],
        status: [arrayStatus(before), statusAfter],
        cleared,
        added,
        checks,
    };
}

/** Names of other arrays in the project already using this panel (buying one model is simpler). */
export function samePanelArrays(panelModel, arrays, exceptId) {
    if (!panelModel) return [];
    return arrays.filter((a) => a.id !== exceptId && a.panel === panelModel).map((a) => a.name);
}

/** £ per kWp of a layout's panels, or null when the price is unknown. */
export function layoutCostPerKWp(panel, count) {
    const price = knownPrice(panel);
    const kw = ((Number(panel?.power) || 0) * count) / 1000;
    return price == null || !(kw > 0) ? null : (price * count) / kw;
}

/** Ranked layouts sorted by 'power' (engine order) or 'cost' (£/kWp, unknown last). */
export function sortLayouts(ranked, sort, panelByModel) {
    if (sort !== 'cost') return ranked;
    const cost = (r) => layoutCostPerKWp(panelByModel.get(r.panelModel), r.count);
    return [...ranked].sort((x, y) => {
        const cx = cost(x);
        const cy = cost(y);
        if (cx == null && cy == null) return y.totalW - x.totalW;
        if (cx == null) return 1;
        if (cy == null) return -1;
        return cx - cy || y.totalW - x.totalW;
    });
}

/**
 * Ranked candidates grouped by layout: the same orientation, grid (rows × columns) and panel count.
 * Many panels of about the same size give the same layout, so the list shows layouts, each with the band
 * of panel sizes that produces it, and the panels as a choice inside it.
 * @param {object[]} candidates ranked layouts (`computePlannerLayouts().ranked`), already filtered
 * @param {'size'|'power'|'cost'} sort size: largest panels first (so each group's band ends where the next
 *   layout takes over); power: best kWp first; cost: best £/kWp first, unknown last
 * @param {Map<string, object>} panelByModel
 * @returns {{ key, orientation, count, rows, cols, candidates: object[], best: object,
 *            size: { minH, maxH, minW, maxW }, power: [number, number], bestCostPerKWp: number|null }[]}
 */
export function groupLayouts(candidates, sort, panelByModel) {
    const groups = new Map();
    for (const c of candidates) {
        const key = [c.orientation, c.rowCounts ? c.rowCounts.join('.') : `${c.rows ?? ''}x${c.cols ?? ''}`, c.count].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    const out = [...groups.entries()].map(([key, list]) => {
        const panels = list.map((c) => panelByModel.get(c.panelModel)).filter(Boolean);
        const hs = panels.map((p) => Number(p.height) || 0);
        const ws = panels.map((p) => Number(p.width) || 0);
        const inner = sortLayouts([...list].sort((a, b) => b.totalW - a.totalW), sort === 'cost' ? 'cost' : 'power', panelByModel);
        const costs = list.map((c) => layoutCostPerKWp(panelByModel.get(c.panelModel), c.count)).filter((x) => x != null);
        const [first] = list;
        return {
            key,
            orientation: first.orientation,
            count: first.count,
            rows: first.rows ?? null,
            cols: first.cols ?? null,
            rowCounts: first.rowCounts ?? null,
            candidates: inner,
            best: inner[0],
            size: { minH: Math.min(...hs), maxH: Math.max(...hs), minW: Math.min(...ws), maxW: Math.max(...ws) },
            power: [Math.min(...list.map((c) => c.totalW)), Math.max(...list.map((c) => c.totalW))],
            bestCostPerKWp: costs.length ? Math.min(...costs) : null,
        };
    });
    const area = (g) => g.size.maxH * g.size.maxW;
    if (sort === 'power') return rankByPowerWithNearTies(out, (g) => g.power[1], (g) => g.count);
    return out.sort((a, b) => {
        if (sort === 'cost') {
            if (a.bestCostPerKWp == null || b.bestCostPerKWp == null) return (a.bestCostPerKWp == null) - (b.bestCostPerKWp == null) || b.power[1] - a.power[1];
            return a.bestCostPerKWp - b.bestCostPerKWp || b.power[1] - a.power[1];
        }
        return area(b) - area(a) || a.count - b.count;
    });
}

/**
 * Short description of a layout's rows: "4 × 2" when every row holds the same number of panels,
 * otherwise the panels in each row from the top, e.g. "rows of 2, 3, 4" on a hipped face.
 */
export function gridLabel(layout) {
    const counts = layout?.rowCounts;
    if (Array.isArray(counts) && counts.length > 1 && counts.some((n) => n !== counts[0])) return `rows of ${counts.join(', ')}`;
    return layout?.cols && layout?.rows ? `${layout.cols} × ${layout.rows}` : '';
}

/**
 * The setback line: the roof outline moved inwards by `d` metres on every edge. Exact for convex shapes
 * (rectangles, hipped faces); for a drawn concave outline it is a guide only, since the engine checks the
 * distance from each panel to every edge itself.
 */
export function insetPolygon(poly, d) {
    if (!Array.isArray(poly) || poly.length < 3 || !(d > 0)) return poly || [];
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        area += a.x * b.y - b.x * a.y;
    }
    const sign = area > 0 ? 1 : -1; // y points down, so a positive area is clockwise on screen
    const lines = poly.map((a, i) => {
        const b = poly[(i + 1) % poly.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = (-(b.y - a.y) / len) * sign;
        const ny = ((b.x - a.x) / len) * sign;
        return { a: { x: a.x + nx * d, y: a.y + ny * d }, b: { x: b.x + nx * d, y: b.y + ny * d } };
    });
    return lines.map((cur, i) => {
        const prev = lines[(i - 1 + lines.length) % lines.length];
        const x1 = prev.a.x, y1 = prev.a.y, x2 = prev.b.x, y2 = prev.b.y;
        const x3 = cur.a.x, y3 = cur.a.y, x4 = cur.b.x, y4 = cur.b.y;
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 1e-12) return cur.a;
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    });
}
