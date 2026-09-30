/**
 * @file SystemPage.jsx
 * System page (roadmap 13.4). For now a header and a card per array; the Setup (13.5), Controllers (13.6)
 * and diagram (13.7) tabs build on it.
 */

import React from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/ui';
import { Plus } from '../../components/Icons';
import { buildPath } from '../../lib/routes';
import { Cost, kWp } from './ProjectOverview';

function slotText(array) {
    const a = array.analysis;
    const panel = a?.panel ? `${a.array.count} × ${a.panel.name || a.panel.model}` : 'No panel yet';
    const controller = a?.controller ? a.controller.name : 'No controller yet';
    return { panel, controller };
}

export default function SystemPage({ design, system, onAddArray, onEditSystem }) {
    const projectId = design.project.id;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-[30px] font-semibold leading-9">{system.name}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-subtle">
                        <span>{system.meta}</span>
                        <StatusPill status={system.summary.status}>{system.summary.label}</StatusPill>
                        <button type="button" onClick={() => onEditSystem(system.name)} className="font-semibold text-secondary underline-offset-2 hover:underline">
                            Rename or delete
                        </button>
                    </div>
                </div>
                <dl className="flex gap-8">
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Peak power</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">{kWp(system.totals.peakPower)}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted">Estimated cost</dt>
                        <dd className="font-plex-mono text-[22px] font-semibold">
                            <Cost totals={system.totals} />
                        </dd>
                    </div>
                </dl>
            </div>

            <section aria-label="Arrays" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {system.arrays.map((array) => {
                    const { panel, controller } = slotText(array);
                    return (
                        <Link
                            key={array.id}
                            to={buildPath({ view: 'array', projectId, systemId: system.id, arrayId: array.id, tab: 'overview' })}
                            className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-white p-[18px] text-body hover:border-line-strong"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-base font-semibold">{array.name}</span>
                                <StatusPill status={array.status}>{array.status === 'unset' ? `${array.progress.done} of 3 done` : undefined}</StatusPill>
                            </span>
                            <span className={`text-[13px] ${array.progress.panel ? 'text-subtle' : 'text-muted'}`}>{panel}</span>
                            <span className={`text-[13px] ${array.progress.controller ? 'text-subtle' : 'text-muted'}`}>{controller}</span>
                            <span className="font-plex-mono text-sm">{kWp(array.analysis?.peakPower || 0)}</span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => onAddArray(system.name)}
                    className="flex min-h-[140px] flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-placeholder p-[18px] text-[15px] font-semibold text-body hover:bg-white"
                >
                    <Plus size={22} />
                    Add an array
                    <span className="max-w-[240px] text-center text-[13px] font-normal text-muted">A roof section or ground frame with one panel type.</span>
                </button>
            </section>
        </div>
    );
}
