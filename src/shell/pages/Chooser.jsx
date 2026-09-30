/**
 * @file Chooser.jsx
 * "What are you building?" (roadmap 13.5, delivers 7.1; canvas board "First run"). Shown on first run and
 * for New project. Each tile starts a project with one system set up from a preset; there is no plug-in
 * tile (decision D11).
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import SolarPearLogo from '../../components/SolarPearLogo';
import { PRESETS } from '../../lib/presets';
import { ABOUT_SECTIONS } from '../../lib/siteInfo';

const ICONS = {
    'grid-tied': (
        <>
            <path d="M3 11 12 4l9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M7.5 9.5 12 6l4.5 3.5" />
            <path d="M10 20v-5h4v5" />
        </>
    ),
    hybrid: (
        <>
            <path d="M2 11 10 4.5l8 6.5" />
            <path d="M4 10v10h12V10" />
            <rect x="18" y="12" width="4" height="8" rx="1" />
            <path d="M19.5 11v1M20 15l-1 2h2l-1 2" />
        </>
    ),
    'off-grid': (
        <>
            <path d="M3 12 10 6l7 6" />
            <path d="M5 11v9h10v-9" />
            <path d="M19 20v-6M17 16l2-4 2 4" />
            <path d="M9 20v-4h2v4" />
        </>
    ),
    mobile: (
        <>
            <path d="M2 16V8a2 2 0 0 1 2-2h11l4 4h1a2 2 0 0 1 2 2v4h-2" />
            <path d="M2 16h3M10 16h5" />
            <circle cx="7.5" cy="16.5" r="2" />
            <circle cx="17.5" cy="16.5" r="2" />
            <path d="M5 4h8" />
        </>
    ),
};

export default function Chooser({ firstRun, backTo, onChoose, onSkip }) {
    const [name, setName] = useState('My design');
    const projectName = name.trim() || 'My design';

    return (
        <div className="flex min-h-screen flex-col bg-paper font-plex text-body">
            <header className="flex h-14 flex-shrink-0 items-center justify-between bg-ink px-6">
                <SolarPearLogo className="h-12 w-[120px] text-[#F1F5F9]" />
                <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
                    {backTo ? (
                        <Link to={backTo.to} className="flex h-10 items-center px-3 text-[#E6E9ED]">
                            Back to {backTo.label}
                        </Link>
                    ) : null}
                    <Link to="/library/panels" className="flex h-10 items-center px-3 text-[#E6E9ED]">Library</Link>
                    <Link to="/learn" className="flex h-10 items-center px-3 text-[#E6E9ED]">Learn</Link>
                </nav>
            </header>

            <main className="flex flex-1 flex-col items-center gap-10 px-6 pb-10 pt-16">
                <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-xs font-semibold tracking-[0.12em] text-muted">NEW PROJECT</span>
                    <h1 className="text-[44px] font-semibold leading-[52px] tracking-[-0.02em]">What are you building?</h1>
                    <p className="max-w-[620px] text-[17px] leading-[26px] text-subtle">
                        Pick the closest match. It sets sensible defaults for voltage, temperatures and the products
                        you&apos;ll see. You can change any of them later.
                    </p>
                </div>

                <div className="grid w-full max-w-[1120px] grid-cols-2 gap-5 xl:grid-cols-4">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => onChoose(preset, projectName)}
                            className="flex min-h-[250px] flex-col gap-3.5 rounded-xl border border-line bg-white px-5 py-[22px] text-left text-body hover:border-ink hover:shadow-[0_6px_18px_rgba(20,24,31,0.08)]"
                        >
                            <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#FFF6CC]" aria-hidden="true">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14181F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    {ICONS[preset.id]}
                                </svg>
                            </span>
                            <span className="text-[17px] font-semibold">{preset.title}</span>
                            <span className="text-sm leading-[21px] text-subtle">{preset.text}</span>
                            <span className="mt-auto font-plex-mono text-xs text-muted">{preset.tag}</span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                    <label className="flex items-center gap-2.5">
                        <span className="text-subtle">Project name</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={80}
                            className="h-10 w-[220px] rounded-lg border border-line-strong bg-white px-3 text-sm"
                        />
                    </label>
                    <span className="h-6 w-px bg-line" aria-hidden="true" />
                    <button type="button" onClick={() => onSkip(projectName)} className="font-semibold text-secondary hover:underline">
                        {firstRun ? 'Skip, start with a blank system' : 'Start with a blank system'}
                    </button>
                </div>

                <p className="mt-auto max-w-[720px] text-center text-xs text-muted">
                    No account needed. Your design is saved in this browser. Solar Pear checks component
                    compatibility; it isn&apos;t an installation design.{' '}
                    <Link to={`/about#${ABOUT_SECTIONS.disclaimer}`} className="text-subtle underline">Disclaimer</Link>
                    {' · '}
                    <Link to={`/about#${ABOUT_SECTIONS.privacy}`} className="text-subtle underline">Privacy</Link>
                </p>
            </main>
        </div>
    );
}
