/**
 * @file TopBar.jsx
 * Top bar (roadmap 13.4): project switcher, save state, Library, Learn and the ⋯ menu (backup, restore,
 * reset, methodology, about). Below `lg` it opens the navigation drawer; on phones Library and Learn move
 * into the ⋯ menu (13.9).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Menu, { MenuDivider, MenuHeading, MenuItem, MenuRadioItem } from '../components/ui/Menu';
import { ChevronDown } from '../components/Icons';
import { STORAGE_ERROR_EVENT } from '../hooks/useLocalStorage';
import { useIsPhone } from '../hooks/useIsSmallScreen';

const TOP_LINK = 'flex h-10 items-center px-3 text-sm font-medium text-body';

function formatUpdated(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return 'This device';
    return `This device · ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** "Saved on this device", or a warning when the last write failed (storage full or blocked). */
function SaveState({ onBackup }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const onError = () => setFailed(true);
        window.addEventListener(STORAGE_ERROR_EVENT, onError);
        return () => window.removeEventListener(STORAGE_ERROR_EVENT, onError);
    }, []);
    if (failed) {
        return (
            <span role="status" className="flex items-center gap-2 text-[13px] font-semibold text-status-warning-fg">
                <span className="hidden md:inline">Not saved: this browser's storage is full or blocked.</span>
                <span className="md:hidden">Not saved</span>
                <button type="button" onClick={onBackup} className="text-secondary underline-offset-2 hover:underline">
                    Download a backup
                </button>
            </span>
        );
    }
    return (
        <span role="status" className="hidden text-[13px] text-muted md:inline">
            Saved on this device
        </span>
    );
}

export default function TopBar({
    onOpenNav,
    navOpen,
    route,
    projectsStore,
    activeProject,
    onSwitchProject,
    onNewProject,
    onDuplicateProject,
    onRenameProject,
    onDeleteProject,
    onDownload,
    onUpload,
    onReset,
}) {
    const fileRef = useRef(null);
    const navigate = useNavigate();
    const inLibrary = route.view === 'library';
    const inLearn = route.view === 'learn';
    const phone = useIsPhone();

    return (
        <header className="flex h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-line bg-white pl-2 pr-2 font-plex text-body sm:pl-4 sm:pr-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                {onOpenNav ? (
                    <button
                        type="button"
                        onClick={onOpenNav}
                        aria-label="Open navigation"
                        aria-expanded={!!navOpen}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-paper"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <path d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    </button>
                ) : null}
                <Menu
                    menuLabel="Projects"
                    buttonClassName="flex h-10 min-w-0 items-center gap-2.5 rounded-lg border border-line bg-white px-3 text-sm aria-expanded:border-secondary"
                    label={
                        <>
                            <span className="max-w-[140px] truncate font-semibold sm:max-w-[260px]">{activeProject.name}</span>
                            <span className="hidden rounded bg-[#EEF0EB] px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-subtle sm:inline">LOCAL</span>
                            <ChevronDown size={14} className="text-muted" />
                        </>
                    }
                >
                    {(close) => (
                        <>
                            <MenuHeading>Projects</MenuHeading>
                            {projectsStore.projects.map((p) => (
                                <MenuRadioItem
                                    key={p.id}
                                    checked={p.id === activeProject.id}
                                    onSelect={() => {
                                        close();
                                        if (p.id !== activeProject.id) onSwitchProject(p.id);
                                    }}
                                >
                                    <span className="flex flex-1 flex-col">
                                        <span className={`text-sm ${p.id === activeProject.id ? 'font-semibold' : 'font-medium'}`}>{p.name}</span>
                                        <span className="text-xs text-muted">{formatUpdated(p.updatedAt)}</span>
                                    </span>
                                    <span className="rounded bg-[#EEF0EB] px-1.5 py-0.5 text-[11px] font-semibold text-subtle">LOCAL</span>
                                </MenuRadioItem>
                            ))}
                            <MenuDivider />
                            <MenuItem onSelect={() => { close(); onNewProject(); }}>New project</MenuItem>
                            <MenuItem onSelect={() => { close(); onDuplicateProject(); }}>Duplicate this project</MenuItem>
                            <MenuItem onSelect={() => { close(); onRenameProject(); }}>Rename</MenuItem>
                            <MenuDivider />
                            <MenuItem tone="danger" onSelect={() => { close(); onDeleteProject(); }}>Delete project…</MenuItem>
                        </>
                    )}
                </Menu>
                <SaveState onBackup={onDownload} />
            </div>

            <div className="flex shrink-0 items-center gap-1">
                {phone ? null : (
                    <>
                <Link
                    to="/library/panels"
                    aria-current={inLibrary ? 'page' : undefined}
                    className={`${TOP_LINK} ${inLibrary ? 'font-semibold shadow-[inset_0_-2px_0_#FFCC00]' : ''}`}
                >
                    Library
                </Link>
                <Link
                    to="/learn"
                    aria-current={inLearn ? 'page' : undefined}
                    className={`${TOP_LINK} ${inLearn ? 'font-semibold shadow-[inset_0_-2px_0_#FFCC00]' : ''}`}
                >
                    Learn
                </Link>
                        <div className="mx-2 h-6 w-px bg-line" />
                    </>
                )}
                <Menu
                    menuLabel="More"
                    align="right"
                    ariaLabel="More: backup, restore, reset, about"
                    buttonClassName="flex h-10 w-10 items-center justify-center rounded-lg text-xl leading-none text-body hover:bg-paper"
                    label={<span aria-hidden="true">⋯</span>}
                >
                    {(close) => (
                        <>
                            {phone ? (
                                <>
                                    <MenuItem onSelect={() => { close(); navigate('/library/panels'); }}>Library</MenuItem>
                                    <MenuItem onSelect={() => { close(); navigate('/learn'); }}>Learn</MenuItem>
                                    <MenuDivider />
                                </>
                            ) : null}
                            <MenuItem onSelect={() => { close(); onDownload(); }} hint="all projects">Download a backup</MenuItem>
                            <MenuItem onSelect={() => { close(); fileRef.current?.click(); }}>Restore from a backup…</MenuItem>
                            <MenuDivider />
                            <MenuItem onSelect={() => { close(); navigate('/learn/methodology'); }}>How we check</MenuItem>
                            <MenuItem onSelect={() => { close(); navigate('/about'); }}>About, disclosures and privacy</MenuItem>
                            <MenuDivider />
                            <MenuItem tone="danger" onSelect={() => { close(); onReset(); }}>Reset everything…</MenuItem>
                        </>
                    )}
                </Menu>
                <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onUpload} aria-hidden="true" tabIndex={-1} />
            </div>
        </header>
    );
}
