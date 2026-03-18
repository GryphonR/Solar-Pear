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
    const usableArea = usableW * usableH;

    const eligiblePanels = (Array.isArray(panelsData) ? panelsData : [])
        .filter((p) => (options?.includeInactivePanels ? true : p.active !== false))
        .filter((p) => (Number(p.width) || 0) > 0 && (Number(p.height) || 0) > 0 && (Number(p.power) || 0) > 0)
        .sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));

    const topN = clamp(Number(options?.topN) || 25, 1, 200);
    const candidates = [];

    const wantPortrait = options?.orientation === 'portrait' || options?.orientation === 'both';
    const wantLandscape = options?.orientation === 'landscape' || options?.orientation === 'both';

    const orientations = [];
    if (wantPortrait) orientations.push('portrait');
    if (wantLandscape) orientations.push('landscape');

    const uniqueSortedInts = (arr) => Array.from(new Set(arr.filter(Number.isFinite).map((n) => Math.round(n)))).sort((a, b) => a - b);

    const buildOffsetCandidates = (step, usableMin, exclusionsMm) => {
        if (!Number.isFinite(step) || step <= 0) return [0];
        const cands = [0];
        for (const ex of exclusionsMm || []) {
            const a = ((ex.x - usableMin) % step + step) % step;
            const b = ((ex.x + ex.w - usableMin) % step + step) % step;
            cands.push(a, b);
        }
        // Keep set small and stable
        return uniqueSortedInts(cands).slice(0, 16);
    };

    for (const panel of eligiblePanels.slice(0, topN)) {
        const panelW0 = Math.round(Number(panel.width) || 0);
        const panelH0 = Math.round(Number(panel.height) || 0);
        for (const orientation of orientations) {
            const panelW = orientation === 'portrait' ? panelW0 : panelH0;
            const panelH = orientation === 'portrait' ? panelH0 : panelW0;
            if (panelW <= 0 || panelH <= 0) continue;

            const stepX = panelW + gap_mm;
            const stepY = panelH + gap_mm;

            const xOffsets = buildOffsetCandidates(stepX, usable.minX, exclusionsMm);
            const yOffsets = buildOffsetCandidates(stepY, usable.minY, exclusionsMm);

            let best = { rectsMm: [], placedRows: 0, placedCols: 0, offsetX: 0, offsetY: 0 };

            for (const offX of xOffsets) {
                for (const offY of yOffsets) {
                    const rectsMm = [];
                    let placedRows = 0;
                    let placedCols = 0;

                    // Iterate grid positions while staying within usable bbox.
                    let r = 0;
                    for (
                        let y = usable.minY + offY;
                        y + panelH <= usable.maxY + 1e-9;
                        y += stepY, r++
                    ) {
                        let anyInRow = false;
                        let c = 0;
                        for (
                            let x = usable.minX + offX;
                            x + panelW <= usable.maxX + 1e-9;
                            x += stepX, c++
                        ) {
                            const rect = { x: Math.round(x), y: Math.round(y), w: panelW, h: panelH };

                            const corners = rectCornersMm(rect);
                            const inside = corners.every((pt) => pointInPolygonMm(pt, roofPolygonMm));
                            if (!inside) continue;
                            if (edge_mm > 0) {
                                const farEnough = corners.every(
                                    (pt) => minDistanceToPolygonEdgesMm(pt, roofPolygonMm) >= edge_mm
                                );
                                if (!farEnough) continue;
                            }
                            if (rectIntersectsAnyExclusionMm(rect, exclusionsMm)) continue;

                            rectsMm.push(rect);
                            anyInRow = true;
                            placedCols = Math.max(placedCols, c + 1);
                        }
                        if (anyInRow) placedRows = r + 1;
                    }

                    if (rectsMm.length > best.rectsMm.length) {
                        best = { rectsMm, placedRows, placedCols, offsetX: offX, offsetY: offY };
                    }
                }
            }

            const count = best.rectsMm.length;
            const totalW = count * (Number(panel.power) || 0);
            const utilization = usableArea > 0 ? (count * panelW * panelH) / usableArea : 0;

            const rects_m = best.rectsMm.map((r) => ({
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
                rows: best.placedRows,
                cols: best.placedCols,
                count,
                totalW,
                utilization,
                rects_m,
                offset_mm: { x: best.offsetX, y: best.offsetY },
            });
        }
    }

    candidates.sort((a, b) => {
        if (b.totalW !== a.totalW) return b.totalW - a.totalW;
        if (b.count !== a.count) return b.count - a.count;
        return b.utilization - a.utilization;
    });

    return {
        ranked: candidates,
        meta: {
            edge_mm,
            gap_mm,
            usableBounds_mm: usable,
            insetMode: 'distance-to-edge', // Enforced via corner distance to polygon edges
        },
    };
}

