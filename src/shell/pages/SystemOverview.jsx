/**
 * @file SystemOverview.jsx
 * System Overview tab (roadmap 13.7, canvas board "System Overview"): the single line diagram, its list
 * view and the Issues list. The diagram and the list both render `sldLayout` output, in the same
 * power-flow order, so the list is a true text equivalent. Every figure and status comes from the engine.
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/ui';
import { StatusIcon } from '../../components/ui/StatusPill';
import Menu, { MenuItem } from '../../components/ui/Menu';
import { Plus } from '../../components/Icons';
import { conditionsFromAreaSettings } from '../../lib/arrayAnalysis';
import { buildPath } from '../../lib/routes';
import { unitPorts } from '../../lib/ports';
import { LINK_CODES, sldLayout } from '../../lib/sldLayout';
import { sldToSvg } from '../../lib/sldExport';
import { issueCounts, systemIssues } from '../../lib/systemIssues';
import { useDataState } from '../../context/AppStateContext';

const EDGE = { valid: '#1E6E47', warning: '#B86A00', error: '#B42318', unset: '#A6ADB5', neutral: '#5B6470' };
const NODE_BORDER = { valid: 'border-status-ok-fg', warning: 'border-status-warning-edge', error: 'border-status-error-edge' };
const CHIP_TONE = {
    valid: 'border-[#A9D6BC] bg-white',
    warning: 'border-status-warning-line bg-status-warning-bg',
    error: 'border-status-error-edge bg-status-error-bg',
};
const METRIC_TONE = { warning: 'font-semibold text-status-warning-fg', error: 'font-semibold text-status-error-fg' };
const PLACEHOLDER = 'border-[1.5px] border-dashed border-placeholder bg-placeholder-bg';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmtW = (n) => Math.round(n).toLocaleString('en-GB');
const STATUS_WORD = { valid: 'OK', warning: 'Warning', error: 'Error', unset: 'Not checked' };

function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPng(svg, name) {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => blob && download(name, blob), 'image/png');
    };
    img.src = url;
}

function focusIssue(id) {
    const el = document.getElementById(`issue-${id}`);
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
}

function NodeStatus({ status }) {
    if (status === 'unset') return null;
    const tone = { valid: 'text-status-ok-fg', warning: 'text-status-warning-fg', error: 'text-status-error-fg' }[status];
    return (
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${tone}`}>
            <StatusIcon status={status} size={13} />
            {STATUS_WORD[status]}
        </span>
    );
}

const box = (n) => ({ left: n.x, top: n.y, width: n.w, height: n.h });

function ArrayNode({ n, to }) {
    if (n.placeholder) {
        const next = n.next === 'controller' ? 'Add it to a controller' : 'Configure array';
        return (
            <div style={box(n)} className={`absolute flex flex-col gap-1 rounded-lg px-3.5 py-3 ${PLACEHOLDER}`}>
                <span className="flex items-center justify-between text-sm font-semibold">
                    <span className="truncate">{n.title}</span>
                    <span className="text-[11px] font-medium text-muted">{n.progress?.done ?? 0} of 3 done</span>
                </span>
                <span className="truncate text-xs text-subtle">{n.panel || 'Not checked yet'}</span>
                <Link to={to} className={`text-[13px] font-semibold text-secondary hover:underline ${FOCUS}`}>
                    {next} →
                </Link>
            </div>
        );
    }
    return (
        <Link
            to={to}
            style={box(n)}
            aria-label={`${n.title}: ${STATUS_WORD[n.status]}. ${n.panel}, ${n.wiring}`}
            className={`absolute flex flex-col gap-1 rounded-lg border-[1.5px] bg-white px-3.5 py-3 text-body no-underline hover:shadow-sm ${NODE_BORDER[n.status] || 'border-line-strong'} ${FOCUS}`}
        >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span className="truncate">{n.title}</span>
                <NodeStatus status={n.status} />
            </span>
            <span className="truncate text-xs text-subtle">{n.panel}</span>
            <span className="font-plex-mono text-xs">{n.wiring}</span>
        </Link>
    );
}

function Chip({ edge, issues }) {
    const c = edge.chip;
    const linkIssues = issues.filter((i) => i.arrayId === edge.arrayId && LINK_CODES.includes(i.code));
    return (
        <div className="group absolute" style={{ left: c.x, top: c.y, width: c.w, height: c.h }}>
            <button
                type="button"
                aria-label={c.label}
                onClick={() => linkIssues[0] && focusIssue(linkIssues[0].id)}
                className={`h-full w-full rounded-md border px-2.5 py-[7px] text-left font-plex-mono text-xs leading-4 whitespace-nowrap text-body ${CHIP_TONE[edge.status] || CHIP_TONE.valid} ${FOCUS}`}
            >
                {c.lines.map((line, i) => (
                    <span key={i} className="block overflow-hidden text-ellipsis">
                        {line.map((m, j) => (
                            <React.Fragment key={j}>
                                {j > 0 ? ' · ' : null}
                                <span className={METRIC_TONE[m.status] || ''}>{m.text}</span>
                            </React.Fragment>
                        ))}
                    </span>
                ))}
            </button>
            {linkIssues.length > 0 ? (
                <div
                    role="tooltip"
                    className="pointer-events-none absolute top-full left-0 z-20 mt-1.5 hidden w-80 flex-col gap-2 rounded-lg border border-line bg-white p-3 text-[13px] leading-5 shadow-lg group-focus-within:flex group-hover:flex"
                >
                    {linkIssues.map((i) => (
                        <span key={i.id} className="flex flex-col gap-0.5">
                            <span className="font-semibold">{i.title}</span>
                            <span className="text-subtle">{i.why}</span>
                            <span>
                                <b className="font-semibold">Fix:</b> {i.fix}
                            </span>
                        </span>
                    ))}
                    <span className="text-xs text-muted">Select to open the issue.</span>
                </div>
            ) : null}
        </div>
    );
}

function Placeholder({ n, children, label }) {
    return (
        <div
            tabIndex={0}
            role="group"
            aria-label={label}
            title={n.note}
            style={box(n)}
            className={`absolute flex items-center rounded-md px-3 py-2 text-xs leading-[18px] text-subtle ${n.status === 'warning' ? 'border-[1.5px] border-dashed border-status-warning-edge bg-status-warning-bg' : PLACEHOLDER} ${FOCUS}`}
        >
            {children}
        </div>
    );
}

function AssignSelect({ label, options, onChoose, className = '' }) {
    return (
        <select
            aria-label={label}
            value=""
            onChange={(e) => e.target.value && onChoose(e.target.value)}
            className={`h-8 rounded-md border border-line-strong bg-white px-2 text-xs ${className}`}
        >
            <option value="">{label}…</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

function ControllerNode({ n, to, onToggleMicro }) {
    return (
        <div
            style={box(n)}
            className={`absolute rounded-lg ${n.placeholder ? PLACEHOLDER : `border-[1.5px] bg-white ${n.status === 'warning' ? 'border-status-warning-edge' : 'border-body'}`}`}
        >
            <div className="absolute top-3 right-4 left-4 flex flex-col">
                {n.kicker ? <span className="truncate text-[11px] leading-4 font-semibold tracking-[0.08em] text-muted">{n.kicker}</span> : null}
                <Link to={to} className={`truncate text-sm leading-5 font-semibold text-body hover:underline ${FOCUS}`}>
                    {n.placeholder ? 'No controller yet' : n.title}
                </Link>
                {n.placeholder ? (
                    <Link to={to} className={`mt-1 text-[13px] font-semibold text-secondary hover:underline ${FOCUS}`}>
                        Add a controller →
                    </Link>
                ) : null}
                {n.meter ? (
                    <span className="mt-2.5 flex flex-col gap-1.5">
                        <span className="flex justify-between text-[11px] leading-4 text-muted">
                            <span>{n.meter.basis === 'charge' ? `Charge power at ${n.meter.batteryV} V` : 'DC input'}</span>
                            <span className="font-plex-mono text-body">
                                {fmtW(n.meter.value)} / {fmtW(n.meter.max)} W
                            </span>
                        </span>
                        <span
                            role="meter"
                            aria-label={`${n.title} load`}
                            aria-valuemin={0}
                            aria-valuemax={n.meter.max}
                            aria-valuenow={n.meter.value}
                            aria-valuetext={`${Math.round((n.meter.value / n.meter.max) * 100)}% of the limit${n.meter.value > n.meter.max ? ', over the limit' : ''}`}
                            className="flex h-2 rounded bg-line-soft"
                        >
                            <span
                                className={`h-2 rounded ${n.meter.value > n.meter.max ? 'bg-status-warning-edge' : 'bg-status-ok-fg'}`}
                                style={{ width: `${Math.min(100, Math.round((n.meter.value / n.meter.max) * 100))}%` }}
                            />
                        </span>
                        <span className="text-[11px] leading-4 text-muted">
                            {Math.round((n.meter.value / n.meter.max) * 100)}% of {n.meter.basis === 'charge' ? 'charge limit' : 'max DC power'}
                            {n.status === 'warning' ? ' · over the limit' : ''}
                        </span>
                    </span>
                ) : null}
                {n.micro ? (
                    <span className="mt-2 flex flex-col gap-1.5 text-xs text-subtle">
                        <span>
                            {plural(n.micro.units, 'micro')} · {plural(n.micro.perUnit, 'panel')} each
                        </span>
                        <button
                            type="button"
                            aria-expanded={n.micro.expanded}
                            onClick={onToggleMicro}
                            className={`self-start text-xs font-semibold text-secondary hover:underline ${FOCUS}`}
                        >
                            {n.micro.expanded ? 'Hide units' : 'Show units'}
                        </button>
                        {n.micro.expanded ? (
                            <span className="grid grid-cols-8 gap-1" aria-label={`${n.micro.units} units`}>
                                {Array.from({ length: n.micro.units }, (_, i) => (
                                    <span key={i} className="rounded border border-line-strong py-0.5 text-center font-plex-mono text-[10px]">
                                        {i + 1}
                                    </span>
                                ))}
                            </span>
                        ) : null}
                    </span>
                ) : null}
            </div>
            {n.ports.map((p) => {
                const tone = p.arrayId
                    ? { valid: 'border-[#A9D6BC] bg-status-ok-bg', warning: 'border-status-warning-line bg-status-warning-bg', error: 'border-status-error-edge bg-status-error-bg' }[p.status] || 'border-line-strong bg-white'
                    : 'border-dashed border-placeholder bg-placeholder-bg';
                return (
                    <span
                        key={p.port}
                        style={{ top: p.y - 18 }}
                        className={`absolute -left-px flex h-9 w-[156px] items-center gap-2 rounded-r-md border border-l-0 px-3 text-xs font-medium whitespace-nowrap ${tone}`}
                    >
                        <span className="font-plex-mono font-semibold">MPPT {p.port}</span>
                        <span className="truncate">{p.name || 'free'}</span>
                    </span>
                );
            })}
            {n.spec ? <span className="absolute bottom-3 left-4 font-plex-mono text-[11px] leading-4 whitespace-nowrap text-muted">{n.spec}</span> : null}
        </div>
    );
}

/** The text equivalent of the diagram, in power-flow order. */
function DiagramList({ layout, issues, paths, conditions }) {
    const byId = new Map([...layout.nodes, ...layout.edges].map((x) => [x.id, x]));
    const items = layout.order.map((id) => byId.get(id)).filter(Boolean);
    return (
        <ol aria-label="System in power-flow order" className="flex flex-col divide-y divide-line-soft rounded-lg border border-line">
            {items.map((x) => {
                if (x.chip) {
                    const linkIssues = issues.filter((i) => i.arrayId === x.arrayId && LINK_CODES.includes(i.code));
                    return (
                        <li key={x.id} className="flex flex-col gap-1 px-4 py-2.5 pl-10 text-[13px]">
                            <span className="font-plex-mono">
                                {x.chip.lines.flat().map((m) => m.text).join(' · ')} (at {conditions.coldTempC} °C / {conditions.hotTempC} °C)
                            </span>
                            <span className="text-muted">{x.chip.label}</span>
                            {linkIssues.map((i) => (
                                <span key={i.id}>
                                    <b className="font-semibold">Fix:</b> {i.fix}
                                </span>
                            ))}
                        </li>
                    );
                }
                const line = (title, detail, status, to) => (
                    <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                        <span className="flex min-w-0 flex-col">
                            {to ? (
                                <Link to={to} className="font-semibold text-secondary hover:underline">
                                    {title}
                                </Link>
                            ) : (
                                <span className="font-semibold">{title}</span>
                            )}
                            {detail ? <span className="text-subtle">{detail}</span> : null}
                        </span>
                        <StatusPill status={status}>{status === 'unset' ? (x.placeholder && x.kind !== 'array' ? 'Not specified' : 'Not checked') : undefined}</StatusPill>
                    </li>
                );
                switch (x.kind) {
                    case 'array':
                        return line(x.title, [x.panel, x.wiring].filter(Boolean).join(' · ') || 'Not checked yet', x.status, paths.array(x));
                    case 'protection':
                        return line(x.title, x.subtitle, x.status);
                    case 'controller':
                        return line(
                            x.placeholder ? 'No controller yet' : `${x.kicker ? `${x.kicker} · ` : ''}${x.title}`,
                            [
                                x.meter ? `${fmtW(x.meter.value)} / ${fmtW(x.meter.max)} W` : null,
                                x.ports.length ? `${x.ports.filter((p) => p.arrayId).length} of ${x.ports.length} ports used` : null,
                                x.micro ? `${plural(x.micro.units, 'micro')}` : null,
                            ]
                                .filter(Boolean)
                                .join(' · '),
                            x.status,
                            paths.controllers
                        );
                    case 'freePort':
                    case 'slot':
                    case 'addArray':
                        return line(x.title, null, 'unset');
                    default:
                        return line(x.title, x.subtitle, 'unset');
                }
            })}
        </ol>
    );
}

function IssueCard({ item, paths }) {
    const tone = { error: 'border-status-error-edge', warning: 'border-status-warning-line', info: 'border-line' }[item.severity];
    const word = { error: 'text-status-error-fg', warning: 'text-status-warning-fg', info: 'text-status-info-fg' }[item.severity];
    const arrayTo = item.arrayId ? paths.arrayById(item.arrayId, item.missing === 'layout' || item.missing === 'panel' ? 'layout' : 'overview') : null;
    return (
        <article id={`issue-${item.id}`} tabIndex={-1} className={`flex flex-col gap-2.5 rounded-[10px] border bg-white px-[18px] py-4 ${tone} ${FOCUS}`}>
            <div className="flex items-center gap-2 text-xs text-muted">
                <span className={`flex items-center gap-1 font-semibold ${word}`}>
                    <StatusIcon status={item.severity} size={13} />
                    {item.severity === 'error' ? 'Error' : item.severity === 'warning' ? 'Warning' : 'Info'}
                </span>
                <span>{item.where}</span>
            </div>
            {item.title ? <h3 className="text-base font-semibold">{item.title}</h3> : null}
            <p className="text-sm leading-[21px] text-[#333A44]">
                {item.title ? <b className="font-semibold">Why: </b> : null}
                {item.why}
            </p>
            {item.fields.length ? <p className="font-plex-mono text-xs leading-[18px] text-muted">{item.fields.join(' · ')}</p> : null}
            {item.fix ? (
                <div className="rounded-lg bg-paper px-3 py-2.5 text-sm">
                    <b className="font-semibold">Fix:</b> {item.fix}
                </div>
            ) : null}
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
                {arrayTo ? (
                    <Link to={arrayTo} className="text-secondary hover:underline">
                        {item.missing === 'panel' || item.missing === 'layout' ? 'Configure array' : 'Open the array'}
                    </Link>
                ) : null}
                {item.instanceId || item.needsController ? (
                    <Link to={paths.controllers} className="text-secondary hover:underline">
                        {item.needsController ? 'Add a controller' : 'Controllers'}
                    </Link>
                ) : null}
                {item.code !== 'unset' && item.code !== 'price' ? (
                    <Link to="/learn/methodology" className="font-normal text-muted hover:underline">
                        How we check
                    </Link>
                ) : null}
            </div>
        </article>
    );
}

export default function SystemOverview({ design, system, onAddArray }) {
    const { arraysData, siteControllers, chargersData, getAreaSettings, updateSelection } = useDataState();
    const [view, setView] = useState('diagram');
    const [expanded, setExpanded] = useState(() => new Set());

    const projectId = design.project.id;
    const settings = getAreaSettings(system.name);
    const conditions = conditionsFromAreaSettings(settings);
    const instances = siteControllers.filter((sc) => sc.area === system.name);
    const systemArrays = arraysData.filter((a) => a.area === system.name);
    const units = unitPorts(instances, systemArrays, chargersData);
    const layout = sldLayout({ arrays: system.arrays, units, settings, expanded });
    const issues = systemIssues({ arrays: system.arrays, units });
    const counts = issueCounts(issues);

    const paths = {
        arrayById: (arrayId, tab = 'overview') => buildPath({ view: 'array', projectId, systemId: system.id, arrayId, tab }),
        // An unfinished array opens on its Layout tab, where configuring it starts.
        array: (n) => buildPath({ view: 'array', projectId, systemId: system.id, arrayId: n.arrayId, tab: n.next === 'layout' || n.next === 'panel' ? 'layout' : 'overview' }),
        controllers: buildPath({ view: 'system', projectId, systemId: system.id, tab: 'controllers' }),
        setup: buildPath({ view: 'system', projectId, systemId: system.id, tab: 'setup' }),
    };
    const freeOptions = units.flatMap((u) =>
        u.ports.filter((p) => !p.arrayId).map((p) => ({ value: `${u.instance.id}|${p.port}`, label: `${u.model?.name || u.instance.name} MPPT ${p.port}` }))
    );
    const assign = (arrayId, value) => {
        const [instanceId, port] = value.split('|');
        updateSelection(arrayId, 'controllerInstance', instanceId, Number(port));
    };
    const exportAs = (kind) => {
        const svg = sldToSvg(layout, { title: `${design.project.name} · ${system.name}`, subtitle: `${system.meta} · checked at ${conditions.coldTempC} °C cold / ${conditions.hotTempC} °C cell` });
        const name = `${design.project.name}-${system.name}-diagram`.replace(/[^\w-]+/g, '-');
        if (kind === 'svg') download(`${name}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
        else exportPng(svg, `${name}.png`);
    };

    // "+ Add array" under the last array in the diagram (not part of the drawing, so not exported).
    const arrayNodes = layout.nodes.filter((n) => n.kind === 'array');
    const addMore = arrayNodes.length
        ? { x: arrayNodes[0].x, y: Math.max(...arrayNodes.map((n) => n.y + n.h)) + 16, w: arrayNodes[0].w, h: 40 }
        : null;
    const byId = new Map([...layout.nodes, ...layout.edges].map((x) => [x.id, x]));
    const renderItem = (id) => {
        const x = byId.get(id);
        if (!x) return null;
        if (x.chip) return <Chip key={id} edge={x} issues={issues} />;
        switch (x.kind) {
            case 'array':
                return <ArrayNode key={id} n={x} to={paths.array(x)} />;
            case 'protection':
                return (
                    <Placeholder key={id} n={x} label={`${x.title}: ${x.subtitle}${x.status === 'warning' ? '. Warning' : ''}`}>
                        <span>
                            <b className="text-[13px] font-semibold text-body">{x.title}</b>
                            <br />
                            {x.subtitle}
                        </span>
                    </Placeholder>
                );
            case 'controller':
                return (
                    <ControllerNode
                        key={id}
                        n={x}
                        to={paths.controllers}
                        onToggleMicro={() =>
                            setExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(x.instanceId)) next.delete(x.instanceId);
                                else next.add(x.instanceId);
                                return next;
                            })
                        }
                    />
                );
            case 'freePort':
                return (
                    <div key={id} style={box(x)} className={`absolute flex items-center justify-between gap-2 rounded-md px-2.5 text-xs text-subtle ${PLACEHOLDER}`}>
                        <span className="font-medium">{x.title}</span>
                        {x.waiting.length ? (
                            <AssignSelect
                                label={`Assign to MPPT ${x.port}`}
                                options={x.waiting.map((w) => ({ value: w.id, label: w.name }))}
                                onChoose={(arrayId) => updateSelection(arrayId, 'controllerInstance', x.instanceId, x.port)}
                                className="w-24"
                            />
                        ) : (
                            <span className="text-muted">no array waiting</span>
                        )}
                    </div>
                );
            case 'slot':
                return (
                    <div key={id} style={box(x)} className={`absolute flex items-center justify-between gap-3 rounded-md px-4 text-[13px] text-subtle ${PLACEHOLDER}`}>
                        <span>{x.title}</span>
                        {x.action === 'assign' ? (
                            <AssignSelect label={`Assign ${byId.get(`array:${x.arrayId}`)?.title}`} options={freeOptions} onChoose={(v) => assign(x.arrayId, v)} />
                        ) : (
                            <Link to={paths.controllers} className={`font-semibold whitespace-nowrap text-secondary hover:underline ${FOCUS}`}>
                                Add a controller →
                            </Link>
                        )}
                    </div>
                );
            case 'addArray':
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onAddArray(system.name)}
                        style={box(x)}
                        className={`absolute flex flex-col items-start justify-center gap-1 rounded-lg px-3.5 text-left ${PLACEHOLDER} ${FOCUS}`}
                    >
                        <span className="text-sm font-semibold">{x.title}</span>
                        <span className="text-[13px] font-semibold text-secondary">Add an array →</span>
                    </button>
                );
            case 'output':
            case 'source': {
                const to = x.key === 'battery' || x.key === 'grid' ? paths.setup : null;
                const inner = (
                    <span>
                        <b className="text-[13px] font-semibold text-body">{x.title}</b>
                        <br />
                        {x.subtitle}
                    </span>
                );
                const cls = `absolute flex items-center rounded-md px-3 py-2 text-xs leading-[18px] text-subtle ${x.placeholder ? PLACEHOLDER : 'border-[1.5px] border-muted bg-white'} ${FOCUS}`;
                return to ? (
                    <Link key={id} to={to} style={box(x)} aria-label={`${x.title}: ${x.subtitle}. Edit in setup`} className={`${cls} no-underline hover:shadow-sm`}>
                        {inner}
                    </Link>
                ) : (
                    <div key={id} tabIndex={0} role="group" aria-label={`${x.title}: ${x.subtitle}`} style={box(x)} className={cls}>
                        {inner}
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <section aria-label="Single line diagram" className="flex flex-col rounded-[10px] border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
                    <div className="flex items-center gap-4">
                        <h2 className="text-[15px] font-semibold">Single line diagram</h2>
                        <div role="group" aria-label="View" className="flex rounded-[7px] bg-[#EEF0EB] p-[3px]">
                            {[
                                ['diagram', 'Diagram'],
                                ['list', 'List'],
                            ].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={view === key}
                                    onClick={() => setView(key)}
                                    className={`h-7 rounded-[5px] px-3 text-[13px] ${view === key ? 'bg-white font-medium shadow-[0_1px_2px_rgba(20,24,31,0.12)]' : 'text-subtle'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="font-plex-mono">
                            Checked at {conditions.coldTempC} °C cold · {conditions.hotTempC} °C cell
                        </span>
                        <button
                            type="button"
                            onClick={() => onAddArray(system.name)}
                            className="flex h-8 items-center gap-1 rounded-md border border-line px-3 text-[13px] text-body hover:bg-paper"
                        >
                            <Plus size={14} /> Add array
                        </button>
                        <Menu label="Export" menuLabel="Export diagram" align="right" buttonClassName="h-8 rounded-md border border-line bg-white px-3 text-[13px] text-body hover:bg-paper">
                            {(close) => (
                                <>
                                    <MenuItem onSelect={() => { close(); exportAs('svg'); }}>Download SVG</MenuItem>
                                    <MenuItem onSelect={() => { close(); exportAs('png'); }}>Download PNG</MenuItem>
                                </>
                            )}
                        </Menu>
                    </div>
                </div>

                <div className="flex flex-col gap-4 px-6 pt-6 pb-5">
                    {view === 'diagram' ? (
                        <div className="overflow-x-auto pb-2">
                            <div style={{ width: layout.width }} className="flex text-[11px] font-semibold tracking-[0.1em] text-muted">
                                {layout.columns.map((col) => (
                                    <span key={col.id} style={{ width: col.width }}>
                                        {col.label}
                                    </span>
                                ))}
                            </div>
                            <div data-testid="sld" className="relative mt-4" style={{ width: layout.width, height: addMore ? addMore.y + addMore.h : layout.height }}>
                                <svg aria-hidden="true" width={layout.width} height={layout.height} className="absolute inset-0 overflow-visible">
                                    <defs>
                                        {Object.entries(EDGE).map(([k, c]) => (
                                            <marker key={k} id={`sld-arrow-${k}`} orient="auto" markerWidth="5" markerHeight="5" refX="3.2" refY="2" overflow="visible">
                                                <path d="M0 0 L4 2 L0 4 Z" fill={c} />
                                            </marker>
                                        ))}
                                    </defs>
                                    {layout.edges.map((e) => {
                                        const [[x1, y1], [x2, y2]] = e.points;
                                        return (
                                            <line
                                                key={e.id}
                                                x1={x1}
                                                y1={y1}
                                                x2={x2 - (e.arrow ? 3 : 0)}
                                                y2={y2}
                                                stroke={EDGE[e.status] || EDGE.neutral}
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeDasharray={e.dashed ? '6 6' : undefined}
                                                markerEnd={e.arrow ? `url(#sld-arrow-${e.status in EDGE ? e.status : 'neutral'})` : undefined}
                                            />
                                        );
                                    })}
                                </svg>
                                {layout.order.map(renderItem)}
                                {addMore ? (
                                    <button
                                        type="button"
                                        onClick={() => onAddArray(system.name)}
                                        style={box(addMore)}
                                        className={`absolute flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-secondary hover:bg-paper ${PLACEHOLDER} ${FOCUS}`}
                                    >
                                        <Plus size={14} /> Add array
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <DiagramList layout={layout} issues={issues} paths={paths} conditions={conditions} />
                    )}
                    <div className="flex flex-wrap gap-x-5 gap-y-2.5 border-t border-line-soft pt-3.5 text-xs text-subtle">
                        {[
                            ['valid', 'OK'],
                            ['warning', 'Warning'],
                            ['error', 'Error'],
                        ].map(([k, label]) => (
                            <span key={k} className="flex items-center gap-1.5">
                                <span className="w-[18px] border-t-2" style={{ borderColor: EDGE[k] }} />
                                {label}
                            </span>
                        ))}
                        <span className="flex items-center gap-1.5">
                            <span className="h-3 w-[18px] rounded-[3px] border-[1.5px] border-dashed border-placeholder" />
                            Not specified, not checked
                        </span>
                        <span className="ml-auto">Select any part to edit it. Tab moves through the diagram in power-flow order.</span>
                    </div>
                </div>
            </section>

            <section aria-label="Issues" className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                    <h2 className="text-[15px] font-semibold">Issues</h2>
                    <div className="flex gap-2 text-xs font-semibold">
                        <span className={`flex items-center gap-1 rounded px-2 py-[3px] ${counts.error ? 'bg-status-error-bg text-status-error-fg' : 'bg-[#EEF0EB] text-subtle'}`}>
                            {counts.error ? <StatusIcon status="error" size={12} /> : null}
                            {plural(counts.error, 'error')}
                        </span>
                        <span className={`flex items-center gap-1 rounded px-2 py-[3px] ${counts.warning ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-[#EEF0EB] text-subtle'}`}>
                            {counts.warning ? <StatusIcon status="warning" size={12} /> : null}
                            {plural(counts.warning, 'warning')}
                        </span>
                        <span className="flex items-center gap-1 rounded bg-status-info-bg px-2 py-[3px] text-status-info-fg">
                            <StatusIcon status="info" size={12} />
                            {counts.info} info
                        </span>
                    </div>
                </div>
                {issues.length === 0 ? (
                    <p className="rounded-[10px] border border-line bg-white px-[18px] py-4 text-sm text-subtle">
                        {system.arrays.length ? 'No issues: every check passed.' : 'Nothing to check yet. Add an array to start.'}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {issues.map((item) => (
                            <IssueCard key={item.id} item={item} paths={paths} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
