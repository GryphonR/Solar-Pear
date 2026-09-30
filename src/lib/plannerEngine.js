import { rankByPowerWithNearTies } from './layoutRanking';

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export function degreesToRadians(deg) {
    const n = Number(deg);
    if (!Number.isFinite(n)) return 0;
    return (n * Math.PI) / 180;
}

export function projectedToTrueY_m(projectedY_m, tilt_deg) {
    const projectedY = Number(projectedY_m) || 0;
    const tilt = degreesToRadians(tilt_deg);
    const denom = Math.cos(tilt);
    if (!Number.isFinite(denom) || denom === 0) return 0;
    const trueY = projectedY / denom;
    return Number.isFinite(trueY) ? trueY : 0;
}

export function metersToMmInt(m) {
    const n = Number(m);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1000);
}

export function mmIntToMeters(mm) {
    const n = Number(mm);
    if (!Number.isFinite(n)) return 0;
    return n / 1000;
}

export function polygonBoundsMm(pointsMm) {
    if (!Array.isArray(pointsMm) || pointsMm.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pointsMm) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return {
        minX: Number.isFinite(minX) ? minX : 0,
        minY: Number.isFinite(minY) ? minY : 0,
        maxX: Number.isFinite(maxX) ? maxX : 0,
        maxY: Number.isFinite(maxY) ? maxY : 0,
    };
}

// Standard ray-casting point-in-polygon. Points on edge count as inside.
export function pointInPolygonMm(pt, polygonMm) {
    if (!Array.isArray(polygonMm) || polygonMm.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygonMm.length - 1; i < polygonMm.length; j = i++) {
        const xi = polygonMm[i].x;
        const yi = polygonMm[i].y;
        const xj = polygonMm[j].x;
        const yj = polygonMm[j].y;

        // Check edge proximity (colinear + within segment)
        const dx = xj - xi;
        const dy = yj - yi;
        const dxp = pt.x - xi;
        const dyp = pt.y - yi;
        const cross = dx * dyp - dy * dxp;
        if (cross === 0) {
            const dot = dxp * dx + dyp * dy;
            if (dot >= 0) {
                const lenSq = dx * dx + dy * dy;
                if (dot <= lenSq) return true;
            }
        }

        const intersect =
            yi > pt.y !== yj > pt.y &&
            pt.x <= ((xj - xi) * (pt.y - yi)) / (yj - yi + 0) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

export function rectIntersectsAnyExclusionMm(rectMm, exclusionsMm) {
    if (!Array.isArray(exclusionsMm) || exclusionsMm.length === 0) return false;
    const a = rectMm;
    for (const r of exclusionsMm) {
        const b = r;
        const overlap =
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y;
        if (overlap) return true;
    }
    return false;
}

export function rectCornersMm(rectMm) {
    return [
        { x: rectMm.x, y: rectMm.y },
        { x: rectMm.x + rectMm.w, y: rectMm.y },
        { x: rectMm.x + rectMm.w, y: rectMm.y + rectMm.h },
        { x: rectMm.x, y: rectMm.y + rectMm.h },
    ];
}

/** Corners, edge midpoints, and center - used for stronger containment on concave roofs. */
export function rectSamplePointsMm(rectMm) {
    const x = rectMm.x;
    const y = rectMm.y;
    const w = rectMm.w;
    const h = rectMm.h;
    return [
        ...rectCornersMm(rectMm),
        { x: x + w / 2, y: y },
        { x: x + w, y: y + h / 2 },
        { x: x + w / 2, y: y + h },
        { x: x, y: y + h / 2 },
        { x: x + w / 2, y: y + h / 2 },
    ];
}

/** Absolute polygon area via shoelace (mm²). */
export function polygonAreaMm2(polygonMm) {
    if (!Array.isArray(polygonMm) || polygonMm.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < polygonMm.length; i++) {
        const a = polygonMm[i];
        const b = polygonMm[(i + 1) % polygonMm.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

export function pointToSegmentDistanceMm(pt, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = pt.x - a.x;
    const wy = pt.y - a.y;
    const lenSq = vx * vx + vy * vy;
    if (lenSq === 0) return Math.hypot(wx, wy);
    let t = (wx * vx + wy * vy) / lenSq;
    t = clamp(t, 0, 1);
    const px = a.x + t * vx;
    const py = a.y + t * vy;
    return Math.hypot(pt.x - px, pt.y - py);
}

export function minDistanceToPolygonEdgesMm(pt, polygonMm) {
    if (!Array.isArray(polygonMm) || polygonMm.length < 2) return Infinity;
    let min = Infinity;
    for (let i = 0; i < polygonMm.length; i++) {
        const a = polygonMm[i];
        const b = polygonMm[(i + 1) % polygonMm.length];
        const d = pointToSegmentDistanceMm(pt, a, b);
        if (d < min) min = d;
    }
    return min;
}

/** Panel footprint for sorting: width × height (mm², portrait module dimensions in DB). */
function panelFootprintMm2(p) {
    return (Number(p?.width) || 0) * (Number(p?.height) || 0);
}

/**
 * Removes the `count` smallest modules by physical footprint so tiny panels do not dominate layout rankings.
 * If there are at most `count` panels, returns the list unchanged (never returns empty from this step alone).
 */
export function dropSmallestPanelsByFootprint(panels, count = 3) {
    const list = Array.isArray(panels) ? panels : [];
    const n = Math.max(0, Math.floor(Number(count)) || 0);
    if (n === 0 || list.length <= n) return list;
    const sorted = [...list].sort((a, b) => {
        const d = panelFootprintMm2(a) - panelFootprintMm2(b);
        if (d !== 0) return d;
        return (Number(a.power) || 0) - (Number(b.power) || 0);
    });
    return sorted.slice(n);
}

/** Horizontal step (mm) when a row is scanned for the next position a panel fits. */
export const ROW_SCAN_MM = 25;

export function computePlannerLayouts({
    roofPolygon_m,
    exclusions_m = [],
    spacing = { edge_mm: 400, gap_mm: 25 },
    panelsData = [],
    options = { orientation: 'both', topN: 20, includeInactivePanels: false },
}) {
    const edge_mm = clamp(Number(spacing?.edge_mm) || 0, 0, 100000);
    const gap_mm = clamp(Number(spacing?.gap_mm) || 0, 0, 100000);

    const roofPolygonMm = (roofPolygon_m || []).map((p) => ({
        x: metersToMmInt(p.x),
        y: metersToMmInt(p.y),
    }));

    const exclusionsMm = (exclusions_m || []).map((r) => ({
        x: metersToMmInt(r.x),
        y: metersToMmInt(r.y),
        w: metersToMmInt(r.w),
        h: metersToMmInt(r.h),
        id: r.id,
    }));

    const bounds = polygonBoundsMm(roofPolygonMm);
    const usable = {
        minX: bounds.minX + edge_mm,
        minY: bounds.minY + edge_mm,
        maxX: bounds.maxX - edge_mm,
        maxY: bounds.maxY - edge_mm,
    };
    const usableW = Math.max(0, usable.maxX - usable.minX);
    const usableH = Math.max(0, usable.maxY - usable.minY);
    // Utilization uses true roof polygon area (not usable AABB).
    const roofAreaMm2 = polygonAreaMm2(roofPolygonMm);

    const eligiblePanels = (Array.isArray(panelsData) ? panelsData : [])
        .filter((p) => (options?.includeInactivePanels ? true : p.active !== false))
        .filter((p) => (Number(p.width) || 0) > 0 && (Number(p.height) || 0) > 0 && (Number(p.power) || 0) > 0)
        .sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));

    const topN = clamp(Number(options?.topN) || 25, 1, 200);
    const candidates = [];

    const o = options?.orientation;
    // `mixed` is a legacy alias of `either` / `both` (uniform orientation per layout; try portrait and landscape).
    const tryBoth = o === 'both' || o === 'either' || o === 'mixed';
    const wantPortrait = o === 'portrait' || tryBoth;
    const wantLandscape = o === 'landscape' || tryBoth;

    const orientations = [];
    if (wantPortrait) orientations.push('portrait');
    if (wantLandscape) orientations.push('landscape');

    // Vertical offsets tried for the rows: flush with the top, flush with the bottom (the eaves, where a
    // hipped face is widest), a few steps in between, and the offsets that line a row up with each
    // obstacle's top or bottom edge.
    const buildRowOffsets = (stepY, panelH) => {
        if (!Number.isFinite(stepY) || stepY <= 0) return [0];
        const mod = (n) => ((n % stepY) + stepY) % stepY;
        const cands = [0, mod(usableH - panelH), stepY / 4, stepY / 2, (3 * stepY) / 4];
        for (const ex of exclusionsMm) {
            cands.push(mod(ex.y - usable.minY), mod(ex.y + ex.h - usable.minY));
        }
        return Array.from(new Set(cands.filter(Number.isFinite).map((n) => Math.round(n)))).slice(0, 16);
    };

    // A layout depends only on the panel's footprint, so panels of the same size share one packing.
    const packCache = new Map();

    const pack = (panelW, panelH) => {
        const key = `${panelW}x${panelH}`;
        if (packCache.has(key)) return packCache.get(key);

        const stepX = panelW + gap_mm;
        const stepY = panelH + gap_mm;

        const blockers = (rect) => exclusionsMm.filter((ex) => rectIntersectsAnyExclusionMm(rect, [ex]));
        const fits = (rect) => {
            const samples = rectSamplePointsMm(rect);
            if (!samples.every((pt) => pointInPolygonMm(pt, roofPolygonMm))) return false;
            if (edge_mm > 0 && !samples.every((pt) => minDistanceToPolygonEdgesMm(pt, roofPolygonMm) >= edge_mm)) return false;
            return !rectIntersectsAnyExclusionMm(rect, exclusionsMm);
        };

        // Each row is packed on its own: a panel goes in the first place it fits, scanning from the left
        // (and separately from the right) and jumping past obstacles. When both scans place the same
        // number of panels, the row is centred between them if every centred position still fits.
        const packRow = (y) => {
            const rect = (x) => ({ x: Math.round(x), y, w: panelW, h: panelH });
            const left = [];
            for (let x = usable.minX; x + panelW <= usable.maxX + 1e-9; ) {
                const r = rect(x);
                if (fits(r)) {
                    left.push(r.x);
                    x = r.x + stepX;
                    continue;
                }
                const bs = blockers(r);
                x = bs.length ? Math.max(x + ROW_SCAN_MM, ...bs.map((ex) => ex.x + ex.w)) : x + ROW_SCAN_MM;
            }
            const right = [];
            for (let x = usable.maxX - panelW; x >= usable.minX - 1e-9; ) {
                const r = rect(x);
                if (fits(r)) {
                    right.unshift(r.x);
                    x = r.x - stepX;
                    continue;
                }
                const bs = blockers(r);
                x = bs.length ? Math.min(x - ROW_SCAN_MM, ...bs.map((ex) => ex.x - panelW)) : x - ROW_SCAN_MM;
            }
            let xs = right.length > left.length ? right : left;
            if (left.length && left.length === right.length) {
                const mid = left.map((lx, i) => Math.round((lx + right[i]) / 2));
                if (mid.every((mx) => fits(rect(mx)))) xs = mid;
            }
            return xs.map(rect);
        };

        let best = { rows: [], offsetY: 0, count: 0 };
        for (const offY of buildRowOffsets(stepY, panelH)) {
            const rows = [];
            let count = 0;
            for (let y = usable.minY + offY; y + panelH <= usable.maxY + 1e-9; y += stepY) {
                const row = packRow(Math.round(y));
                if (row.length) {
                    rows.push(row);
                    count += row.length;
                }
            }
            if (count > best.count) best = { rows, offsetY: offY, count };
        }
        packCache.set(key, best);
        return best;
    };

    for (const panel of eligiblePanels.slice(0, topN)) {
        const panelW0 = Math.round(Number(panel.width) || 0);
        const panelH0 = Math.round(Number(panel.height) || 0);
        for (const orientation of orientations) {
            const panelW = orientation === 'portrait' ? panelW0 : panelH0;
            const panelH = orientation === 'portrait' ? panelH0 : panelW0;
            if (panelW <= 0 || panelH <= 0) continue;

            const best = pack(panelW, panelH);
            const rowCounts = best.rows.map((row) => row.length);
            const count = best.count;
            const totalW = count * (Number(panel.power) || 0);
            const utilization = roofAreaMm2 > 0 ? (count * panelW * panelH) / roofAreaMm2 : 0;

            const rects_m = best.rows.flat().map((r) => ({
                x: mmIntToMeters(r.x),
                y: mmIntToMeters(r.y),
                w: mmIntToMeters(r.w),
                h: mmIntToMeters(r.h),
            }));

            candidates.push({
                id: `${panel.model}_${orientation}`,
                panelModel: panel.model,
                panelName: panel.name,
                orientation,
                rows: rowCounts.length,
                cols: rowCounts.length ? Math.max(...rowCounts) : 0,
                rowCounts,
                count,
                totalW,
                utilization,
                rects_m,
                offset_mm: { x: 0, y: best.offsetY },
            });
        }
    }

    // Most power first; near-ties (within NEAR_TIE_FRACTION) go to the layout with fewer panels.
    const ranked = rankByPowerWithNearTies(
        [...candidates].sort((a, b) => b.utilization - a.utilization),
        (c) => c.totalW,
        (c) => c.count
    );

    return {
        ranked,
        meta: {
            edge_mm,
            gap_mm,
            usableBounds_mm: usable,
            insetMode: 'distance-to-edge', // Enforced via corner distance to polygon edges
        },
    };
}

