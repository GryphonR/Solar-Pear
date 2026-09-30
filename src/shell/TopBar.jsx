/**
 * @file TopBar.jsx
 * New shell top bar (roadmap 13.4): project switcher, save state, Library, Learn and the ⋯ menu
 * (backup, restore, reset, methodology, about, and a way back to the classic UI).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Menu, { MenuDivider, MenuHeading, MenuItem, MenuRadioItem } from '../components/ui/Menu';
import { ChevronDown } from '../components/Icons';
import { STORAGE_ERROR_EVENT } from '../hooks/useLocalStorage';

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
                Not saved: this browser's storage is full or blocked.
                <button type="button" onClick={onBackup} className="text-secondary underline-offset-2 hover:underline">
                    Download a backup
                </button>
            </span>
        );
    }
    return (
        <span role="status" className="text-[13px] text-muted">
            Saved on this device
        </span>
    );
}

export default function TopBar({
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

    return (
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-line bg-white pl-4 pr-6 font-plex text-body">
            <div className="flex items-center gap-4">
                <Menu
                    menuLabel="Projects"
                    buttonClassName="flex h-10 items-center gap-2.5 rounded-lg border border-line bg-white px-3 text-sm aria-expanded:border-secondary"
                    label={
                        <>
                            <span className="max-w-[260px] truncate font-semibold">{activeProject.name}</span>
                            <span className="rounded bg-[#EEF0EB] px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-subtle">LOCAL</span>
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

            <div className="flex items-center gap-1">
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
                <Menu
                    menuLabel="More"
                    align="right"
                    ariaLabel="More: backup, restore, reset, about"
                    buttonClassName="flex h-10 w-10 items-center justify-center rounded-lg text-xl leading-none text-body hover:bg-paper"
                    label={<span aria-hidden="true">⋯</span>}
                >
                    {(close) => (
                        <>
                            <MenuItem onSelect={() => { close(); onDownload(); }} hint="all projects">Download a backup</MenuItem>
                            <MenuItem onSelect={() => { close(); fileRef.current?.click(); }}>Restore from a backup…</MenuItem>
                            <MenuDivider />
                            <MenuItem onSelect={() => { close(); navigate('/learn/methodology'); }}>How we check</MenuItem>
                            <MenuItem onSelect={() => { close(); navigate('/about'); }}>About, disclosures and privacy</MenuItem>
                            <MenuItem
                                onSelect={() => {
                                    close();
                                    window.location.assign(`${window.location.pathname}?ui=old`);
                                }}
                                hint="until the new design is finished"
                            >
                                Switch to the classic layout
                            </MenuItem>
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
