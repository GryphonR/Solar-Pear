/**
 * @file AppShell.jsx
 * The new app shell (roadmap 13.4), shown with `?ui=next`: sidebar tree, top bar and the page for the
 * current route. Existing views are mounted inside it (tables as Library, guides as Learn) until later
 * phase 13 tasks replace them.
 */

import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import ShellSidebar from './ShellSidebar';
import TopBar from './TopBar';
import ProjectOverview from './pages/ProjectOverview';
import SystemPage from './pages/SystemPage';
import LearnHome from './pages/LearnHome';
import Chooser from './pages/Chooser';
import { useDesignSummary } from './useDesignSummary';
import AppModals from '../components/AppModals';
import NameDialog from '../components/ui/NameDialog';
import Guide from '../components/Guide';
import SummaryView from '../views/SummaryView';
import PanelsDbView from '../views/PanelsDbView';
import ChargersDbView from '../views/ChargersDbView';
import ArrayPage from './pages/ArrayPage';
import { ControllerUseIn, PanelUseIn } from './UseIn';
import PanelsGuideView from '../views/PanelsGuideView';
import ControllersGuideView from '../views/ControllersGuideView';
import MethodologyView from '../views/MethodologyView';
import AboutView from '../views/AboutView';
import { openAboutSection } from '../components/TrustNotices';
import { buildPath } from '../lib/routes';
import { useDataState, useUiState } from '../context/AppStateContext';
import { useBackupRestore } from '../hooks/useBackupRestore';

function Breadcrumb({ items }) {
    return (
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            {items.map((item, i) => (
                <React.Fragment key={item.label}>
                    {i > 0 ? <span aria-hidden="true">/</span> : null}
                    {item.to ? (
                        <Link to={item.to} className="text-secondary hover:underline">
                            {item.label}
                        </Link>
                    ) : (
                        <span aria-current="page" className="text-body">
                            {item.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

const LIBRARY_TABS = [
    ['panels', 'Panels'],
    ['controllers', 'Controllers'],
];

function LibraryTabs({ section }) {
    return (
        <div role="tablist" aria-label="Library" className="mb-6 flex gap-1 border-b border-line">
            {LIBRARY_TABS.map(([key, label]) => (
                <Link
                    key={key}
                    role="tab"
                    aria-selected={section === key}
                    to={`/library/${key}`}
                    className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${section === key ? 'border-brand text-body' : 'border-transparent text-muted hover:text-body'}`}
                >
                    {label}
                </Link>
            ))}
        </div>
    );
}

function ShellContent({ route, design, setActiveTab, onAddSystem, onAddArray, updateProjectDefaults }) {
    const projectId = design.project.id;
    const projectCrumb = { label: design.project.name, to: buildPath({ view: 'project', projectId }) };
    const learnCrumb = { label: 'Learn', to: '/learn' };
    const system = route.systemId ? design.systems.find((s) => s.id === route.systemId) : null;

    switch (route.view) {
        case 'pending':
            return null;
        case 'home':
            // Returning users open their last project.
            return <Navigate to={buildPath({ view: 'project', projectId })} replace />;
        case 'project':
            return <ProjectOverview design={design} onAddSystem={onAddSystem} onSaveDefaults={updateProjectDefaults} />;
        case 'summary':
            return (
                <>
                    <Breadcrumb items={[projectCrumb, { label: 'Summary and bill of materials' }]} />
                    <SummaryView />
                </>
            );
        case 'system':
            if (!system) return null;
            return (
                <>
                    <Breadcrumb items={[projectCrumb, { label: system.name }]} />
                    <SystemPage design={design} system={system} tab={route.tab} onAddArray={onAddArray} />
                </>
            );
        case 'array': {
            if (!system) return null;
            const array = system.arrays.find((a) => a.id === route.arrayId);
            return (
                <>
                    <Breadcrumb
                        items={[
                            projectCrumb,
                            { label: system.name, to: buildPath({ view: 'system', projectId, systemId: system.id }) },
                            { label: array?.name || 'Array' },
                        ]}
                    />
                    <ArrayPage design={design} system={system} route={route} />
                </>
            );
        }
        case 'library':
            return (
                <>
                    <LibraryTabs section={route.section} />
                    {route.section === 'controllers' ? (
                        <ChargersDbView rowAction={(c) => <ControllerUseIn controller={c} />} />
                    ) : (
                        <PanelsDbView rowAction={(p) => <PanelUseIn panel={p} />} />
                    )}
                </>
            );
        case 'learn': {
            const articles = {
                guide: ['How Solar Pear works', <Guide key="guide" />],
                panels: ['Guide to panels', <PanelsGuideView key="panels" />],
                controllers: ['Guide to controllers', <ControllersGuideView key="controllers" />],
                methodology: [
                    'How we check',
                    <MethodologyView key="methodology" onOpenAbout={(id) => openAboutSection(setActiveTab, id)} />,
                ],
            };
            const article = articles[route.slug];
            if (!article) return <LearnHome />;
            return (
                <>
                    <Breadcrumb items={[learnCrumb, { label: article[0] }]} />
                    {article[1]}
                </>
            );
        }
        case 'about':
            return <AboutView onOpenMethodology={() => setActiveTab('METHODOLOGY')} />;
        default:
            return null;
    }
}

export default function AppShell() {
    const design = useDesignSummary();
    const {
        projectsStore,
        activeProject,
        createProject,
        duplicateProject,
        renameProject,
        switchProject,
        deleteProject,
        startProjectFromPreset,
        updateProjectDefaults,
        arraysData,
        addArrayToSystem,
    } = useDataState();
    const {
        route,
        setActiveTab,
        openAddAreaModal,
        openEditAreaModal,
        openEditArrayModal,
        openConfirm,
        isFirstRun,
        setNotification,
    } = useUiState();
    const { handleDownload, handleUploadClick, handleResetClick } = useBackupRestore();
    const navigate = useNavigate();
    const [nameDialog, setNameDialog] = useState(null); // { mode: 'rename' } | { mode: 'addArray', system, initial }

    const onAddSystem = () => openAddAreaModal('');
    // Adding an array only asks for its name; the system is the one it was added from.
    const onAddArray = (systemName) => {
        const names = new Set(arraysData.filter((a) => a.area === systemName).map((a) => a.name));
        let n = names.size + 1;
        while (names.has(`Array ${n}`)) n += 1;
        setNameDialog({ mode: 'addArray', system: systemName, initial: `Array ${n}` });
    };
    const projectPath = buildPath({ view: 'project', projectId: activeProject.id });

    // First run opens the chooser at /; New project opens it at /new (13.5).
    if (route.view === 'new' || (route.view === 'home' && isFirstRun)) {
        return (
            <>
                <Chooser
                    backTo={isFirstRun ? null : { label: activeProject.name, to: projectPath }}
                    onChoose={startProjectFromPreset}
                    onSkip={(name) => {
                        if (!isFirstRun) {
                            createProject(name);
                            return;
                        }
                        if (name !== activeProject.name) renameProject(activeProject.id, name);
                        navigate(projectPath);
                    }}
                />
                <AppModals systemNoun="System" />
            </>
        );
    }

    return (
        <div className="flex h-screen bg-paper font-plex text-body">
            <ShellSidebar
                route={route}
                design={design}
                onAddSystem={onAddSystem}
                onEditSystem={openEditAreaModal}
                onAddArray={onAddArray}
                onEditArray={openEditArrayModal}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar
                    route={route}
                    projectsStore={projectsStore}
                    activeProject={activeProject}
                    onSwitchProject={switchProject}
                    onNewProject={() => navigate('/new')}
                    onDuplicateProject={() => duplicateProject(activeProject.id)}
                    onRenameProject={() => setNameDialog({ mode: 'rename' })}
                    onDeleteProject={() =>
                        openConfirm(
                            'Delete project',
                            `Delete "${activeProject.name}" and all its systems and arrays from this browser? This can't be undone unless you have a backup.`,
                            () => deleteProject(activeProject.id)
                        )
                    }
                    onDownload={handleDownload}
                    onUpload={handleUploadClick}
                    onReset={handleResetClick}
                />
                <main className="min-h-0 flex-1 overflow-y-auto">
                    <div key={`${route.view}:${route.projectId || ''}:${route.systemId || ''}:${route.arrayId || ''}`} className="mx-auto max-w-7xl px-8 py-7">
                        <ShellContent
                            route={route}
                            design={design}
                            setActiveTab={setActiveTab}
                            onAddSystem={onAddSystem}
                            onAddArray={onAddArray}
                            updateProjectDefaults={updateProjectDefaults}
                        />
                    </div>
                </main>
            </div>

            <AppModals systemNoun="System" />
            <NameDialog
                open={nameDialog?.mode === 'rename'}
                title="Rename project"
                label="Project name"
                initialValue={activeProject.name}
                confirmLabel="Rename"
                onCancel={() => setNameDialog(null)}
                onConfirm={(name) => {
                    renameProject(activeProject.id, name);
                    setNameDialog(null);
                }}
            />
            <NameDialog
                open={nameDialog?.mode === 'addArray'}
                title={`Add an array to ${nameDialog?.system || ''}`}
                label="Array name"
                initialValue={nameDialog?.initial || ''}
                confirmLabel="Add array"
                onCancel={() => setNameDialog(null)}
                onConfirm={(name) => {
                    addArrayToSystem(nameDialog.system, name);
                    setNotification(`${name} added to ${nameDialog.system}.`, 'success');
                    setNameDialog(null);
                }}
            />
        </div>
    );
}
