/**
 * @file RoofCanvas.jsx
 * The roof drawing in the layout planner (roadmap 13.8, canvas board "Layout planner"). SVG in metres,
 * y down from the ridge. Tools: Select (move corners and obstacles, switch panel slots off and on),
 * Corner (add a corner on an edge, or remove one), Obstacle (drag out a rectangle) and Measure.
 *
 * Geometry changes go to `onChange(patch, { final })`: `final` is false while dragging, so the parent can
 * hold the layout search until the pointer is released and record one undo step per gesture.
 */

import React, { useRef, useState } from 'react';
import { clamp, edgeAnnotations, pointToSegmentProjection, toSvgPoint } from '../../components/planner/domain/plannerGeometry';
import { insetPolygon, slotKey } from '../../lib/plannerLayouts';

export const TOOLS = [
    { id: 'select', label: 'Select', key: 'v', title: 'Select and move (V)', icon: 'M5 3l14 8-6 2-3 6z' },
    { id: 'corner', label: 'Corner', key: 'c', title: 'Add or remove a corner (C)', icon: 'M4 20 12 4l8 16' },
    { id: 'obstacle', label: 'Obstacle', key: 'o', title: 'Draw an obstacle (O)', icon: 'M4 4h16v16H4zM4 12 12 4M4 20 20 4M12 20l8-8' },
    { id: 'measure', label: 'Measure', key: 'm', title: 'Measure (M)', icon: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2' },
];

const PAD = 0.9; // m around the roof for labels
const fmt = (m) => `${m.toFixed(2)} m`;

function isRectangle(poly) {
    if (poly.length !== 4) return false;
    const xs = new Set(poly.map((p) => +p.x.toFixed(4)));
    const ys = new Set(poly.map((p) => +p.y.toFixed(4)));
    return xs.size === 2 && ys.size === 2;
}

export default function RoofCanvas({
    roofPolygon,
    exclusions,
    edgeSetback_m,
    tool,
    onToolDone,
    onChange,
    layout, // { rects, emptyRects, addedKeys: Set } | null
    onToggleSlot,
    selectedObstacleId,
    onSelectObstacle,
    readOnly = false,
    height = 460,
}) {
    const svgRef = useRef(null);
    const dragRef = useRef(null);
    const [draft, setDraft] = useState(null); // obstacle being drawn: { x, y, w, h }
    const [measure, setMeasure] = useState({ a: null, b: null });
    const [hoverEdge, setHoverEdge] = useState(null);

    const xs = [...roofPolygon.map((p) => p.x), ...exclusions.flatMap((r) => [r.x, r.x + r.w])];
    const ys = [...roofPolygon.map((p) => p.y), ...exclusions.flatMap((r) => [r.y, r.y + r.h])];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const view = { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 + 0.5 };
    const px = view.w / 640; // rough metres per screen pixel, for handle and stroke sizes
    const handle = Math.max(0.06, 7 * px);
    const setback = insetPolygon(roofPolygon, edgeSetback_m);
    const rect = isRectangle(roofPolygon);
    const eavesY = maxY;
    const pts = (poly) => poly.map((p) => `${p.x},${p.y}`).join(' ');

    const point = (e) => toSvgPoint(svgRef.current, e.clientX, e.clientY, view);

    const onPointerDown = (e) => {
        if (readOnly || !svgRef.current) return;
        const pt = point(e);
        if (tool === 'obstacle') {
            dragRef.current = { type: 'draw', start: pt };
            setDraft({ x: pt.x, y: pt.y, w: 0, h: 0 });
            e.currentTarget.setPointerCapture?.(e.pointerId);
        }
    };

    const startDrag = (e, drag) => {
        if (readOnly || tool !== 'select') return;
        e.stopPropagation();
        dragRef.current = { ...drag, start: point(e) };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
        if (readOnly || !svgRef.current) return;
        const pt = point(e);
        if (tool === 'corner') {
            let best = null;
            roofPolygon.forEach((a, i) => {
                const proj = pointToSegmentProjection(pt, a, roofPolygon[(i + 1) % roofPolygon.length]);
                if (!best || proj.dist < best.dist) best = { i, ...proj };
            });
            setHoverEdge(best && best.dist < 0.4 ? best : null);
        }
        const drag = dragRef.current;
        if (!drag) return;
        const dx = pt.x - drag.start.x;
        const dy = pt.y - drag.start.y;
        if (drag.type === 'draw') {
            setDraft({ x: Math.min(drag.start.x, pt.x), y: Math.min(drag.start.y, pt.y), w: Math.abs(dx), h: Math.abs(dy) });
        } else if (drag.type === 'vertex') {
            const n = roofPolygon.length;
            const prev = roofPolygon[(drag.index - 1 + n) % n];
            const next = roofPolygon[(drag.index + 1) % n];
            let x = clamp(drag.orig.x + dx, -1000, 1000);
            let y = clamp(drag.orig.y + dy, -1000, 1000);
            // Snap to the neighbours' x or y so edges stay square when meant to.
            for (const v of [prev, next]) {
                if (Math.abs(x - v.x) < 0.1) x = v.x;
                if (Math.abs(y - v.y) < 0.1) y = v.y;
            }
            onChange({ roofPolygon: roofPolygon.map((p, i) => (i === drag.index ? { x, y } : p)), roofPolygonAuto: false }, { final: false });
        } else if (drag.type === 'move') {
            onChange({ exclusions: exclusions.map((r) => (r.id === drag.id ? { ...r, x: drag.orig.x + dx, y: drag.orig.y + dy } : r)) }, { final: false });
        } else if (drag.type === 'resize') {
            onChange({ exclusions: exclusions.map((r) => (r.id === drag.id ? { ...r, w: Math.max(0.1, drag.orig.w + dx), h: Math.max(0.1, drag.orig.h + dy) } : r)) }, { final: false });
        }
    };

    const onPointerUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        if (drag.type === 'draw') {
            const d = draft;
            setDraft(null);
            if (d && d.w >= 0.1 && d.h >= 0.1) {
                const id = `excl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                onChange({ exclusions: [...exclusions, { id, ...d, label: `Obstacle ${exclusions.length + 1}` }] }, { final: true });
                onSelectObstacle?.(id);
                onToolDone?.();
            }
            return;
        }
        onChange({}, { final: true });
    };

    const onClick = (e) => {
        if (readOnly || !svgRef.current) return;
        const pt = point(e);
        if (tool === 'measure') {
            setMeasure((m) => (!m.a || m.b ? { a: pt, b: null } : { a: m.a, b: pt }));
        } else if (tool === 'corner' && hoverEdge) {
            const next = [...roofPolygon.slice(0, hoverEdge.i + 1), { x: hoverEdge.x, y: hoverEdge.y }, ...roofPolygon.slice(hoverEdge.i + 1)];
            onChange({ roofPolygon: next, roofPolygonAuto: false }, { final: true });
        } else if (tool === 'select') {
            onSelectObstacle?.(null);
        }
    };

    const removeCorner = (e, i) => {
        if (tool !== 'corner' || roofPolygon.length <= 3) return;
        e.stopPropagation();
        onChange({ roofPolygon: roofPolygon.filter((_, j) => j !== i), roofPolygonAuto: false }, { final: true });
    };

    const panelCells = (r) => {
        // Cell lines, like the canvas: 3 columns by 6 rows in portrait, swapped in landscape.
        const portrait = r.h >= r.w;
        const cols = portrait ? 3 : 6;
        const rows = portrait ? 6 : 3;
        const lines = [];
        for (let i = 1; i < cols; i++) lines.push(<line key={`c${i}`} x1={r.x + (r.w * i) / cols} y1={r.y} x2={r.x + (r.w * i) / cols} y2={r.y + r.h} />);
        for (let i = 1; i < rows; i++) lines.push(<line key={`r${i}`} x1={r.x} y1={r.y + (r.h * i) / rows} x2={r.x + r.w} y2={r.y + (r.h * i) / rows} />);
        return lines;
    };

    const cursor = readOnly ? 'default' : tool === 'select' ? 'default' : 'crosshair';

    return (
        <svg
            ref={svgRef}
            role={readOnly ? 'img' : 'group'} // an img's children are hidden from screen readers; the slots are buttons
            aria-label={`Roof drawing: ${fmt(maxX - minX)} wide, ${fmt(maxY - minY)} along the slope, ${exclusions.length} obstacle${exclusions.length === 1 ? '' : 's'}${layout ? `, ${layout.rects.length} panel${layout.rects.length === 1 ? '' : 's'}` : ''}`}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            height={height}
            style={{ cursor, touchAction: 'none', display: 'block' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={onClick}
        >
            {/* Dimensions */}
            <line x1={minX} x2={maxX} y1={minY - 0.45} y2={minY - 0.45} stroke="#4A525D" strokeWidth={px} />
            <line x1={minX} x2={minX} y1={minY - 0.55} y2={minY - 0.35} stroke="#4A525D" strokeWidth={px} />
            <line x1={maxX} x2={maxX} y1={minY - 0.55} y2={minY - 0.35} stroke="#4A525D" strokeWidth={px} />
            <text x={(minX + maxX) / 2} y={minY - 0.55} textAnchor="middle" fontSize={13 * px} fontFamily="IBM Plex Mono, monospace" fill="#1D232B">
                {fmt(maxX - minX)}
            </text>
            <text x={(minX + maxX) / 2} y={minY - 0.12} textAnchor="middle" fontSize={11 * px} fontWeight="600" letterSpacing={1.1 * px} fill="#4A525D">
                RIDGE
            </text>

            {/* Roof and setback */}
            <polygon points={pts(roofPolygon)} fill="#E3DCCD" stroke="#5B6470" strokeWidth={2 * px} />
            {edgeSetback_m > 0 ? <polygon points={pts(setback)} fill="none" stroke="#7A7F86" strokeWidth={px} strokeDasharray={`${4 * px} ${3 * px}`} /> : null}
            {!rect
                ? edgeAnnotations(roofPolygon).map((ed) => (
                      <text key={ed.i} x={ed.mx} y={ed.my} dy={ed.my <= minY + 0.01 ? -4 * px : 14 * px} textAnchor="middle" fontSize={11 * px} fontFamily="IBM Plex Mono, monospace" fill="#4A525D">
                          {ed.len.toFixed(2)}
                      </text>
                  ))
                : null}

            {/* Panels: kept, added in the preview, and slots left empty */}
            {layout?.rects.map((r) => {
                const key = slotKey(r);
                const added = layout.addedKeys?.has(key);
                return (
                    <g
                        key={key}
                        role={readOnly ? undefined : 'button'}
                        tabIndex={readOnly ? undefined : 0}
                        aria-label={readOnly ? undefined : `Panel at ${r.x.toFixed(1)}, ${r.y.toFixed(1)} m. Leave this slot empty`}
                        onClick={(e) => {
                            if (readOnly || tool !== 'select') return;
                            e.stopPropagation();
                            onToggleSlot?.(key);
                        }}
                        onKeyDown={(e) => {
                            if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onToggleSlot?.(key);
                            }
                        }}
                        style={{ cursor: readOnly || tool !== 'select' ? undefined : 'pointer' }}
                        className="outline-none focus-visible:[&>rect]:stroke-secondary"
                    >
                        <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={added ? 'rgba(31,42,58,0.28)' : '#1F2A3A'} stroke={added ? '#B38F00' : '#0E141D'} strokeWidth={(added ? 2 : 1) * px} strokeDasharray={added ? `${4 * px} ${3 * px}` : undefined} />
                        {!added ? <g stroke="#34435A" strokeWidth={px}>{panelCells(r)}</g> : null}
                    </g>
                );
            })}
            {layout?.emptyRects?.map((r) => {
                const key = slotKey(r);
                return (
                    <g
                        key={`empty-${key}`}
                        role={readOnly ? undefined : 'button'}
                        tabIndex={readOnly ? undefined : 0}
                        aria-label={readOnly ? undefined : `Empty slot at ${r.x.toFixed(1)}, ${r.y.toFixed(1)} m. Put a panel back`}
                        onClick={(e) => {
                            if (readOnly || tool !== 'select') return;
                            e.stopPropagation();
                            onToggleSlot?.(key);
                        }}
                        onKeyDown={(e) => {
                            if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onToggleSlot?.(key);
                            }
                        }}
                        style={{ cursor: readOnly ? undefined : 'pointer' }}
                    >
                        <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(255,255,255,0.35)" stroke="#5B6470" strokeWidth={px} strokeDasharray={`${3 * px} ${3 * px}`} />
                        <line x1={r.x} y1={r.y} x2={r.x + r.w} y2={r.y + r.h} stroke="#8A919A" strokeWidth={px} />
                    </g>
                );
            })}

            {/* Obstacles */}
            <defs>
                <pattern id="obstacle-hatch" patternUnits="userSpaceOnUse" width={0.16} height={0.16} patternTransform="rotate(45)">
                    <rect width={0.16} height={0.16} fill="#F6F1E6" />
                    <rect width={0.08} height={0.16} fill="#D9C9A3" />
                </pattern>
            </defs>
            {exclusions.map((r) => {
                const selected = r.id === selectedObstacleId;
                return (
                    <g key={r.id}>
                        <rect
                            x={r.x}
                            y={r.y}
                            width={r.w}
                            height={r.h}
                            fill="url(#obstacle-hatch)"
                            stroke="#6B4E16"
                            strokeWidth={2 * px}
                            style={{ cursor: tool === 'select' && !readOnly ? 'move' : undefined }}
                            onPointerDown={(e) => {
                                onSelectObstacle?.(r.id);
                                startDrag(e, { type: 'move', id: r.id, orig: r });
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {selected && !readOnly ? (
                            <>
                                <rect x={r.x - 3 * px} y={r.y - 3 * px} width={r.w + 6 * px} height={r.h + 6 * px} fill="none" stroke="#0044CC" strokeWidth={2 * px} pointerEvents="none" />
                                <rect
                                    x={r.x + r.w - handle / 2}
                                    y={r.y + r.h - handle / 2}
                                    width={handle}
                                    height={handle}
                                    fill="#fff"
                                    stroke="#0044CC"
                                    strokeWidth={2 * px}
                                    style={{ cursor: 'nwse-resize' }}
                                    onPointerDown={(e) => startDrag(e, { type: 'resize', id: r.id, orig: r })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </>
                        ) : null}
                        <text x={r.x + r.w / 2} y={r.y + r.h + 14 * px} textAnchor="middle" fontSize={12 * px} fill="#3D2A00" pointerEvents="none">
                            {r.label || 'Obstacle'}
                        </text>
                    </g>
                );
            })}
            {draft ? <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} fill="rgba(107,78,22,0.15)" stroke="#6B4E16" strokeWidth={2 * px} strokeDasharray={`${4 * px} ${3 * px}`} /> : null}

            {/* Corners */}
            {!readOnly && (tool === 'select' || tool === 'corner')
                ? roofPolygon.map((p, i) => (
                      <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={handle * 0.75}
                          fill="#fff"
                          stroke={tool === 'corner' && roofPolygon.length > 3 ? '#B42318' : '#0044CC'}
                          strokeWidth={2 * px}
                          style={{ cursor: tool === 'select' ? 'grab' : 'pointer' }}
                          onPointerDown={(e) => startDrag(e, { type: 'vertex', index: i, orig: p })}
                          onClick={(e) => removeCorner(e, i)}
                      >
                          <title>{tool === 'corner' ? 'Remove this corner' : 'Drag to move this corner'}</title>
                      </circle>
                  ))
                : null}
            {tool === 'corner' && hoverEdge ? <circle cx={hoverEdge.x} cy={hoverEdge.y} r={handle * 0.6} fill="#0044CC" pointerEvents="none" /> : null}

            {/* Measure */}
            {tool === 'measure' && measure.a ? (
                <g pointerEvents="none">
                    <circle cx={measure.a.x} cy={measure.a.y} r={handle * 0.5} fill="#B42318" />
                    {measure.b ? (
                        <>
                            <line x1={measure.a.x} y1={measure.a.y} x2={measure.b.x} y2={measure.b.y} stroke="#B42318" strokeWidth={2 * px} />
                            <circle cx={measure.b.x} cy={measure.b.y} r={handle * 0.5} fill="#B42318" />
                            <text x={(measure.a.x + measure.b.x) / 2} y={(measure.a.y + measure.b.y) / 2 - 8 * px} textAnchor="middle" fontSize={13 * px} fontFamily="IBM Plex Mono, monospace" fontWeight="600" fill="#B42318">
                                {fmt(Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y))}
                            </text>
                        </>
                    ) : null}
                </g>
            ) : null}

            <text x={minX} y={eavesY + 0.4} fontSize={11 * px} fontWeight="600" letterSpacing={1.1 * px} fill="#4A525D">
                EAVES · {fmt(maxY - minY)} ALONG THE SLOPE
            </text>
            {/* 1 m scale bar */}
            <path d={`M${minX} ${eavesY + 0.62} v${0.08} h1 v-${0.08}`} fill="none" stroke="#4A525D" strokeWidth={1.5 * px} />
            <text x={minX + 1.1} y={eavesY + 0.72} fontSize={11 * px} fill="#4A525D">
                1 m
            </text>
        </svg>
    );
}
