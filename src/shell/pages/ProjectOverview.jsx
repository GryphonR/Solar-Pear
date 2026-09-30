/**
 * @file ProjectOverview.jsx
 * Project overview (roadmap 13.4, canvas board "Project Overview"): totals, a card per system, and the
 * list of things still to resolve. Everything is read from the engine's analysis.
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import { StatusIcon, StatusPill } from '../../components/ui';
import { Plus } from '../../components/Icons';
import { buildPath } from '../../lib/routes';
import { formatMoney } from '../../lib/pricing';
import { projectDefaults } from '../../lib/projects';

export const kWp = (watts) => `${(watts / 1000).toFixed(2)} kWp`;

/** Cost with an "incomplete" marker when some prices are unknown. */
export function Cost({ totals, className = '' }) {
    return (
        <span className={className}>
            {formatMoney(totals.cost, '£0.00')}
            {totals.costIncomplete ? (
                <span className="ml-1.5 font-plex text-xs font-medium text-status-warning-fg">incomplete</span>
            ) : null}
        </span>
    );
}

/** Things to resolve: arrays with errors or warnings first, then unfinished arrays. */
function toResolve(design) {
    const rows = [];
    for (const system of design.systems) {
        for (const array of system.arrays) {
            const where = `${system.name} › ${array.name}`;
            const to = buildPath({ view: 'array', projectId: design.project.id, systemId: system.id, arrayId: array.id, tab: 'overview' });
            if (array.status === 'error' || array.status === 'warning') {
                const issue = (array.analysis?.issues || []).find((i) => i.severity === array.status);
                rows.push({ key: array.id, status: array.status, where, text: issue?.message || 'Check the results', action: 'Fix', to, rank: array.status === 'error' ? 0 : 1 });
            } else if (array.status === 'unset') {
                const missing = [!array.progress.panel && 'a panel', !array.progress.controller && 'a controller'].filter(Boolean).join(' and ');
                rows.push({ key: array.id, status: 'unset', where, text: `choose ${missing}`, action: 'Open', to, rank: 2 });
            }
        }
    }
    return rows.sort((a, b) => a.rank - b.rank);
}

/** Project defaults (13.5): design temperatures copied into new systems. Existing systems keep theirs. */
function ProjectDefaults({ project, onSave }) {
    const defaults = projectDefaults(project);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(defaults);
    const valid = Number.isFinite(Number(draft.designLowC)) && Number.isFinite(Number(draft.designHighC)) && draft.designLowC !== '' && draft.designHighC !== '';

    return (
        <section aria-labelledby="project-defaults" className="flex flex-col gap-3 rounded-[10px] border border-line bg-white px-5 py-[18px]">
            <div className="flex items-baseline justify-between">
                <h2 id="project-defaults" className="text-[15px] font-semibold">Project defaults</h2>
                {!editing ? (
                    <button
                        type="button"
                        onClick={() => {
                            setDraft(defaults);
                            setEditing(true);
                        }}
                        className="text-[13px] font-semibold text-secondary hover:underline"
                    >
                        Edit
                    </button>
                ) : null}
            </div>
            {editing ? (
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!valid) return;
                        onSave({ designLowC: Math.round(Number(draft.designLowC)), designHighC: Math.round(Number(draft.designHighC)) });
                        setEditing(false);
                    }}
                >
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {[
                            ['designLowC', 'Design low', -50, 15],
                            ['designHighC', 'Design high (cell)', 30, 95],
                        ].map(([key, label, min, max]) => (
                            <label key={key} className="flex flex-col gap-1">
                                <span className="text-xs text-muted">{label} (°C)</span>
                                <input
                                    type="number"
                                    min={min}
                                    max={max}
                                    value={draft[key]}
                                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                                    className="h-9 rounded-lg border border-line-strong px-2.5 font-plex-mono text-sm"
                                />
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" disabled={!valid} className="h-9 rounded-lg bg-brand px-3 text-sm font-semibold text-ink disabled:opacity-50">
                            Save defaults
                        </button>
                        <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg border border-line-strong px-3 text-sm font-semibold">
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted">Design low</dt>
                        <dd className="font-plex-mono">{defaults.designLowC} °C</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted">Design high (cell)</dt>
                        <dd className="font-plex-mono">{defaults.designHighC} °C</dd>
                    </div>
                </dl>
            )}
            <p className="text-xs leading-[18px] text-muted">Copied into new systems. Each system can override them in its Setup.</p>
        </section>
    );
}

export default function ProjectOverview({ design, onAddSystem, onSaveDefaults }) {
    const { project, systems, projectTotals } = design;
    const arrayCount = systems.reduce((n, s) => n + s.arrays.length, 0);
    const rows = toResolve(design);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-[30px] font-semibold leading-9">{project.name}</h1>
                    <span className="text-[13px] text-muted">
                        {systems.length} {systems.length === 1 ? 'system' : 'systems'} · {arrayCount} {arrayCount === 1 ? 'array' : 'arrays'} · saved on this device
                    </span>
                </div>
                <dl className="flex gap-8">
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Peak power</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">{kWp(projectTotals.peakPower)}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Estimated cost</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">
                            <Cost totals={projectTotals} />
                        </dd>
                    </div>
                </dl>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {systems.map((system) => (
                    <Link
                        key={system.id}
                        to={buildPath({ view: 'system', projectId: project.id, systemId: system.id })}
                        className="flex flex-col gap-3 rounded-[10px] border border-line bg-white p-[18px] text-body hover:border-line-strong"
                    >
                        <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-lg font-semibold">{system.name}</span>
                            <StatusPill status={system.summary.status}>{system.summary.label}</StatusPill>
                        </span>
                        <span className="text-[13px] text-subtle">{system.meta}</span>
                        <span className="flex gap-5 font-plex-mono text-sm">
                            <span>{kWp(system.totals.peakPower)}</span>
                            <Cost totals={system.totals} />
                        </span>
                    </Link>
                ))}
                <button
                    type="button"
                    onClick={onAddSystem}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-placeholder p-[18px] text-[15px] font-semibold text-body hover:bg-white"
                >
                    <Plus size={22} />
                    Add a system
                    <span className="max-w-[260px] text-center text-[13px] font-normal text-muted">
                        A separate installation with its own controllers, like a barn or a second consumer unit.
                    </span>
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section aria-labelledby="to-resolve" className="flex flex-col rounded-[10px] border border-line bg-white px-5 py-[18px] lg:col-span-2">
                <h2 id="to-resolve" className="mb-2 text-[15px] font-semibold">To resolve</h2>
                {rows.length === 0 ? (
                    <p className="border-t border-line-soft pt-3 text-sm text-muted">Nothing to resolve. Every array has a panel and a controller and passes its checks.</p>
                ) : (
                    <ul>
                        {rows.map((row) => (
                            <li key={row.key}>
                                <Link to={row.to} className="flex items-center gap-3 border-t border-line-soft py-3 text-sm text-body">
                                    {row.status === 'unset' ? (
                                        <span className="box-border h-4 w-4 flex-shrink-0 rounded-full border-[1.5px] border-dashed border-[#7A828C]" aria-label="Not set" role="img" />
                                    ) : (
                                        <span className={row.status === 'error' ? 'text-status-error-edge' : 'text-status-warning-fg'} role="img" aria-label={row.status === 'error' ? 'Error' : 'Warning'}>
                                            <StatusIcon status={row.status} size={16} />
                                        </span>
                                    )}
                                    <span className="flex-1">
                                        <b className="font-semibold">{row.where}:</b> {row.text}
                                    </span>
                                    <span className="font-semibold text-secondary">{row.action}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <ProjectDefaults project={project} onSave={onSaveDefaults} />
            </div>
        </div>
    );
}
