import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import Modal from '../Modal';
import { computePlannerLayouts } from '../../lib/plannerEngine';
import { useAppState } from '../../context/AppStateContext';
import { isCompatibleFormat, panelPassesControllerLimits } from '../../lib/arrayAnalysis';
import { Info, RotateCcw } from '../Icons';

const DEFAULT_PLANNER = {
    roofInput: {
        mode: 'actual', // 'actual' | 'projected'
        x_m: 6,
        y_m: 4,
        projectedX_m: 6,
        projectedY_m: 4,
        tilt_deg: 30,
    },
    roofPolygon: null,
    roofPolygonAuto: true,
    exclusions: [],
    spacing: { edge_mm: 400, gap_mm: 25 },
    options: { orientation: 'either' }, // 'portrait'|'landscape'|'either'|'mixed'
    lastResult: null,
};

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function metersToMm(m) {
    const n = Number(m);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1000);
}

function mmToMeters(mm) {
    const n = Number(mm);
    if (!Number.isFinite(n)) return 0;
    return n / 1000;
}

function computeTrueDimsM(roofInput) {
    const mode = roofInput?.mode || 'actual';
    if (mode === 'projected') {
        const projectedX = Number(roofInput?.projectedX_m) || 0;
        const projectedY = Number(roofInput?.projectedY_m) || 0;
        const tiltDeg = Number(roofInput?.tilt_deg) || 0;
        const trueY = projectedY / Math.cos(tiltDeg * (Math.PI / 180));
        return { trueX_m: projectedX, trueY_m: Number.isFinite(trueY) ? trueY : 0 };
    }
    return { trueX_m: Number(roofInput?.x_m) || 0, trueY_m: Number(roofInput?.y_m) || 0 };
}

function defaultRoofPolygonFromDims(trueX_m, trueY_m) {
    const x = Math.max(0.1, Number(trueX_m) || 0);
    const y = Math.max(0.1, Number(trueY_m) || 0);
    return [
        { x: 0, y: 0 },
        { x, y: 0 },
        { x, y },
        { x: 0, y },
    ];
}

function approxPolyEqual(a, b, eps = 1e-6) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i].x - b[i].x) > eps) return false;
        if (Math.abs(a[i].y - b[i].y) > eps) return false;
    }
    return true;
}

function polygonBounds(poly) {
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

function exclusionBounds(exclusions) {
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

function toSvgPoint(svgEl, clientX, clientY, viewBox) {
    const rect = svgEl.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return {
        x: viewBox.x + nx * viewBox.w,
        y: viewBox.y + ny * viewBox.h,
    };
}

function pointToSegmentProjection(pt, a, b) {
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

function edgeAnnotations(poly) {
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

const ArrayPlanner = forwardRef(function ArrayPlanner(
    {
        active,
        arrayId,
        draftArrayData,
        arraysData,
        panelsData,
        onHeaderChange,
        onApplyCandidateToDraft,
    },
    ref
) {
    const { chargersData, siteControllers, selections, systemVoltage, setArraysData } = useAppState();

    const array = useMemo(() => arraysData?.find((a) => a.id === arrayId) || null, [arraysData, arrayId]);
    const basePlanner = array?.planner || draftArrayData?.planner || DEFAULT_PLANNER;

    const [planner, setPlanner] = useState(basePlanner);
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const [resultsTab, setResultsTab] = useState('layout'); // 'layout' | 'panels'
    const [selectedExclusionId, setSelectedExclusionId] = useState(null);
    const [toolMode, setToolMode] = useState('select'); // 'select' | 'measure' | 'delete' | 'addCorner'
    const [measure, setMeasure] = useState({ a: null, b: null });
    const [mousePos, setMousePos] = useState(null);
    const [hoverEdge, setHoverEdge] = useState(null); // { i, x, y, dist } | null
    const [hoverDeleteTarget, setHoverDeleteTarget] = useState(null); // { type: 'vertex'|'exclusion', index } | null
    const [addExclusionModal, setAddExclusionModal] = useState({ open: false, w_m: 1.0, h_m: 1.0 });
    const svgRef = useRef(null);
    const dragRef = useRef(null); // { type: 'vertex'|'exclusion-move'|'exclusion-resize', index, corner, start, orig }
    const modeHelpRef = useRef(null);
    const [showModeHelp, setShowModeHelp] = useState(false);
    const [filterPanelsByController, setFilterPanelsByController] = useState(false);

    useImperativeHandle(
        ref,
        () => ({
            getPlanner: () => planner,
        }),
        [planner]
    );

    useEffect(() => {
        if (!active) return;
        setPlanner(basePlanner);
        setActiveResultIndex(0);
        setResultsTab('layout');
        setSelectedExclusionId(null);
        setToolMode('select');
        setMeasure({ a: null, b: null });
        setMousePos(null);
        setHoverEdge(null);
        setHoverDeleteTarget(null);
        setShowModeHelp(false);
        setFilterPanelsByController(false);
        setAddExclusionModal((prev) => ({ ...prev, open: false }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, arrayId]);

    useEffect(() => {
        if (!showModeHelp) return;
        const onPointerDown = (e) => {
            const el = modeHelpRef.current;
            if (!el) return;
            if (!el.contains(e.target)) setShowModeHelp(false);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setShowModeHelp(false);
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [showModeHelp]);

    const roofInput = planner.roofInput || DEFAULT_PLANNER.roofInput;
    const { trueX_m, trueY_m } = computeTrueDimsM(roofInput);

    const roofPolygon = useMemo(() => {
        const existing = planner.roofPolygon;
        if (Array.isArray(existing) && existing.length >= 3) return existing;
        return defaultRoofPolygonFromDims(trueX_m, trueY_m);
    }, [planner.roofPolygon, trueX_m, trueY_m]);

    // Keep the default roof polygon in sync with true dims until user edits it.
    useEffect(() => {
        if (!active) return;
        const isAuto = planner.roofPolygonAuto !== false;
        if (!isAuto) return;
        const nextPoly = defaultRoofPolygonFromDims(trueX_m, trueY_m);
        const existing = Array.isArray(planner.roofPolygon) ? planner.roofPolygon : null;
        if (existing && approxPolyEqual(existing, nextPoly)) return;
        setPlanner((prev) => ({
            ...prev,
            roofPolygon: nextPoly,
            roofPolygonAuto: true,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, trueX_m, trueY_m, planner.roofPolygonAuto, planner.roofPolygon]);

    const exclusions = planner.exclusions || [];
    const isRoofAuto = planner.roofPolygonAuto !== false;
    const isDeleteMode = toolMode === 'delete';

    const controllerForArray = useMemo(() => {
        if (!array) return null;
        const sel = selections[arrayId] || {};
        let controllerInstance = null;
        if (sel.controllerInstanceId) {
            controllerInstance = siteControllers.find((sc) => sc.id === sel.controllerInstanceId);
        }
        if (controllerInstance) {
            return chargersData.find((c) => c.id === controllerInstance.modelId) || null;
        }
        if (sel.controller) {
            return chargersData.find((c) => c.id === sel.controller) || null;
        }
        return null;
    }, [array, arrayId, selections, siteControllers, chargersData]);

    const filteredPanelsForEngine = useMemo(() => {
        const list = Array.isArray(panelsData) ? panelsData : [];
        if (!arrayId || !array) {
            return list.filter((p) => p.active !== false);
        }
        return list.filter((p) => {
            if (p.active === false) return false;
            if (!isCompatibleFormat(array, p)) return false;
            if (filterPanelsByController && !panelPassesControllerLimits(array, p, controllerForArray, systemVoltage)) {
                return false;
            }
            return true;
        });
    }, [arrayId, array, panelsData, filterPanelsByController, controllerForArray, systemVoltage]);

    useEffect(() => {
        if (!active) return;
        const sigObj = {
            roofPolygon: roofPolygon,
            exclusions,
            spacing: planner.spacing || DEFAULT_PLANNER.spacing,
            options: planner.options || DEFAULT_PLANNER.options,
            panelsCount: Array.isArray(filteredPanelsForEngine) ? filteredPanelsForEngine.length : 0,
        };
        const sig = JSON.stringify(sigObj);
        if (planner.lastResult?._sig === sig) return;

        const res = computePlannerLayouts({
            roofPolygon_m: roofPolygon,
            exclusions_m: exclusions,
            spacing: planner.spacing || DEFAULT_PLANNER.spacing,
            panelsData: filteredPanelsForEngine,
            options: {
                orientation: planner.options?.orientation || 'either',
                topN: 200,
                includeInactivePanels: false,
            },
        });
        setPlanner((prev) => ({ ...prev, lastResult: { ...res, _sig: sig } }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, filteredPanelsForEngine, roofPolygon, exclusions, planner.spacing, planner.options]);

    const results = planner.lastResult?.ranked || [];
    const activeResult = results[activeResultIndex] || results[0] || null;
    const panelRects = activeResult?.rects_m || [];

    const applyCandidateToArray = (candidate, resultIndex) => {
        if (!candidate) return;
        if (typeof resultIndex === 'number') setActiveResultIndex(resultIndex);

        const rects = Array.isArray(candidate.rects_m) ? candidate.rects_m : [];
        const maxPanelWidth = rects.length ? Math.max(...rects.map((r) => metersToMm(r.w))) : 0;
        const maxPanelHeight = rects.length ? Math.max(...rects.map((r) => metersToMm(r.h))) : 0;
        const derivedCount = rects.length || (Number.isFinite(Number(candidate.count)) ? Number(candidate.count) : 0);
        const hasRectDims = rects.length > 0;
        const isLandscapePlan = candidate.orientation === 'landscape';

        // `rects_m` come from plannerEngine where panel dimensions are swapped for landscape layouts:
        // - portrait: rects_m.w == panel.width, rects_m.h == panel.height
        // - landscape: rects_m.w == panel.height, rects_m.h == panel.width
        // `useValidPanels` always compares unrotated `panel.height` to `array.maxPanelHeight` and
        // unrotated `panel.width` to `array.maxPanelWidth`, so we need to swap max constraints accordingly.
        const nextMaxPanelWidth = isLandscapePlan ? maxPanelHeight : maxPanelWidth;
        const nextMaxPanelHeight = isLandscapePlan ? maxPanelWidth : maxPanelHeight;

        if (arrayId) {
            // Persist selection fields in a single write to avoid state/localStorage overwrites.
            setArraysData((prev) =>
                prev.map((a) =>
                    a.id === arrayId
                        ? {
                              ...a,
                              count: derivedCount,
                              // Only overwrite max dimensions when we actually have rects.
                              // Otherwise we might accidentally clamp everything to 0.
                              ...(hasRectDims
                                  ? { maxPanelWidth: nextMaxPanelWidth, maxPanelHeight: nextMaxPanelHeight }
                                  : {}),
                              panel: candidate.panelModel ?? a.panel ?? '',
                          }
                        : a
                )
            );
        } else {
            const nextDraftFields = {
                count: derivedCount,
                panel: candidate.panelModel ?? draftArrayData?.panel ?? '',
            };
            if (hasRectDims) {
                nextDraftFields.maxPanelWidth = nextMaxPanelWidth;
                nextDraftFields.maxPanelHeight = nextMaxPanelHeight;
            }
            onApplyCandidateToDraft?.(nextDraftFields);
        }
    };

    const panelByModel = useMemo(() => {
        const map = new Map();
        for (const p of Array.isArray(panelsData) ? panelsData : []) map.set(p.model, p);
        return map;
    }, [panelsData]);

    const layoutGroups = useMemo(() => {
        const groups = new Map();
        for (let idx = 0; idx < results.length; idx++) {
            const r = results[idx];
            const key = [r.orientation, r.count ?? 0, r.rows ?? '', r.cols ?? ''].join('|');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ r, idx });
        }

        const out = [];
        for (const [key, list] of groups.entries()) {
            const bestPair = list.reduce((acc, cur) => (cur.r.totalW > acc.r.totalW ? cur : acc), list[0]);
            const best = bestPair.r;
            const bestIndex = bestPair.idx;
            const bestPanel = panelByModel.get(best.panelModel);
            const rects = best.rects_m || [];
            const maxWmm = rects.length ? Math.max(...rects.map((x) => metersToMm(x.w))) : 0;
            const maxHmm = rects.length ? Math.max(...rects.map((x) => metersToMm(x.h))) : 0;
            out.push({
                key,
                orientation: best.orientation,
                count: best.count ?? 0,
                rows: best.rows ?? null,
                cols: best.cols ?? null,
                maxPanelWmm: maxWmm,
                maxPanelHmm: maxHmm,
                bestTotalW: best.totalW ?? 0,
                bestPanelName: bestPanel?.name || best.panelName || best.panelModel,
                bestResultIndex: bestIndex,
            });
        }
        out.sort((a, b) => b.bestTotalW - a.bestTotalW || b.count - a.count);
        return out;
    }, [results, panelByModel]);

    const bounds = useMemo(() => {
        const polyB = polygonBounds(roofPolygon);
        const exclB = exclusionBounds(exclusions);
        const pad = 0.5;
        let minX = polyB.minX;
        let minY = polyB.minY;
        let maxX = polyB.maxX;
        let maxY = polyB.maxY;
        if (exclB) {
            minX = Math.min(minX, exclB.minX);
            minY = Math.min(minY, exclB.minY);
            maxX = Math.max(maxX, exclB.maxX);
            maxY = Math.max(maxY, exclB.maxY);
        }
        if (Array.isArray(panelRects) && panelRects.length) {
            for (const r of panelRects) {
                minX = Math.min(minX, r.x);
                minY = Math.min(minY, r.y);
                maxX = Math.max(maxX, r.x + r.w);
                maxY = Math.max(maxY, r.y + r.h);
            }
        }
        const w = Math.max(0.1, maxX - minX);
        const h = Math.max(0.1, maxY - minY);
        return { x: minX - pad, y: minY - pad, w: w + pad * 2, h: h + pad * 2 };
    }, [roofPolygon, exclusions, panelRects]);

    const grid = useMemo(() => {
        // Patterns use "meters" because SVG coordinates are meters.
        // Minor: 0.1m, Major: 1.0m
        return {
            minor: 0.1,
            major: 1.0,
        };
    }, []);

    const annotations = useMemo(() => edgeAnnotations(roofPolygon), [roofPolygon]);
    const edgeSetback_m = mmToMeters(planner.spacing?.edge_mm ?? DEFAULT_PLANNER.spacing.edge_mm);

    const header = useMemo(() => {
        return (
            <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate">
                    Planner{array ? ` — ${array.name}` : draftArrayData?.name ? ` — ${draftArrayData.name}` : ''}
                </div>
                <div className="text-xs text-slate-500">
                    Roof (true) X: {Number(trueX_m || 0).toFixed(2)}m · Roof (true) Y:{' '}
                    {Number(trueY_m || 0).toFixed(2)}m
                </div>
            </div>
        );
    }, [array, draftArrayData?.name, trueX_m, trueY_m]);

    useEffect(() => {
        onHeaderChange?.(header);
    }, [header, onHeaderChange]);

    const updatePlanner = (patch) => setPlanner((prev) => ({ ...prev, ...patch }));
    const updateRoofInput = (patch) =>
        setPlanner((prev) => ({ ...prev, roofInput: { ...(prev.roofInput || DEFAULT_PLANNER.roofInput), ...patch } }));

    const ensurePolygonPersisted = () => {
        if (!Array.isArray(planner.roofPolygon) || planner.roofPolygon.length < 3) {
            updatePlanner({ roofPolygon, roofPolygonAuto: true });
            return;
        }
        updatePlanner({ roofPolygonAuto: false });
    };

    const handleResetPolygon = () =>
        updatePlanner({ roofPolygon: defaultRoofPolygonFromDims(trueX_m, trueY_m), roofPolygonAuto: true });

    const handleAddExclusion = ({ w_m, h_m }) => {
        const w = clamp(Number(w_m) || 0, 0.1, 1000);
        const h = clamp(Number(h_m) || 0, 0.1, 1000);
        const rect = {
            id: `excl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            x: Math.max(0, trueX_m * 0.1),
            y: Math.max(0, trueY_m * 0.1),
            w,
            h,
            label: 'Exclusion',
            color: '#ef4444',
        };
        updatePlanner({ exclusions: [...exclusions, rect] });
        setSelectedExclusionId(rect.id);
    };

    const updateExclusion = (id, patch) => {
        updatePlanner({
            exclusions: exclusions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        });
    };

    const deleteExclusion = (id) => {
        updatePlanner({ exclusions: exclusions.filter((r) => r.id !== id) });
        setSelectedExclusionId((prev) => (prev === id ? null : prev));
    };

    const onPointerDownVertex = (e, idx) => {
        if (!svgRef.current) return;
        if (toolMode !== 'select') return;
        ensurePolygonPersisted();
        const start = toSvgPoint(svgRef.current, e.clientX, e.clientY, bounds);
        dragRef.current = { type: 'vertex', index: idx, start, orig: roofPolygon[idx] };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onPointerDownExclusion = (e, idx) => {
        if (!svgRef.current) return;
        if (toolMode !== 'select') return;
        const start = toSvgPoint(svgRef.current, e.clientX, e.clientY, bounds);
        setSelectedExclusionId(exclusions[idx]?.id || null);
        dragRef.current = { type: 'exclusion-move', index: idx, start, orig: exclusions[idx] };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onPointerDownExclusionHandle = (e, idx, corner) => {
        if (!svgRef.current) return;
        if (toolMode !== 'select') return;
        const start = toSvgPoint(svgRef.current, e.clientX, e.clientY, bounds);
        setSelectedExclusionId(exclusions[idx]?.id || null);
        dragRef.current = { type: 'exclusion-resize', index: idx, corner, start, orig: exclusions[idx] };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onSvgClick = (e) => {
        if (!svgRef.current) return;
        const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY, bounds);
        if (toolMode === 'measure') {
            setMeasure((prev) => {
                if (!prev.a || (prev.a && prev.b)) return { a: pt, b: null };
                return { a: prev.a, b: pt };
            });
            return;
        }
        if (toolMode === 'delete') {
            // Delete a roof vertex (if clicked near), otherwise delete topmost exclusion under cursor.
            ensurePolygonPersisted();
            const vertexTol = 0.18; // meters
            if (roofPolygon.length > 3) {
                let bestIdx = -1;
                let bestDist = Infinity;
                for (let i = 0; i < roofPolygon.length; i++) {
                    const v = roofPolygon[i];
                    const d = Math.hypot(pt.x - v.x, pt.y - v.y);
                    if (d < bestDist) {
                        bestDist = d;
                        bestIdx = i;
                    }
                }
                if (bestIdx >= 0 && bestDist <= vertexTol) {
                    const next = roofPolygon.filter((_, i) => i !== bestIdx);
                    updatePlanner({ roofPolygon: next, roofPolygonAuto: false });
                    return;
                }
            }

            for (let i = exclusions.length - 1; i >= 0; i--) {
                const r = exclusions[i];
                if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
                    deleteExclusion(r.id);
                    return;
                }
            }
            return;
        }
        if (toolMode === 'addCorner') {
            // Insert a new point on the nearest roof edge.
            ensurePolygonPersisted();
            const tol = 0.25; // meters
            const best = hoverEdge && Number.isFinite(hoverEdge.dist) ? hoverEdge : null;
            if (best && best.i >= 0 && best.dist <= tol) {
                const next = [
                    ...roofPolygon.slice(0, best.i + 1),
                    { x: best.x, y: best.y },
                    ...roofPolygon.slice(best.i + 1),
                ];
                updatePlanner({ roofPolygon: next, roofPolygonAuto: false });
                setToolMode('select');
            }
        }
    };

    const onPointerMove = (e) => {
        const drag = dragRef.current;
        if (!svgRef.current) return;
        const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY, bounds);
        setMousePos(pt);
        if (toolMode === 'addCorner') {
            let best = { i: -1, dist: Infinity, x: 0, y: 0 };
            for (let i = 0; i < roofPolygon.length; i++) {
                const a = roofPolygon[i];
                const b = roofPolygon[(i + 1) % roofPolygon.length];
                const proj = pointToSegmentProjection(pt, a, b);
                if (proj.dist < best.dist) best = { i, dist: proj.dist, x: proj.x, y: proj.y };
            }
            setHoverEdge(best.i >= 0 ? best : null);
        } else if (hoverEdge) {
            setHoverEdge(null);
        }
        if (toolMode === 'delete') {
            // Hover highlight: prefer vertex (if within tol), else topmost exclusion.
            const vertexTol = 0.18; // meters
            if (roofPolygon.length > 3) {
                let bestIdx = -1;
                let bestDist = Infinity;
                for (let i = 0; i < roofPolygon.length; i++) {
                    const v = roofPolygon[i];
                    const d = Math.hypot(pt.x - v.x, pt.y - v.y);
                    if (d < bestDist) {
                        bestDist = d;
                        bestIdx = i;
                    }
                }
                if (bestIdx >= 0 && bestDist <= vertexTol) {
                    setHoverDeleteTarget({ type: 'vertex', index: bestIdx });
                } else {
                    let exclIdx = -1;
                    for (let i = exclusions.length - 1; i >= 0; i--) {
                        const r = exclusions[i];
                        if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
                            exclIdx = i;
                            break;
                        }
                    }
                    setHoverDeleteTarget(exclIdx >= 0 ? { type: 'exclusion', index: exclIdx } : null);
                }
            } else {
                let exclIdx = -1;
                for (let i = exclusions.length - 1; i >= 0; i--) {
                    const r = exclusions[i];
                    if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
                        exclIdx = i;
                        break;
                    }
                }
                setHoverDeleteTarget(exclIdx >= 0 ? { type: 'exclusion', index: exclIdx } : null);
            }
        } else if (hoverDeleteTarget) {
            setHoverDeleteTarget(null);
        }
        if (!drag) return;
        const dx = pt.x - drag.start.x;
        const dy = pt.y - drag.start.y;
        if (drag.type === 'vertex') {
            const idx = drag.index;
            let nx = clamp(drag.orig.x + dx, -1000, 1000);
            let ny = clamp(drag.orig.y + dy, -1000, 1000);

            // Snap the moved vertex to make adjacent edges vertical/horizontal.
            // If the new x/y is close to either adjacent vertex x/y, snap to that axis.
            const snapTol = 0.1; // meters
            const prev = roofPolygon[(idx - 1 + roofPolygon.length) % roofPolygon.length];
            const nextV = roofPolygon[(idx + 1) % roofPolygon.length];

            if (Math.abs(nx - prev.x) < snapTol) nx = prev.x;
            if (Math.abs(nx - nextV.x) < snapTol) nx = nextV.x;
            if (Math.abs(ny - prev.y) < snapTol) ny = prev.y;
            if (Math.abs(ny - nextV.y) < snapTol) ny = nextV.y;

            const next = roofPolygon.map((p, i) => (i === idx ? { x: nx, y: ny } : p));
            updatePlanner({ roofPolygon: next, roofPolygonAuto: false });
        } else if (drag.type === 'exclusion-move') {
            const idx = drag.index;
            const orig = drag.orig;
            const next = exclusions.map((r, i) =>
                i === idx
                    ? {
                          ...r,
                          x: clamp(orig.x + dx, -1000, 1000),
                          y: clamp(orig.y + dy, -1000, 1000),
                      }
                    : r
            );
            updatePlanner({ exclusions: next });
        } else if (drag.type === 'exclusion-resize') {
            const idx = drag.index;
            const orig = drag.orig;
            const minSize = 0.1; // m
            const maxSize = 1000;
            const c = drag.corner; // 'nw'|'ne'|'se'|'sw'

            let x = orig.x;
            let y = orig.y;
            let w = orig.w;
            let h = orig.h;

            if (c.includes('e')) w = clamp(orig.w + dx, minSize, maxSize);
            if (c.includes('s')) h = clamp(orig.h + dy, minSize, maxSize);
            if (c.includes('w')) {
                const nx = clamp(orig.x + dx, -1000, orig.x + orig.w - minSize);
                w = clamp(orig.x + orig.w - nx, minSize, maxSize);
                x = nx;
            }
            if (c.includes('n')) {
                const ny = clamp(orig.y + dy, -1000, orig.y + orig.h - minSize);
                h = clamp(orig.y + orig.h - ny, minSize, maxSize);
                y = ny;
            }

            const next = exclusions.map((r, i) => (i === idx ? { ...r, x, y, w, h } : r));
            updatePlanner({ exclusions: next });
        }
    };

    const onPointerUp = () => {
        dragRef.current = null;
    };

    useEffect(() => {
        if (!active) return;
        const onKeyDown = (e) => {
            if (toolMode !== 'select') return;
            if (!selectedExclusionId) return;
            // Don't steal Delete from text inputs
            const tag = e.target?.tagName?.toLowerCase?.();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteExclusion(selectedExclusionId);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, toolMode, selectedExclusionId, exclusions]);

    return (
        <>
            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 w-full">
                        <style>{`
                          .plannerToolbarInput { padding: 0.375rem 0.5rem; font-size: 0.75rem; line-height: 1rem; }
                          .plannerToolbarSelect { padding: 0.375rem 0.5rem; font-size: 0.75rem; line-height: 1rem; }
                        `}</style>
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-0 w-[10.5rem]">
                                <div className="relative" ref={modeHelpRef}>
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                            Mode
                                        </label>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShowModeHelp((s) => !s);
                                            }}
                                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                            aria-label="What do Actual vs Projected mean?"
                                            title="What do Actual vs Projected mean?"
                                        >
                                            <Info size={14} />
                                        </button>
                                    </div>
                                    {showModeHelp && (
                                        <div className="absolute z-30 left-0 top-full mt-1 w-[18rem] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-[11px] text-slate-700">
                                            <div className="whitespace-pre-line leading-4">
                                                {`Actual XY - these are the dimensions of the 2D plane of your roof

Projected XY + Tilt - this is the top down dimensions of your roof in X and Y, as measurable on google maps, plus the degrees slope of your roof, which can be found at solarwizard.org.uk, which are used to calculate your actual roof area`}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <select
                                    className="plannerToolbarSelect w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                                    value={roofInput.mode || 'actual'}
                                    onChange={(e) => updateRoofInput({ mode: e.target.value })}
                                    disabled={!isRoofAuto}
                                >
                                    <option value="actual">Actual X/Y</option>
                                    <option value="projected">Projected X/Y + Tilt</option>
                                </select>
                            </div>

                            {(roofInput.mode || 'actual') === 'actual' ? (
                                <>
                                    <div className="min-w-0 w-[6.5rem]">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                            Roof X (m)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                                            value={roofInput.x_m}
                                            onChange={(e) => updateRoofInput({ x_m: Number(e.target.value) })}
                                            disabled={!isRoofAuto}
                                        />
                                    </div>
                                    <div className="min-w-0 w-[6.5rem]">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                            Roof Y (m)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                                            value={roofInput.y_m}
                                            onChange={(e) => updateRoofInput({ y_m: Number(e.target.value) })}
                                            disabled={!isRoofAuto}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleResetPolygon}
                                        className="h-[2.125rem] w-[2.125rem] inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                                        title="Reset roof polygon"
                                        aria-label="Reset roof polygon"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="min-w-0 w-[7.5rem]">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                            Projected X (m)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                                            value={roofInput.projectedX_m}
                                            onChange={(e) => updateRoofInput({ projectedX_m: Number(e.target.value) })}
                                            disabled={!isRoofAuto}
                                        />
                                    </div>
                                    <div className="min-w-0 w-[7.5rem]">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                            Projected Y (m)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                                            value={roofInput.projectedY_m}
                                            onChange={(e) => updateRoofInput({ projectedY_m: Number(e.target.value) })}
                                            disabled={!isRoofAuto}
                                        />
                                    </div>
                                    <div className="min-w-0 w-[6.5rem]">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                            Tilt (deg)
                                        </label>
                                        <input
                                            type="number"
                                            step="1"
                                            className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                                            value={roofInput.tilt_deg}
                                            onChange={(e) => updateRoofInput({ tilt_deg: Number(e.target.value) })}
                                            disabled={!isRoofAuto}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleResetPolygon}
                                        className="h-[2.125rem] w-[2.125rem] inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                                        title="Reset roof polygon"
                                        aria-label="Reset roof polygon"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <div className="basis-full text-xs text-slate-500 -mt-1">True Y = projectedY / cos(tilt)</div>
                                </>
                            )}

                            <div className="min-w-0 w-[9.5rem]">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                    Edge setback (mm)
                                </label>
                                <input
                                    type="number"
                                    step="10"
                                    className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={planner.spacing?.edge_mm ?? DEFAULT_PLANNER.spacing.edge_mm}
                                    onChange={(e) =>
                                        updatePlanner({
                                            spacing: {
                                                ...(planner.spacing || DEFAULT_PLANNER.spacing),
                                                edge_mm: Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                            <div className="min-w-0 w-[8.5rem]">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                                    Panel gap (mm)
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    className="plannerToolbarInput w-full border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={planner.spacing?.gap_mm ?? DEFAULT_PLANNER.spacing.gap_mm}
                                    onChange={(e) =>
                                        updatePlanner({
                                            spacing: {
                                                ...(planner.spacing || DEFAULT_PLANNER.spacing),
                                                gap_mm: Number(e.target.value) || 0,
                                            },
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[60vh]">
                    <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setToolMode('select');
                                        setMeasure({ a: null, b: null });
                                    }}
                                    className={`px-3 py-2 rounded transition-colors text-sm shadow-sm border ${
                                        toolMode === 'select'
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                    }`}
                                    title="Select/move/resize"
                                >
                                    Select
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setToolMode('addCorner');
                                        setMeasure({ a: null, b: null });
                                    }}
                                    className={`px-3 py-2 rounded transition-colors text-sm shadow-sm border ${
                                        toolMode === 'addCorner'
                                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                    }`}
                                    title="Click a roof edge to add a corner"
                                >
                                    Add Corner
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setToolMode('delete');
                                        setMeasure({ a: null, b: null });
                                    }}
                                    className={`px-3 py-2 rounded transition-colors text-sm shadow-sm border ${
                                        toolMode === 'delete'
                                            ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-300'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                    }`}
                                    title="Delete exclusions/corners"
                                >
                                    Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setToolMode('measure');
                                        setMeasure({ a: null, b: null });
                                    }}
                                    className={`px-3 py-2 rounded transition-colors text-sm shadow-sm border ${
                                        toolMode === 'measure'
                                            ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                    }`}
                                    title="Click two points to measure distance"
                                >
                                    Measure
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAddExclusionModal((p) => ({ ...p, open: true }))}
                                className="px-3 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors text-sm shadow-sm"
                            >
                                Add exclusion
                            </button>
                        </div>

                        <div className="p-3">
                            <svg
                                ref={svgRef}
                                className={`w-full h-[52vh] bg-slate-50 rounded-lg border touch-none ${
                                    isDeleteMode ? 'border-rose-300 ring-2 ring-rose-400' : 'border-slate-200'
                                }`}
                                viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={onPointerUp}
                                onClick={onSvgClick}
                                style={{
                                    cursor: isDeleteMode ? 'not-allowed' : toolMode === 'addCorner' ? 'copy' : 'default',
                                }}
                            >
                                <defs>
                                    <pattern
                                        id="gridMinor"
                                        width={grid.minor}
                                        height={grid.minor}
                                        patternUnits="userSpaceOnUse"
                                    >
                                        <path
                                            d={`M ${grid.minor} 0 L 0 0 0 ${grid.minor}`}
                                            fill="none"
                                            stroke="#94a3b8"
                                            strokeOpacity="0.15"
                                            strokeWidth="0.01"
                                        />
                                    </pattern>
                                    <pattern
                                        id="gridMajor"
                                        width={grid.major}
                                        height={grid.major}
                                        patternUnits="userSpaceOnUse"
                                    >
                                        <rect width={grid.major} height={grid.major} fill="url(#gridMinor)" />
                                        <path
                                            d={`M ${grid.major} 0 L 0 0 0 ${grid.major}`}
                                            fill="none"
                                            stroke="#64748b"
                                            strokeOpacity="0.25"
                                            strokeWidth="0.015"
                                        />
                                    </pattern>
                                    <clipPath id="roofClip">
                                        <polygon points={roofPolygon.map((p) => `${p.x},${p.y}`).join(' ')} />
                                    </clipPath>
                                </defs>

                                <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#gridMajor)" />

                                {edgeSetback_m > 0 && (
                                    <g clipPath="url(#roofClip)">
                                        <polygon
                                            points={roofPolygon.map((p) => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke="#f59e0b"
                                            strokeOpacity="0.25"
                                            strokeWidth={edgeSetback_m * 2}
                                            strokeLinejoin="round"
                                        />
                                    </g>
                                )}

                                <polygon
                                    points={roofPolygon.map((p) => `${p.x},${p.y}`).join(' ')}
                                    fill="#10b98122"
                                    stroke="#059669"
                                    strokeWidth={0.03}
                                />

                                {toolMode === 'addCorner' && hoverEdge?.i >= 0 && (
                                    <g>
                                        <line
                                            x1={roofPolygon[hoverEdge.i].x}
                                            y1={roofPolygon[hoverEdge.i].y}
                                            x2={roofPolygon[(hoverEdge.i + 1) % roofPolygon.length].x}
                                            y2={roofPolygon[(hoverEdge.i + 1) % roofPolygon.length].y}
                                            stroke="#10b981"
                                            strokeWidth={0.06}
                                            strokeOpacity="0.6"
                                        />
                                        <circle cx={hoverEdge.x} cy={hoverEdge.y} r={0.07} fill="#10b981" fillOpacity="0.8" />
                                    </g>
                                )}

                                {toolMode === 'delete' &&
                                    hoverDeleteTarget?.type === 'exclusion' &&
                                    exclusions[hoverDeleteTarget.index] && (
                                        <rect
                                            x={exclusions[hoverDeleteTarget.index].x}
                                            y={exclusions[hoverDeleteTarget.index].y}
                                            width={exclusions[hoverDeleteTarget.index].w}
                                            height={exclusions[hoverDeleteTarget.index].h}
                                            fill="none"
                                            stroke="#ef4444"
                                            strokeWidth={0.06}
                                            strokeOpacity="0.9"
                                        />
                                    )}
                                {toolMode === 'delete' &&
                                    hoverDeleteTarget?.type === 'vertex' &&
                                    roofPolygon[hoverDeleteTarget.index] && (
                                        <circle
                                            cx={roofPolygon[hoverDeleteTarget.index].x}
                                            cy={roofPolygon[hoverDeleteTarget.index].y}
                                            r={0.18}
                                            fill="none"
                                            stroke="#ef4444"
                                            strokeWidth={0.05}
                                            strokeOpacity="0.9"
                                        />
                                    )}

                                {annotations.map((e) => (
                                    <g key={e.i}>
                                        <rect
                                            x={e.mx - 0.35}
                                            y={e.my - 0.18}
                                            width={0.7}
                                            height={0.28}
                                            fill="#ffffff"
                                            opacity="0.8"
                                            rx={0.04}
                                            ry={0.04}
                                        />
                                        <text x={e.mx} y={e.my + 0.02} fontSize={0.18} textAnchor="middle" fill="#0f172a">
                                            {e.len.toFixed(2)}m
                                        </text>
                                    </g>
                                ))}

                                {exclusions.map((r, idx) => (
                                    <g key={r.id}>
                                        <rect
                                            x={r.x}
                                            y={r.y}
                                            width={r.w}
                                            height={r.h}
                                            fill={(r.color || '#ef4444') + '22'}
                                            stroke={r.color || '#ef4444'}
                                            strokeWidth={0.03}
                                            onClick={() => {
                                                if (toolMode === 'select') setSelectedExclusionId(r.id);
                                            }}
                                            onPointerDown={(e) => onPointerDownExclusion(e, idx)}
                                            style={{ cursor: toolMode === 'delete' ? 'not-allowed' : 'grab' }}
                                        />
                                        {selectedExclusionId === r.id && toolMode === 'select' && (
                                            <>
                                                {[
                                                    { corner: 'nw', cx: r.x, cy: r.y, cursor: 'nwse-resize' },
                                                    { corner: 'ne', cx: r.x + r.w, cy: r.y, cursor: 'nesw-resize' },
                                                    { corner: 'se', cx: r.x + r.w, cy: r.y + r.h, cursor: 'nwse-resize' },
                                                    { corner: 'sw', cx: r.x, cy: r.y + r.h, cursor: 'nesw-resize' },
                                                ].map((h) => (
                                                    <rect
                                                        key={h.corner}
                                                        x={h.cx - 0.08}
                                                        y={h.cy - 0.08}
                                                        width={0.16}
                                                        height={0.16}
                                                        fill="#ffffff"
                                                        stroke={r.color || '#ef4444'}
                                                        strokeWidth={0.03}
                                                        onPointerDown={(e) => onPointerDownExclusionHandle(e, idx, h.corner)}
                                                        style={{ cursor: isDeleteMode ? 'not-allowed' : h.cursor }}
                                                    />
                                                ))}
                                            </>
                                        )}
                                        <text x={r.x + 0.05} y={r.y + 0.2} fontSize={0.25} fill={r.color || '#ef4444'}>
                                            {r.label || 'Exclusion'}
                                        </text>
                                    </g>
                                ))}

                                {panelRects.map((r, i) => (
                                    <rect
                                        key={i}
                                        x={r.x}
                                        y={r.y}
                                        width={r.w}
                                        height={r.h}
                                        fill="#3b82f622"
                                        stroke="#2563eb"
                                        strokeWidth={0.02}
                                    />
                                ))}

                                {roofPolygon.map((p, idx) => (
                                    <circle
                                        key={idx}
                                        cx={p.x}
                                        cy={p.y}
                                        r={0.12}
                                        fill="#ffffff"
                                        stroke="#0f172a"
                                        strokeWidth={0.03}
                                        onPointerDown={(e) => onPointerDownVertex(e, idx)}
                                        style={{
                                            cursor: isDeleteMode ? 'not-allowed' : toolMode === 'addCorner' ? 'copy' : 'grab',
                                        }}
                                    />
                                ))}

                                {measure?.a && (
                                    <>
                                        <circle cx={measure.a.x} cy={measure.a.y} r={0.06} fill="#4f46e5" />
                                        {measure.b && (
                                            <>
                                                <circle cx={measure.b.x} cy={measure.b.y} r={0.06} fill="#4f46e5" />
                                                <line
                                                    x1={measure.a.x}
                                                    y1={measure.a.y}
                                                    x2={measure.b.x}
                                                    y2={measure.b.y}
                                                    stroke="#4f46e5"
                                                    strokeWidth={0.03}
                                                />
                                                <rect
                                                    x={(measure.a.x + measure.b.x) / 2 - 0.45}
                                                    y={(measure.a.y + measure.b.y) / 2 - 0.18}
                                                    width={0.9}
                                                    height={0.28}
                                                    fill="#ffffff"
                                                    opacity="0.85"
                                                    rx={0.04}
                                                    ry={0.04}
                                                />
                                                <text
                                                    x={(measure.a.x + measure.b.x) / 2}
                                                    y={(measure.a.y + measure.b.y) / 2 + 0.02}
                                                    fontSize={0.18}
                                                    textAnchor="middle"
                                                    fill="#0f172a"
                                                >
                                                    {Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y).toFixed(2)}m
                                                </text>
                                            </>
                                        )}
                                    </>
                                )}
                            </svg>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                <div>
                                    Tool:{' '}
                                    <span className="font-semibold text-slate-700">
                                        {toolMode === 'select'
                                            ? 'Select'
                                            : toolMode === 'measure'
                                              ? 'Measure'
                                              : toolMode === 'delete'
                                                ? 'Delete'
                                                : 'Add Corner'}
                                    </span>
                                </div>
                                <div>
                                    {mousePos ? (
                                        <>
                                            Cursor: x {mousePos.x.toFixed(2)}m, y {mousePos.y.toFixed(2)}m
                                        </>
                                    ) : (
                                        'Cursor: —'
                                    )}
                                </div>
                            </div>
                            {isDeleteMode && (
                                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-center justify-between gap-2">
                                    <div className="font-semibold">Delete mode</div>
                                    <div className="text-rose-600">
                                        Click an exclusion or corner to delete. Switch back to Select when done.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[60vh]">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <div className="text-sm font-semibold text-slate-800">Options & results</div>
                        </div>

                        <div className="p-4 space-y-4 flex-1 flex flex-col min-h-0">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Orientation
                                </label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                    value={planner.options?.orientation || 'either'}
                                    onChange={(e) =>
                                        updatePlanner({
                                            options: { ...(planner.options || DEFAULT_PLANNER.options), orientation: e.target.value },
                                        })
                                    }
                                >
                                    <option value="landscape">Landscape</option>
                                    <option value="portrait">Portrait</option>
                                    <option value="either">Either (best of one)</option>
                                    <option value="mixed">Mixed</option>
                                </select>
                            </div>

                            {arrayId ? (
                                <label className="flex items-start gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        checked={filterPanelsByController}
                                        onChange={(e) => setFilterPanelsByController(e.target.checked)}
                                    />
                                    <span className="text-sm text-slate-700 leading-snug">
                                        <span className="font-medium text-slate-800">Filter by controller compatibility</span>
                                        <span className="block text-xs text-slate-500 mt-0.5">
                                            Voc, Vmp, and Isc vs the selected controller for this array. The planner ignores array
                                            max panel size and weight so layouts are not cleared when those limits are tight.
                                        </span>
                                    </span>
                                </label>
                            ) : null}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Results</div>
                                    <div className="text-xs text-slate-400">
                                        {results.length ? `${results.length} candidates` : '—'}
                                    </div>
                                </div>
                                <div className="flex items-end gap-4 border-b border-slate-200 pb-0 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setResultsTab('layout')}
                                        className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                                            resultsTab === 'layout'
                                                ? 'text-slate-900 border-slate-900'
                                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                        }`}
                                    >
                                        Layout
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setResultsTab('panels')}
                                        className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                                            resultsTab === 'panels'
                                                ? 'text-slate-900 border-slate-900'
                                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                        }`}
                                    >
                                        Panels
                                    </button>
                                    <div className="ml-auto text-xs text-slate-500 pb-2">
                                        {arrayId
                                            ? `${filteredPanelsForEngine.length} eligible panels`
                                            : `${filteredPanelsForEngine.length} active panels`}
                                    </div>
                                </div>

                                <div className="h-[40vh] min-h-[16rem] max-h-[32rem] overflow-y-auto pr-1">
                                    {results.length === 0 ? (
                                        <div className="text-sm text-slate-500 italic">No computed results yet.</div>
                                    ) : resultsTab === 'panels' ? (
                                        <div className="space-y-2">
                                            {results.slice(0, 10).map((r, idx) => (
                                                <button
                                                    key={r.id || idx}
                                                    type="button"
                                                    onClick={() => applyCandidateToArray(r, idx)}
                                                    className={`w-full text-left p-3 rounded border transition-colors ${
                                                        idx === activeResultIndex
                                                            ? 'border-emerald-300 bg-emerald-50'
                                                            : 'border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-semibold text-slate-800 truncate">
                                                            {r.panelName || r.panelModel || 'Panel'} · {r.orientation}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-900">{r.totalW ?? 0}W</div>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {r.count ?? 0} panels · {r.rows ?? 0}×{r.cols ?? 0} · Util{' '}
                                                        {Math.round((r.utilization ?? 0) * 100)}%
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {layoutGroups.slice(0, 12).map((g) => (
                                                <button
                                                    key={g.key}
                                                    type="button"
                                                    onClick={() => {
                                                        const idx = g.bestResultIndex;
                                                        if (typeof idx === 'number') applyCandidateToArray(results[idx], idx);
                                                    }}
                                                    className={`w-full text-left p-3 rounded border transition-colors ${
                                                        typeof g.bestResultIndex === 'number' && g.bestResultIndex === activeResultIndex
                                                            ? 'border-emerald-300 bg-emerald-50'
                                                            : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-semibold text-slate-800">
                                                            {g.count} panels · {g.rows ?? '?'}×{g.cols ?? '?'} · {g.orientation}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-900">{g.bestTotalW}W</div>
                                                    </div>
                                                    <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                                                        <div>
                                                            Max panel size: {g.maxPanelWmm}×{g.maxPanelHmm}mm
                                                        </div>
                                                        <div>Best panel: {g.bestPanelName}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {exclusions.length > 0 && (
                                <div>
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Exclusions (m)
                                    </div>
                                    <div className="space-y-2">
                                        {exclusions.map((r) => (
                                            <div key={r.id} className="border border-slate-200 rounded-lg p-3">
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <input
                                                        className="flex-1 p-2 border border-slate-300 rounded text-sm"
                                                        value={r.label || ''}
                                                        onChange={(e) => updateExclusion(r.id, { label: e.target.value })}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteExclusion(r.id)}
                                                        className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {['x', 'y', 'w', 'h'].map((k) => (
                                                        <div key={k}>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                                {k}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                className="w-full p-2 border border-slate-300 rounded text-sm"
                                                                value={r[k]}
                                                                onChange={(e) => updateExclusion(r.id, { [k]: Number(e.target.value) })}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={addExclusionModal.open}
                onClose={() => setAddExclusionModal((p) => ({ ...p, open: false }))}
                title="Add exclusion"
                maxWidth="max-w-md"
                zIndex={80}
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setAddExclusionModal((p) => ({ ...p, open: false }))}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                handleAddExclusion({ w_m: addExclusionModal.w_m, h_m: addExclusionModal.h_m });
                                setAddExclusionModal((p) => ({ ...p, open: false }));
                            }}
                            className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 font-medium transition-colors shadow-sm"
                        >
                            Add
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Width (m)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                            value={addExclusionModal.w_m}
                            onChange={(e) => setAddExclusionModal((p) => ({ ...p, w_m: Number(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Height (m)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                            value={addExclusionModal.h_m}
                            onChange={(e) => setAddExclusionModal((p) => ({ ...p, h_m: Number(e.target.value) }))}
                        />
                    </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">Tip: Use the Measure tool to gauge distances, then add an exclusion to match.</div>
            </Modal>
        </>
    );
});

export default ArrayPlanner;

