/**
 * @file SystemPage.jsx
 * System page: header, tabs and the tab's content. Overview is the single line diagram and issues (13.7),
 * Setup is 13.5, Controllers is 13.6.
 */

import React from 'react';
import { Link } from 'react-router';
import { StatusPill } from '../../components/ui';
import { buildPath } from '../../lib/routes';
import { Cost, kWp } from './ProjectOverview';
import SystemSetup from './SystemSetup';
import SystemControllers from './SystemControllers';
import SystemOverview from './SystemOverview';

const TABS = [
    ['overview', 'Overview'],
    ['setup', 'Setup'],
    ['controllers', 'Controllers'],
];

export default function SystemPage({ design, system, tab = 'overview', onAddArray, onEditSystem }) {
    const projectId = design.project.id;
    const current = TABS.some(([key]) => key === tab) ? tab : 'overview';

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-[30px] font-semibold leading-9">{system.name}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-subtle">
                        <span>{system.meta}</span>
                        <StatusPill status={system.summary.status}>{system.summary.label}</StatusPill>
                        <button type="button" onClick={() => onEditSystem(system.name)} className="font-semibold text-secondary underline-offset-2 hover:underline">
                            Rename
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

            <div role="tablist" aria-label={`${system.name} sections`} className="flex gap-1 border-b border-line">
                {TABS.map(([key, label]) => (
                    <Link
                        key={key}
                        role="tab"
                        aria-selected={current === key}
                        to={buildPath({ view: 'system', projectId, systemId: system.id, tab: key })}
                        className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${current === key ? 'border-brand text-body' : 'border-transparent text-muted hover:text-body'}`}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            {current === 'setup' ? (
                <SystemSetup design={design} system={system} />
            ) : current === 'controllers' ? (
                <SystemControllers design={design} system={system} />
            ) : (
                <SystemOverview design={design} system={system} onAddArray={onAddArray} />
            )}
        </div>
    );
}
