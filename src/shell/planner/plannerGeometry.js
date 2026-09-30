export const MIN_TILT_DEG = 0;
export const MAX_TILT_DEG = 70;

export function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export function metersToMm(m) {
    const n = Number(m);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1000);
}

export function mmToMeters(mm) {
    const n = Number(mm);
    if (!Number.isFinite(n)) return 0;
    return n / 1000;
}

export function sanitizeTiltDeg(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return MIN_TILT_DEG;
    return clamp(n, MIN_TILT_DEG, MAX_TILT_DEG);
}

export function computeTrueDimsM(roofInput) {
    const mode = roofInput?.mode || 'actual';
    if (mode === 'projected') {
        const projectedX = Number(roofInput?.projectedX_m) || 0;
        const projectedY = Number(roofInput?.projectedY_m) || 0;
        const tiltDeg = sanitizeTiltDeg(roofInput?.tilt_deg);
        const trueY = projectedY / Math.cos(tiltDeg * (Math.PI / 180));
        return { trueX_m: projectedX, trueY_m: Number.isFinite(trueY) ? trueY : 0 };
    }
    return { trueX_m: Number(roofInput?.x_m) || 0, trueY_m: Number(roofInput?.y_m) || 0 };
}

export function defaultRoofPolygonFromDims(trueX_m, trueY_m) {
    const x = Math.max(0.1, Number(trueX_m) || 0);
    const y = Math.max(0.1, Number(trueY_m) || 0);
    return [
        { x: 0, y: 0 },
        { x, y: 0 },
        { x, y },
        { x: 0, y },
    ];
}

export function approxPolyEqual(a, b, eps = 1e-6) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i].x - b[i].x) > eps) return false;
        if (Math.abs(a[i].y - b[i].y) > eps) return false;
    }
    return true;
}

export function polygonBounds(poly) {
    if (!Array.isArray(poly) || poly.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }
    return { minX, minY, maxX, maxY };
}

export function exclusionBounds(exclusions) {
    if (!Array.isArray(exclusions) || exclusions.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of exclusions) {
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
}

export function toSvgPoint(svgEl, clientX, clientY, viewBox) {
    const ctm = svgEl.getScreenCTM?.();
    if (ctm) {
        const svgPt = svgEl.createSVGPoint();
        svgPt.x = clientX;
        svgPt.y = clientY;
        const mapped = svgPt.matrixTransform(ctm.inverse());
        return { x: mapped.x, y: mapped.y };
    }

    const rect = svgEl.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return {
        x: viewBox.x + nx * viewBox.w,
        y: viewBox.y + ny * viewBox.h,
    };
}

export function pointToSegmentProjection(pt, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = pt.x - a.x;
    const wy = pt.y - a.y;
    const lenSq = vx * vx + vy * vy;
    if (lenSq === 0) return { x: a.x, y: a.y, t: 0, dist: Math.hypot(pt.x - a.x, pt.y - a.y) };
    let t = (wx * vx + wy * vy) / lenSq;
    t = clamp(t, 0, 1);
    const x = a.x + t * vx;
    const y = a.y + t * vy;
    const dist = Math.hypot(pt.x - x, pt.y - y);
    return { x, y, t, dist };
}

export function edgeAnnotations(poly) {
    if (!Array.isArray(poly) || poly.length < 2) return [];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        out.push({
            i,
            a,
            b,
            len,
            mx,
            my,
        });
    }
    return out;
}
