/**
 * @file ShellSidebar.jsx
 * New shell sidebar (roadmap 13.4): Project overview, the Systems tree with status and per-array progress
 * dots, Summary and BoM, and the legal links. Every entry is a real link, so it can be opened in a new tab.
 */

import React from 'react';
import { Link } from 'react-router';
import SolarPearLogo from '../components/SolarPearLogo';
import { StatusIcon } from '../components/ui';
import { LayoutDashboard, Plus, Pencil } from '../components/Icons';
import { buildPath } from '../lib/routes';
import { ABOUT_SECTIONS } from '../lib/siteInfo';

/** Status text colours on the dark sidebar (canvas "Main" board). */
const ON_DARK = {
    error: 'text-[#F4A29A]',
    warning: 'text-[#F5C36B]',
    valid: 'text-[#7CC79F]',
    unset: 'text-[#A7AFBA]',
    info: 'text-[#A7AFBA]',
};

const ACTIVE = 'bg-[#232A35] text-white shadow-[inset_3px_0_0_#FFCC00]';
const IDLE = 'text-[#C9CED6] hover:bg-[#1C222B] hover:text-white';

function ProgressDots({ progress, status }) {
    const slots = [
        ['Layout', progress.layout],
        ['panel', progress.panel],
        ['controller', progress.controller],
    ];
    const todo = slots.filter(([, done]) => !done).map(([name]) => name.toLowerCase());
    let label = todo.length === 0 ? 'Layout, panel and controller done' : `To do: ${todo.join(', ')}`;
    if (status === 'error' || status === 'warning') label += `; ${status === 'error' ? 'has an error' : 'has a warning'}`;
    return (
        <span role="img" aria-label={label} className="flex items-center gap-[3px]">
            {slots.map(([name, done], i) => {
                const last = i === slots.length - 1;
                if (last && done && (status === 'error' || status === 'warning')) {
                    return (
                        <span key={name} className={ON_DARK[status]}>
                            <StatusIcon status={status} size={11} />
                        </span>
                    );
                }
                return done ? (
                    <span key={name} className="h-[7px] w-[7px] rounded-full bg-[#7CC79F]" />
                ) : (
                    <span key={name} className="box-border h-[7px] w-[7px] rounded-full border-[1.5px] border-[#6C7582]" />
                );
            })}
        </span>
    );
}

export default function ShellSidebar({ route, design, onAddSystem, onEditSystem, onAddArray, onEditArray, onClose }) {
    const projectId = design.project.id;
    const openSystemId = route.view === 'system' || route.view === 'array' ? route.systemId : null;
    // In the drawer (touch screens, no hover) the edit pencils are always shown.
    const touchVisible = onClose ? 'opacity-100' : 'opacity-0';

    return (
        <nav aria-label="Project" className="flex w-[272px] max-w-full flex-shrink-0 flex-col bg-ink font-plex text-[#C9CED6]">
            <div className="relative flex h-20 flex-shrink-0 items-center justify-center border-b border-[#262C36] px-5">
                <Link to={buildPath({ view: 'project', projectId })} aria-label="Solar Pear, project overview">
                    <SolarPearLogo className="h-12 w-[120px] text-[#F1F5F9]" />
                </Link>
                {onClose ? (
                    <button type="button" onClick={onClose} aria-label="Close navigation" className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-md text-xl text-[#C9CED6] hover:bg-[#1C222B] hover:text-white">
                        ×
                    </button>
                ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
                <Link
                    to={buildPath({ view: 'project', projectId })}
                    aria-current={route.view === 'project' ? 'page' : undefined}
                    className={`flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm ${route.view === 'project' ? `${ACTIVE} font-semibold` : IDLE}`}
                >
                    <LayoutDashboard size={16} />
                    Project overview
                </Link>

                <div className="px-2.5 pb-1.5 pt-[18px] text-[11px] font-semibold tracking-[0.1em] text-[#8A93A0]">SYSTEMS</div>

                {design.systems.map((system) => {
                    const open = system.id === openSystemId;
                    const current = open && route.view === 'system';
                    return (
                        <div key={system.id} className="group/system mt-1 flex flex-col first-of-type:mt-0">
                            <div className="relative">
                                <Link
                                    to={buildPath({ view: 'system', projectId, systemId: system.id })}
                                    aria-current={current ? 'page' : undefined}
                                    className={`flex flex-col gap-0.5 rounded-md px-2.5 py-2 pr-9 ${current ? ACTIVE : open ? 'bg-[#1C222B] text-white' : IDLE}`}
                                >
                                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[#E6E9ED]">
                                        <span className="truncate">{system.name}</span>
                                        <span className={`flex flex-shrink-0 items-center gap-1 text-[11px] font-medium ${ON_DARK[system.summary.status]}`}>
                                            <StatusIcon status={system.summary.status} size={11} />
                                            {system.summary.label}
                                        </span>
                                    </span>
                                    <span className="truncate text-xs text-[#A7AFBA]">{system.meta}</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => onEditSystem(system.name)}
                                    aria-label={`Rename or delete system ${system.name}`}
                                    className={`absolute right-1.5 top-2 rounded p-1 text-[#8A93A0] hover:bg-[#2C3440] hover:text-white focus:opacity-100 group-hover/system:opacity-100 ${touchVisible}`}
                                >
                                    <Pencil size={12} />
                                </button>
                            </div>

                            {open ? (
                                <div className="ml-[18px] flex flex-col gap-px border-l border-[#2C3440] py-1 pl-[18px]">
                                    {system.arrays.map((array) => {
                                        const active = route.view === 'array' && route.arrayId === array.id;
                                        return (
                                            <div
                                                key={array.id}
                                                className={`group/array flex h-8 items-center rounded-md ${active ? `${ACTIVE} font-semibold` : IDLE}`}
                                            >
                                                <Link
                                                    to={buildPath({ view: 'array', projectId, systemId: system.id, arrayId: array.id, tab: 'overview' })}
                                                    aria-current={active ? 'page' : undefined}
                                                    className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 rounded-md pl-2 text-[13px]"
                                                >
                                                    <span className="truncate">{array.name}</span>
                                                    <ProgressDots progress={array.progress} status={array.status} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => onEditArray(array.id)}
                                                    aria-label={`Edit array ${array.name}`}
                                                    className={`mx-1 rounded p-1 text-[#8A93A0] hover:text-white focus:opacity-100 group-hover/array:opacity-100 ${touchVisible}`}
                                                >
                                                    <Pencil size={11} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => onAddArray(system.name)}
                                        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-left text-[13px] font-medium text-brand hover:bg-[#1C222B]"
                                    >
                                        <Plus size={14} />
                                        Add array
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={onAddSystem}
                    className="mt-1.5 flex h-10 items-center gap-2 rounded-md border border-dashed border-[#3A4350] px-2.5 text-[13px] font-medium text-brand hover:bg-[#1C222B]"
                >
                    <Plus size={14} />
                    Add system
                </button>

                <div className="mb-2.5 mt-4 h-px bg-[#262C36]" />
                <Link
                    to={buildPath({ view: 'summary', projectId })}
                    aria-current={route.view === 'summary' ? 'page' : undefined}
                    className={`flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm ${route.view === 'summary' ? `${ACTIVE} font-semibold` : IDLE}`}
                >
                    Summary and bill of materials
                </Link>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[#262C36] px-[22px] pb-[18px] pt-3.5 text-xs text-[#8A93A0]">
                <span>Beta</span>
                <Link to={`/about#${ABOUT_SECTIONS.disclaimer}`} className="text-[#A7AFBA] hover:text-white">Disclaimer</Link>
                <Link to={`/about#${ABOUT_SECTIONS.affiliates}`} className="text-[#A7AFBA] hover:text-white">Affiliate disclosure</Link>
                <Link to={`/about#${ABOUT_SECTIONS.privacy}`} className="text-[#A7AFBA] hover:text-white">Privacy</Link>
            </div>
        </nav>
    );
}
