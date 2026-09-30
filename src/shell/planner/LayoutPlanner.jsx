/**
 * @file LayoutPlanner.jsx
 * The array's Layout tab in the new shell (roadmap 13.8, canvas boards "Layout planner", "PlannerStart"
 * and "PlannerPhone"): a roof inspector, the drawing and the layouts that fit. Choosing a layout only
 * previews it: the panel on the right says exactly what would change (analysed by the engine through
 * `analyzeArrayWith`), and nothing in the design changes until "Use this layout".
 *
 * The roof drawing itself (outline, obstacles, clearances) is saved on the array as you work, like the
 * rest of the design; it doesn't affect any check.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { computePlannerLayouts, dropSmallestPanelsByFootprint } from '../../lib/plannerEngine';
import {
    bestParallelStringsForController,
    clampParallelStrings,
    conditionsFromAreaSettings,
    formatWiringLabel,
    getEffectiveMaxPanelWeightKg,
    isCompatibleFormat,
    isMicroinverter,
    panelMeetsWeightCap,
} from '../../lib/arrayAnalysis';
import { computeTrueDimsM } from './plannerGeometry';
import { getAssignedControllerModel } from './plannerSelectors';
import {
    ASSUMED_PITCH_DEG,
    ROOF_SHAPES,
    estimatedRidge,
    gridLabel,
    groupLayouts,
    knownPitch,
    layoutChangeSummary,
    layoutCostPerKWp,
    layoutPatch,
    roofPolygonFor,
    samePanelArrays,
    slopeLengthFromPlan,
    slotKey,
    withEmptySlots,
} from '../../lib/plannerLayouts';
import { ISSUE_ADVICE } from '../../lib/issueAdvice';
import { formatMoney, knownPrice } from '../../lib/pricing';
import { arrayStatus } from '../../lib/designStatus';
import RoofCanvas, { TOOLS } from './RoofCanvas';
import PlannerStart from './PlannerStart';
import PlannerPhone from './PlannerPhone';
import { useIsSmallScreen } from '../../hooks/useIsSmallScreen';
import { ManualCountForm, NumberField, ShapeIcon, SOLARWIZARD } from './plannerUi';

const PAGE = 8;
const DEFAULTS = {
    roofInput: { mode: 'actual', x_m: 6, y_m: 4, projectedX_m: 6, projectedY_m: 4, tilt_deg: 30 },
    roofShape: 'rectangle',
    roofPolygon: null,
    roofPolygonAuto: true,
    exclusions: [],
    spacing: { edge_mm: 300, gap_mm: 20 },
    options: { orientation: 'either', sort: 'size' },
    emptySlots: {},
    applied: null,
};

/** A saved planner (old or new) with every field the new planner uses. */
export function normalisePlanner(raw) {
    const p = { ...DEFAULTS, ...(raw || {}) };
    const roofInput = { ...DEFAULTS.roofInput, ...(p.roofInput || {}) };
    const { trueX_m, trueY_m } = computeTrueDimsM(roofInput);
    const roofPolygon = Array.isArray(p.roofPolygon) && p.roofPolygon.length >= 3 ? p.roofPolygon : roofPolygonFor('rectangle', trueX_m, trueY_m);
    const orientation = p.options?.orientation === 'mixed' ? 'either' : p.options?.orientation || 'either';
    return {
        roofInput,
        roofShape: raw?.roofShape || (p.roofPolygonAuto === false ? 'draw' : 'rectangle'),
        roofPolygon,
        roofPolygonAuto: p.roofPolygonAuto !== false,
        exclusions: Array.isArray(p.exclusions) ? p.exclusions : [],
        spacing: { ...DEFAULTS.spacing, ...(p.spacing || {}) },
        options: { ...DEFAULTS.options, ...(p.options || {}), orientation },
        emptySlots: p.emptySlots && typeof p.emptySlots === 'object' ? p.emptySlots : {},
        applied: p.applied || null,
        ridge_m: p.ridge_m ?? null,
        layoutOverride: p.layoutOverride || { enabled: false },
    };
}

const kWp = (w) => `${(w / 1000).toFixed(2)} kWp`;
const kWpRange = ([lo, hi]) => (Math.abs(hi - lo) < 5 ? kWp(hi) : `${(lo / 1000).toFixed(2)}–${kWp(hi)}`);
const mm = (n) => Math.round(Number(n)).toLocaleString('en-GB');
const mmRange = (lo, hi) => (lo === hi ? mm(hi) : `${mm(lo)}–${mm(hi)}`);
const shortName = (panel) => panel?.name || panel?.model || '';

function Section({ title, count, children }) {
    return (
        <section className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted">{title}</h2>
                {count != null ? <span className="rounded bg-[#EEF0EB] px-1.5 text-[11px] font-semibold text-subtle">{count}</span> : null}
            </div>
            {children}
        </section>
    );
}

/** A number field that edits a local string and commits on blur or Enter, so typing isn't an undo step per key. */
function CommitField({ value, onCommit, ...props }) {
    const [text, setText] = useState(String(value ?? ''));
    useEffect(() => setText(String(value ?? '')), [value]);
    const commit = () => {
        const n = Number(text);
        if (text !== '' && Number.isFinite(n) && n !== Number(value)) onCommit(n);
        else setText(String(value ?? ''));
    };
    return (
        <span onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}>
            <NumberField {...props} value={text} onChange={setText} onBlur={commit} />
        </span>
    );
}

function RoofInspector({ geo, change, onDrawObstacle, selectedObstacleId, onSelectObstacle }) {
    const input = geo.roofInput;
    const map = input.mode === 'projected';
    const { trueX_m, trueY_m } = computeTrueDimsM(input);
    const regenerate = (nextInput, shape = geo.roofShape) => {
        const dims = computeTrueDimsM(nextInput);
        return shape === 'draw' ? {} : { roofPolygon: roofPolygonFor(shape, dims.trueX_m, dims.trueY_m, geo.ridge_m, knownPitch(nextInput)), roofPolygonAuto: shape === 'rectangle' };
    };
    const setRidge = (ridge_m) => change({ ridge_m, roofShape: 'hipped', roofPolygon: roofPolygonFor('hipped', trueX_m, trueY_m, ridge_m, knownPitch(input)), roofPolygonAuto: false }, { final: true });
    const setInput = (patch) => {
        const next = { ...input, ...patch };
        change({ roofInput: next, ...regenerate(next) }, { final: true });
    };

    return (
        <aside aria-label="Roof" className="flex flex-col gap-5 rounded-[10px] border border-line bg-white px-5 py-[18px]">
            <Section title="ROOF SHAPE">
                <div role="radiogroup" aria-label="Roof shape" className="grid grid-cols-3 gap-1.5">
                    {ROOF_SHAPES.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={geo.roofShape === s.id}
                            onClick={() => change({ roofShape: s.id, ...regenerate(input, s.id) }, { final: true })}
                            className={`flex flex-col items-center gap-1 rounded-md border py-2 text-xs font-medium ${geo.roofShape === s.id ? 'border-secondary bg-select-bg text-body' : 'border-line-strong text-subtle hover:bg-paper'}`}
                        >
                            <ShapeIcon shape={s.id} size={18} />
                            {s.id === 'draw' ? 'Draw' : s.label}
                        </button>
                    ))}
                </div>
                {geo.roofShape === 'draw' ? <p className="text-xs text-muted">Use Corner on the drawing to add or remove corners, and drag them into place.</p> : null}
            </Section>

            <Section title="SIZE">
                <div role="radiogroup" aria-label="How you measured" className="flex rounded-[7px] bg-[#EEF0EB] p-[3px]">
                    {[
                        ['actual', 'On the roof'],
                        ['projected', 'From a map'],
                    ].map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={input.mode === mode}
                            onClick={() => setInput({ mode })}
                            className={`h-7 flex-1 rounded-[5px] text-[13px] ${input.mode === mode ? 'bg-white font-medium shadow-[0_1px_2px_rgba(20,24,31,0.12)]' : 'text-subtle'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {geo.roofShape === 'draw' ? (
                    <p className="font-plex-mono text-xs text-subtle">
                        {trueX_m.toFixed(2)} × {trueY_m.toFixed(2)} m before editing. Drag the corners to change the outline.
                    </p>
                ) : map ? (
                    <div className="grid grid-cols-3 gap-2">
                        <CommitField label="Width" unit="m" value={input.projectedX_m} onCommit={(v) => setInput({ projectedX_m: v })} aria="Roof width in metres" />
                        <CommitField label="Depth" unit="m" value={input.projectedY_m} onCommit={(v) => setInput({ projectedY_m: v })} aria="Roof depth seen from above in metres" />
                        <CommitField label="Pitch" unit="°" value={input.tilt_deg} onCommit={(v) => setInput({ tilt_deg: v })} aria="Roof pitch in degrees" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <CommitField label="Width" unit="m" value={input.x_m} onCommit={(v) => setInput({ x_m: v })} aria="Roof width in metres" />
                        <CommitField label="Along the slope" unit="m" value={input.y_m} onCommit={(v) => setInput({ y_m: v })} aria="Roof length along the slope in metres" />
                    </div>
                )}
                {geo.roofShape === 'hipped' ? (
                    <>
                        <CommitField label="Ridge length" unit="m" value={geo.ridge_m ?? estimatedRidge(trueX_m, trueY_m, knownPitch(input)).toFixed(2)} onCommit={setRidge} aria="Ridge length in metres" />
                        {geo.ridge_m == null ? (
                            <p className="text-xs text-muted">
                                {map ? 'Estimated from the pitch, assuming every face has the same pitch.' : `Estimated for a ${ASSUMED_PITCH_DEG}° pitch. Measure the ridge, or measure from a map with the pitch, for a better fit.`}
                            </p>
                        ) : null}
                    </>
                ) : null}
                <p className="text-xs leading-[18px] text-muted">
                    {map ? `Along the slope: ${slopeLengthFromPlan(input.projectedY_m, input.tilt_deg).toFixed(2)} m. ` : 'Measured from a map? Switch to "From a map" and add the pitch '}
                    {map ? 'Pitch from ' : '(find it on '}
                    <a href={SOLARWIZARD} target="_blank" rel="noopener noreferrer" className="text-secondary underline">
                        SolarWizard
                    </a>
                    {map ? '.' : '); we’ll correct the length.'}
                </p>
            </Section>

            <Section title="CLEARANCES">
                <div className="grid grid-cols-2 gap-2">
                    <CommitField label="Edge setback" unit="m" value={geo.spacing.edge_mm / 1000} onCommit={(v) => change({ spacing: { ...geo.spacing, edge_mm: Math.round(v * 1000) } }, { final: true })} aria="Edge setback in metres" />
                    <CommitField label="Panel gap" unit="mm" value={geo.spacing.gap_mm} onCommit={(v) => change({ spacing: { ...geo.spacing, gap_mm: Math.round(v) } }, { final: true })} aria="Gap between panels in millimetres" />
                </div>
                <p className="text-xs text-muted">Use your mounting kit&apos;s figures. The dashed line on the roof shows the setback.</p>
            </Section>

            <Section title="OBSTACLES" count={geo.exclusions.length}>
                {geo.exclusions.map((r) => (
                    <div key={r.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${r.id === selectedObstacleId ? 'border-secondary bg-select-bg' : 'border-line'}`}>
                        <span className="h-3.5 w-3.5 shrink-0 border border-[#6B4E16] bg-[repeating-linear-gradient(45deg,#D9C9A3_0_2px,#F6F1E6_2px_4px)]" aria-hidden="true" />
                        <button type="button" onClick={() => onSelectObstacle(r.id)} className="flex min-w-0 flex-1 flex-col text-left">
                            <input
                                aria-label="Obstacle name"
                                defaultValue={r.label || 'Obstacle'}
                                onBlur={(e) => e.target.value !== r.label && change({ exclusions: geo.exclusions.map((x) => (x.id === r.id ? { ...x, label: e.target.value || 'Obstacle' } : x)) }, { final: true })}
                                className="w-full truncate bg-transparent text-[13px] font-medium outline-none focus:underline"
                            />
                            <span className="font-plex-mono text-[11px] text-muted">
                                {r.w.toFixed(2)} × {r.h.toFixed(2)} m
                            </span>
                        </button>
                        <button
                            type="button"
                            aria-label={`Delete ${r.label || 'obstacle'}`}
                            onClick={() => change({ exclusions: geo.exclusions.filter((x) => x.id !== r.id) }, { final: true })}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-paper hover:text-status-error-fg"
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button type="button" onClick={onDrawObstacle} className="self-start text-[13px] font-semibold text-secondary hover:underline">
                    + Draw an obstacle on the roof
                </button>
            </Section>
        </aside>
    );
}

export default function LayoutPlanner({ arrayId }) {
    const {
        arraysData,
        panelsData,
        chargersData,
        siteControllers,
        selections,
        getAreaSettings,
        getArrayAnalysis,
        analyzeArrayWith,
        updateArray,
        savePlannerToArray,
        hideHeavyPanels,
        setNotification,
    } = useAppState();
    const array = arraysData.find((a) => a.id === arrayId);
    const small = useIsSmallScreen();
    const [started, setStarted] = useState(() => !!array?.planner);
    const [manual, setManual] = useState(false);
    const [geo, setGeo] = useState(() => normalisePlanner(array?.planner));
    const [history, setHistory] = useState({ past: [], future: [] });
    const [dragging, setDragging] = useState(false);
    const dragStartRef = useRef(null);
    const settledRef = useRef(geo);
    const [tool, setTool] = useState('select');
    const [selectedObstacleId, setSelectedObstacleId] = useState(null);
    const [previewId, setPreviewId] = useState(null);
    const [shown, setShown] = useState(PAGE);
    const lastSaved = useRef(JSON.stringify(array?.planner || null));

    // Reset when another array is opened.
    useEffect(() => {
        const next = normalisePlanner(array?.planner);
        setGeo(next);
        settledRef.current = next;
        setHistory({ past: [], future: [] });
        setStarted(!!array?.planner);
        setManual(false);
        setPreviewId(null);
        lastSaved.current = JSON.stringify(array?.planner || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only on switching arrays
    }, [arrayId]);

    // Moving or adding a corner by hand makes the outline a drawn one; choosing a shape says so itself.
    const drawnShape = (patch) => (patch.roofPolygonAuto === false && !patch.roofShape ? { roofShape: 'draw' } : {});
    const change = (patch, { final }) => {
        if (!final) {
            if (!dragStartRef.current) dragStartRef.current = geo;
            setDragging(true);
            setGeo((g) => ({ ...g, ...patch, ...drawnShape(patch) }));
            return;
        }
        const before = dragStartRef.current || geo;
        dragStartRef.current = null;
        setDragging(false);
        const next = { ...geo, ...patch, ...drawnShape(patch) };
        setGeo(next);
        if (JSON.stringify(before) !== JSON.stringify(next)) setHistory((h) => ({ past: [...h.past.slice(-49), before], future: [] }));
    };
    const undo = () =>
        setHistory((h) => {
            if (!h.past.length) return h;
            const prev = h.past[h.past.length - 1];
            setGeo(prev);
            return { past: h.past.slice(0, -1), future: [geo, ...h.future] };
        });
    const redo = () =>
        setHistory((h) => {
            if (!h.future.length) return h;
            const [next, ...rest] = h.future;
            setGeo(next);
            return { past: [...h.past, geo], future: rest };
        });

    if (!dragging) settledRef.current = geo;
    const settled = dragging ? settledRef.current : geo;

    // Save the drawing on the array (not the layout: that only changes on "Use this layout").
    useEffect(() => {
        if (!started || dragging || !array) return;
        const json = JSON.stringify(geo);
        if (json === lastSaved.current) return;
        lastSaved.current = json;
        savePlannerToArray(arrayId, geo);
    }, [geo, started, dragging, arrayId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard: tool shortcuts, undo/redo and Delete for the selected obstacle.
    useEffect(() => {
        if (!started || small) return undefined;
        const onKey = (e) => {
            const tag = e.target?.tagName?.toLowerCase?.();
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
            if (t) setTool(t.id);
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObstacleId) {
                change({ exclusions: geo.exclusions.filter((x) => x.id !== selectedObstacleId) }, { final: true });
                setSelectedObstacleId(null);
            }
            if (e.key === 'Escape') setTool('select');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const settings = getAreaSettings(array?.area || 'House');
    const conditions = conditionsFromAreaSettings(settings);
    const controller = array ? getAssignedControllerModel(array, arrayId, selections, siteControllers, chargersData) : null;
    const [passOnly, setPassOnly] = useState(true);
    const current = array ? getArrayAnalysis(arrayId) : null;
    const panelByModel = useMemo(() => new Map(panelsData.map((p) => [p.model, p])), [panelsData]);

    const candidatesPanels = useMemo(() => {
        if (!array) return [];
        const maxKg = getEffectiveMaxPanelWeightKg(array, hideHeavyPanels);
        const list = panelsData.filter((p) => p.active !== false && isCompatibleFormat(array, p) && panelMeetsWeightCap(p, maxKg));
        return dropSmallestPanelsByFootprint(list, 3);
    }, [array, panelsData, hideHeavyPanels]);

    const ranked = useMemo(() => {
        if (!started) return [];
        return computePlannerLayouts({
            roofPolygon_m: settled.roofPolygon,
            exclusions_m: settled.exclusions,
            spacing: settled.spacing,
            panelsData: candidatesPanels,
            options: { orientation: settled.options.orientation, topN: 200 },
        }).ranked.filter((r) => r.count > 0);
    }, [started, settled.roofPolygon, settled.exclusions, settled.spacing, settled.options.orientation, candidatesPanels]);

    // Every candidate that passes (both orientations of a panel can give different layouts), then grouped
    // by layout so panels of about the same size don't fill the list with the same grid.
    const candidates = useMemo(() => {
        const out = [];
        for (const r of ranked) {
            const panel = panelByModel.get(r.panelModel);
            const ps = controller && panel ? bestParallelStringsForController(array, panel, r.count, controller, settings.systemVoltage, conditions) : null;
            if (controller && passOnly && ps == null) continue;
            out.push({ ...r, panel, wiring: isMicroinverter(controller) ? null : formatWiringLabel(r.count, ps ?? 1) });
        }
        return out;
    }, [ranked, panelByModel, controller, passOnly, array, settings.systemVoltage, conditions]);
    const groups = useMemo(() => groupLayouts(candidates, geo.options.sort, panelByModel), [candidates, geo.options.sort, panelByModel]);
    const [openGroup, setOpenGroup] = useState(null); // null: follow the preview; undefined: all closed
    const [shownInGroup, setShownInGroup] = useState(PAGE);

    const appliedKeys = useMemo(() => new Set((geo.applied?.rects_m || []).map(slotKey)), [geo.applied]);
    const hasApplied = !!geo.applied && appliedKeys.size > 0;
    // The drawing can change after a layout was applied; say so when the applied panels no longer fit.
    const appliedCandidate = hasApplied ? ranked.find((r) => r.id === geo.applied.id) : null;
    const appliedFits = !hasApplied || (!!appliedCandidate && [...appliedKeys].every((k) => appliedCandidate.rects_m.some((r) => slotKey(r) === k)));
    const effectivePreviewId = previewId ?? (hasApplied ? null : groups[0]?.best.id ?? null);
    const preview = candidates.find((l) => l.id === effectivePreviewId) || ranked.find((l) => l.id === effectivePreviewId) || null;
    const previewGroupKey = groups.find((g) => g.candidates.some((c) => c.id === effectivePreviewId))?.key ?? null;
    const expandedKey = openGroup === undefined ? null : openGroup ?? previewGroupKey;
    const previewPanel = preview ? panelByModel.get(preview.panelModel) : null;
    const trimmed = preview ? withEmptySlots(preview, geo.emptySlots[preview.id] || [], previewPanel) : null;

    const patch = useMemo(
        () => (trimmed && array ? layoutPatch(array, trimmed, previewPanel, { controller, systemVoltage: settings.systemVoltage, conditions }) : null),
        [trimmed, array, previewPanel, controller, settings.systemVoltage, conditions]
    );
    const summary = useMemo(() => (patch && current ? layoutChangeSummary(current, analyzeArrayWith(arrayId, patch)) : null), [patch, current, arrayId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!array) return null;

    const canvasLayout = trimmed
        ? { rects: trimmed.rects_m, emptyRects: trimmed.emptyRects, addedKeys: hasApplied ? new Set(trimmed.rects_m.map(slotKey).filter((k) => !appliedKeys.has(k))) : new Set() }
        : hasApplied
          ? { rects: geo.applied.rects_m, emptyRects: geo.applied.emptyRects || [], addedKeys: new Set() }
          : null;

    const toggleSlot = (key) => {
        const id = preview?.id || (ranked.some((r) => r.id === geo.applied?.id) ? geo.applied.id : null);
        if (!id) return;
        if (!preview) setPreviewId(id);
        const list = new Set(geo.emptySlots[id] || (id === geo.applied?.id ? (geo.applied.emptyRects || []).map(slotKey) : []));
        if (list.has(key)) list.delete(key);
        else list.add(key);
        change({ emptySlots: { ...geo.emptySlots, [id]: [...list] } }, { final: true });
    };

    const apply = () => {
        if (!patch || !trimmed) return;
        const beforeArray = { panel: array.panel, count: array.count, parallelStrings: array.parallelStrings, maxPanelWidth: array.maxPanelWidth, maxPanelHeight: array.maxPanelHeight };
        const beforeApplied = geo.applied;
        const applied = { id: trimmed.id, panelModel: trimmed.panelModel, orientation: trimmed.orientation, rects_m: trimmed.rects_m, emptyRects: trimmed.emptyRects };
        updateArray(arrayId, patch);
        change({ applied }, { final: true });
        setPreviewId(null);
        setNotification(`${array.name}: ${patch.count} × ${shortName(previewPanel)} applied.`, 'success', {
            label: 'Undo',
            onClick: () => {
                updateArray(arrayId, beforeArray);
                setGeo((g) => ({ ...g, applied: beforeApplied }));
            },
        });
    };

    const saveManual = (fields) => {
        updateArray(arrayId, { ...fields, parallelStrings: clampParallelStrings(fields.count, array.parallelStrings || 1) });
        setManual(false);
        setNotification(`${array.name}: panel count set to ${fields.count}.`, 'success');
    };

    const currentStatus = arrayStatus(current);
    const currentIssue = (current?.issues || []).find((i) => i.severity === 'error' || i.severity === 'warning');

    const manualCard = (
        <section className="mx-auto flex w-full max-w-[520px] flex-col gap-4 rounded-[10px] border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">How many panels?</h2>
            <ManualCountForm array={array} onSave={saveManual} onCancel={() => setManual(false)} />
        </section>
    );

    // Phones get the drawing view only (canvas board "PlannerPhone").
    if (small) return manual ? manualCard : <PlannerPhone array={array} geo={geo} started={started} onManual={() => setManual(true)} />;

    if (!started) {
        return manual ? (
            manualCard
        ) : (
            <PlannerStart
                arrayName={array.name}
                onSkip={() => setManual(true)}
                onStart={(planner) => {
                    const next = normalisePlanner(planner);
                    setGeo(next);
                    setStarted(true);
                }}
            />
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
            <RoofInspector geo={geo} change={change} onDrawObstacle={() => setTool('obstacle')} selectedObstacleId={selectedObstacleId} onSelectObstacle={setSelectedObstacleId} />

            <section aria-label="Roof drawing" className="relative flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-line bg-[#ECEEE8]">
                <div className="flex items-start justify-between gap-2 p-3">
                    <div role="toolbar" aria-label="Drawing tools" className="flex gap-0.5 rounded-[10px] border border-line bg-white p-1 shadow-[0_2px_8px_rgba(20,24,31,0.08)]">
                        {TOOLS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                aria-pressed={tool === t.id}
                                title={t.title}
                                onClick={() => setTool(t.id)}
                                className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] ${tool === t.id ? 'bg-ink font-semibold text-white' : 'hover:bg-paper'}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                                    <path d={t.icon} />
                                </svg>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div role="toolbar" aria-label="History" className="flex gap-0.5 rounded-[10px] border border-line bg-white p-1 shadow-[0_2px_8px_rgba(20,24,31,0.08)]">
                        {[
                            ['Undo', undo, !history.past.length, 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3'],
                            ['Redo', redo, !history.future.length, 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3'],
                        ].map(([label, fn, disabled, d]) => (
                            <button key={label} type="button" aria-label={label} title={`${label} (Ctrl+${label === 'Undo' ? 'Z' : 'Y'})`} onClick={fn} disabled={disabled} className="flex h-9 w-9 items-center justify-center rounded-md text-body hover:bg-paper disabled:text-placeholder">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                    <path d={d} />
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="px-3">
                    <RoofCanvas
                        roofPolygon={geo.roofPolygon}
                        exclusions={geo.exclusions}
                        edgeSetback_m={geo.spacing.edge_mm / 1000}
                        tool={tool}
                        onToolDone={() => setTool('select')}
                        onChange={change}
                        layout={canvasLayout}
                        onToggleSlot={toggleSlot}
                        selectedObstacleId={selectedObstacleId}
                        onSelectObstacle={setSelectedObstacleId}
                    />
                </div>
                {!preview && !appliedFits ? (
                    <p role="status" className="mx-3 mt-2 rounded-lg border border-status-warning-edge bg-status-warning-bg px-3.5 py-2.5 text-[13px] text-status-warning-fg">
                        The applied layout ({geo.applied.rects_m.length} panels) no longer fits this roof. Choose a layout and use it to update the array.
                    </p>
                ) : null}
                <p className="mx-3 mt-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[13px] text-[#333A44]">
                    {tool === 'obstacle'
                        ? 'Drag on the roof to mark a roof window, vent or chimney.'
                        : tool === 'corner'
                          ? 'Click an edge to add a corner. Click a red corner to remove it.'
                          : tool === 'measure'
                            ? 'Click two points to measure between them.'
                            : 'Click a panel to leave that slot empty, or click it again to put it back. Drag corners and obstacles to move them.'}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-3 text-xs text-subtle">
                    <span className="flex items-center gap-1.5">
                        <span className="h-4 w-3 bg-[#1F2A3A]" />
                        Panel
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-4 w-3 border-2 border-dashed border-[#B38F00]" />
                        Added in preview
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-4 w-3 border border-dashed border-muted bg-white/40" />
                        Left empty
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 border-t border-dashed border-subtle" />
                        Setback
                    </span>
                </div>
            </section>

            <aside aria-label="Layouts" className="flex flex-col rounded-[10px] border border-line bg-white xl:max-h-[calc(100vh-7rem)] xl:sticky xl:top-4">
                <div className="flex flex-col gap-3 border-b border-line-soft px-5 pt-[18px] pb-3.5">
                    <h2 className="text-[15px] font-semibold">Layouts that fit</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs text-subtle">
                        <label className="flex flex-col gap-1">
                            Orientation
                            <select value={geo.options.orientation} onChange={(e) => change({ options: { ...geo.options, orientation: e.target.value } }, { final: true })} className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px] text-body">
                                <option value="either">Either</option>
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            Sort
                            <select value={geo.options.sort} onChange={(e) => change({ options: { ...geo.options, sort: e.target.value } }, { final: true })} className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px] text-body">
                                <option value="size">Panel size</option>
                                <option value="power">Most power</option>
                                <option value="cost">Lowest £/kWp</option>
                            </select>
                        </label>
                    </div>
                    {controller ? (
                        <label className="flex items-center gap-2 text-[13px]">
                            <input type="checkbox" checked={passOnly} onChange={(e) => setPassOnly(e.target.checked)} />
                            Only layouts that pass on {controller.name}
                            {isMicroinverter(controller) ? '' : ` MPPT ${array.controllerMppt || 1}`}
                        </label>
                    ) : (
                        <p className="text-xs text-muted">No controller yet, so layouts aren&apos;t checked against one.</p>
                    )}
                </div>

                <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Layouts">
                    {groups.slice(0, shown).map((g) => {
                        const open = g.key === expandedKey;
                        const holdsPreview = g.key === previewGroupKey;
                        const grid = gridLabel(g);
                        const label = `${g.count} panels · ${g.orientation}${grid ? ` · ${grid}` : ''}`;
                        const previewed = holdsPreview ? g.candidates.find((c) => c.id === effectivePreviewId) : null;
                        return (
                            <li key={g.key} className="border-b border-line-soft">
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => {
                                        setOpenGroup(open ? undefined : g.key);
                                        setShownInGroup(PAGE);
                                        if (!holdsPreview) setPreviewId(g.best.id);
                                    }}
                                    className={`flex w-full gap-2 px-4 py-3 text-left ${holdsPreview ? 'bg-select-bg shadow-[inset_3px_0_0_#0044CC]' : 'hover:bg-paper'}`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={`mt-1 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}>
                                        <path d="m9 6 6 6-6 6" />
                                    </svg>
                                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                                        <span className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                                            <span className="truncate">{label}</span>
                                            <span className="shrink-0 font-plex-mono text-[13px]">{kWpRange(g.power)}</span>
                                        </span>
                                        <span className="text-xs text-subtle">
                                            Panels {mmRange(g.size.minH, g.size.maxH)} × {mmRange(g.size.minW, g.size.maxW)} mm · {g.candidates.length} {g.candidates.length === 1 ? 'panel fits' : 'panels fit'}
                                            {g.bestCostPerKWp == null ? '' : ` · from ${formatMoney(g.bestCostPerKWp)}/kWp`}
                                        </span>
                                        {previewed ? (
                                            <span className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                                <span className="rounded bg-secondary px-1.5 py-0.5 text-white">Previewing {shortName(previewed.panel)}</span>
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                                {open ? (
                                    <ul aria-label={`Panels for ${label}`} className="flex flex-col border-t border-line-soft bg-paper/60 py-1">
                                        {g.candidates.slice(0, shownInGroup).map((l) => {
                                            const selected = l.id === effectivePreviewId;
                                            const cost = knownPrice(l.panel) == null ? null : knownPrice(l.panel) * l.count;
                                            const perKWp = layoutCostPerKWp(l.panel, l.count);
                                            const same = samePanelArrays(l.panelModel, arraysData, arrayId);
                                            return (
                                                <li key={l.id}>
                                                    <button
                                                        type="button"
                                                        aria-pressed={selected}
                                                        onClick={() => setPreviewId(l.id)}
                                                        className={`flex w-full flex-col gap-0.5 py-2 pr-4 pl-9 text-left ${selected ? 'bg-white font-medium ring-1 ring-inset ring-secondary' : 'hover:bg-white'}`}
                                                    >
                                                        <span className="flex items-baseline justify-between gap-2 text-[13px]">
                                                            <span className="truncate">{shortName(l.panel) || l.panelName}</span>
                                                            <span className="shrink-0 font-plex-mono text-xs">{kWp(l.totalW)}</span>
                                                        </span>
                                                        <span className="text-[11px] text-subtle">
                                                            {mm(l.panel?.height)} × {mm(l.panel?.width)} mm{l.wiring ? ` · ${l.wiring}` : ''} · {cost == null ? 'price unknown' : formatMoney(cost)}
                                                            {perKWp == null ? '' : ` · ${formatMoney(perKWp)}/kWp`}
                                                        </span>
                                                        {same.length ? <span className="self-start rounded bg-status-ok-bg px-1.5 py-0.5 text-[11px] font-semibold text-status-ok-fg">Same panel as {same.join(', ')}</span> : null}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        {g.candidates.length > shownInGroup ? (
                                            <li className="py-1.5 pl-9">
                                                <button type="button" onClick={() => setShownInGroup(g.candidates.length)} className="text-[12px] font-semibold text-secondary hover:underline">
                                                    Show all {g.candidates.length} panels
                                                </button>
                                            </li>
                                        ) : null}
                                    </ul>
                                ) : null}
                            </li>
                        );
                    })}
                    {groups.length === 0 ? (
                        <li className="px-5 py-6 text-sm text-muted">
                            {ranked.length && controller && passOnly
                                ? `No layout passes on ${controller.name}. Untick the filter to see them all.`
                                : 'Nothing fits yet. Check the size and the setback, or remove an obstacle.'}
                        </li>
                    ) : null}
                    {groups.length > shown ? (
                        <li className="px-5 py-3">
                            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="text-[13px] font-semibold text-secondary hover:underline">
                                Show more layouts ({groups.length - shown})
                            </button>
                        </li>
                    ) : null}
                    {current?.panel && array.count > 0 ? (
                        <li>
                            <button
                                type="button"
                                aria-pressed={effectivePreviewId == null}
                                onClick={() => setPreviewId(null)}
                                className={`flex w-full flex-col gap-1 px-5 py-3 text-left ${effectivePreviewId == null ? 'bg-select-bg shadow-[inset_3px_0_0_#0044CC]' : 'hover:bg-paper'}`}
                            >
                                <span className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                                    <span className="truncate">
                                        Applied now: {shortName(current.panel)} × {array.count}
                                    </span>
                                    <span className="shrink-0 font-plex-mono text-[13px]">{kWp(current.peakPower)}</span>
                                </span>
                                <span className="text-xs text-subtle">
                                    {formatWiringLabel(array.count, array.parallelStrings || 1)} ·{' '}
                                    {currentStatus === 'unset' ? 'not checked yet' : currentIssue ? ISSUE_ADVICE[currentIssue.code]?.title.toLowerCase() || currentIssue.code : 'passes every check'}
                                </span>
                            </button>
                        </li>
                    ) : null}
                </ul>

                <div className="flex flex-col gap-3 border-t border-line bg-white px-5 py-4">
                    {manual ? (
                        <ManualCountForm array={array} onSave={saveManual} onCancel={() => setManual(false)} />
                    ) : summary && trimmed ? (
                        <>
                            <span className="text-[11px] font-semibold tracking-[0.1em] text-muted">IF YOU USE THIS LAYOUT</span>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                                <dt className="text-muted">Panels</dt>
                                <dd>
                                    {summary.panels[0]} → <b>{summary.panels[1]}</b>
                                    {trimmed.emptyRects.length ? <span className="text-muted"> ({trimmed.emptyRects.length} left empty)</span> : null}
                                </dd>
                                {array.panel !== trimmed.panelModel ? (
                                    <>
                                        <dt className="text-muted">Panel</dt>
                                        <dd>
                                            {current?.panel ? `${shortName(current.panel)} → ` : ''}
                                            <b>{shortName(previewPanel)}</b>
                                        </dd>
                                    </>
                                ) : null}
                                {!isMicroinverter(controller) ? (
                                    <>
                                        <dt className="text-muted">Wiring</dt>
                                        <dd>
                                            {summary.wiring[0]} → <b>{summary.wiring[1]}</b>
                                        </dd>
                                    </>
                                ) : null}
                                <dt className="text-muted">Power</dt>
                                <dd>
                                    {kWp(summary.peakPower[0])} → <b>{kWp(summary.peakPower[1])}</b>
                                </dd>
                                <dt className="text-muted">Checks</dt>
                                <dd className={summary.added.length ? 'font-semibold text-status-warning-fg' : ''}>{summary.checks}</dd>
                            </dl>
                            <div className="flex gap-2">
                                <button type="button" onClick={apply} disabled={trimmed.count === 0} className="h-10 flex-1 rounded-md bg-brand text-sm font-semibold text-ink disabled:bg-line-soft disabled:text-muted">
                                    Use this layout
                                </button>
                                {current?.panel || array.count > 0 ? (
                                    <button type="button" onClick={() => setPreviewId(null)} className="h-10 rounded-md border border-line-strong bg-white px-3.5 text-sm">
                                        Keep {array.count}
                                    </button>
                                ) : null}
                            </div>
                            <p className="text-xs text-muted">Nothing changes until you choose.</p>
                        </>
                    ) : (
                        <p className="text-[13px] text-subtle">Choose a layout to see what would change.</p>
                    )}
                    {!manual ? (
                        <button type="button" onClick={() => setManual(true)} className="self-start text-[13px] font-semibold text-secondary hover:underline">
                            I know my panel count, skip the planner
                        </button>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}
