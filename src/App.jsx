/**
 * @file App.jsx
 * Root: the small-screen gate, the classic UI, or (with `?ui=next`, roadmap 13.4) the new shell.
 */

import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import Guide from './components/Guide';
import AppSidebar from './components/AppSidebar';
import AppModals from './components/AppModals';
import SmallScreenGate from './components/SmallScreenGate';
import SummaryView from './views/SummaryView';
import PanelsDbView from './views/PanelsDbView';
import ChargersDbView from './views/ChargersDbView';
import ArraySelectorView from './views/ArraySelectorView';
import PanelsGuideView from './views/PanelsGuideView';
import ControllersGuideView from './views/ControllersGuideView';
import MethodologyView from './views/MethodologyView';
import AboutView from './views/AboutView';
import AppShell from './shell/AppShell';
import { openAboutSection } from './components/TrustNotices';
import { ABOUT_SECTIONS, ABOUT_TAB, METHODOLOGY_TAB, OPERATOR_NAME } from './lib/siteInfo';
import { getUiMode } from './lib/uiFlag';
import { useDataState, useUiState } from './context/AppStateContext';
import { useBackupRestore } from './hooks/useBackupRestore';
import { useIsSmallScreen } from './hooks/useIsSmallScreen';

export default function App() {
    const isSmallScreen = useIsSmallScreen();
    // Read once per load: `?ui=next` / `?ui=old` switch the shell and are remembered (src/lib/uiFlag.js).
    const uiMode = useMemo(() => getUiMode(), []);

    // Scroll to an in-page section (e.g. /about#privacy) once the page has mounted.
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (!hash || typeof document === 'undefined') return;
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.({ block: 'start' });
    }, [pathname, hash]);

    if (isSmallScreen) return <SmallScreenGate />;
    return uiMode === 'next' ? <AppShell /> : <ClassicApp />;
}

/** The current UI: sidebar of areas and arrays, and one view at a time. */
function ClassicApp() {
    const { arraysData, areasData, getArrayAnalysis } = useDataState();
    const { activeTab, setActiveTab, openAddAreaModal, openAddArrayModal, openEditAreaModal, openEditArrayModal } =
        useUiState();
    const { handleDownload, handleUploadClick, handleResetClick } = useBackupRestore();
    const openAbout = (sectionId) => openAboutSection(setActiveTab, sectionId);

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
            <AppSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                arraysData={arraysData}
                areasData={areasData}
                getArrayAnalysis={getArrayAnalysis}
                onDownload={handleDownload}
                onUpload={handleUploadClick}
                onReset={handleResetClick}
                onAddArea={() => openAddAreaModal('')}
                onAddArray={(areaName) => openAddArrayModal({ area: areaName })}
                onEditArea={openEditAreaModal}
                onEditArray={openEditArrayModal}
            />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-8 relative min-h-full flex flex-col">
                    <div className="flex-1 min-h-0">
                        <div key={activeTab} className="animate-in fade-in duration-150">
                            {activeTab === ABOUT_TAB ? (
                                <AboutView onOpenMethodology={() => setActiveTab(METHODOLOGY_TAB)} />
                            ) : activeTab === METHODOLOGY_TAB ? (
                                <MethodologyView onOpenAbout={openAbout} />
                            ) : activeTab === 'GUIDE' ? (
                                <Guide />
                            ) : activeTab === 'GUIDE_PANELS' ? (
                                <PanelsGuideView />
                            ) : activeTab === 'GUIDE_CONTROLLERS' ? (
                                <ControllersGuideView />
                            ) : activeTab === 'SUMMARY' ? (
                                <SummaryView />
                            ) : activeTab === 'DB_PANELS' ? (
                                <PanelsDbView />
                            ) : activeTab === 'DB_CHARGERS' ? (
                                <ChargersDbView />
                            ) : (
                                <ArraySelectorView arrayId={activeTab} />
                            )}
                        </div>
                    </div>

                    <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs pb-4 space-y-2">
                        <p className="max-w-2xl mx-auto leading-relaxed">
                            Solar Pear checks component compatibility; it is not an installation design. Always
                            follow the manufacturers’ datasheets and BS 7671. Some buy links are affiliate links.
                        </p>
                        <nav aria-label="About and legal" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                            {[
                                ['Methodology', () => setActiveTab(METHODOLOGY_TAB)],
                                ['Disclaimer', () => openAbout(ABOUT_SECTIONS.disclaimer)],
                                ['Affiliate links', () => openAbout(ABOUT_SECTIONS.affiliates)],
                                ['Privacy', () => openAbout(ABOUT_SECTIONS.privacy)],
                                ['Terms', () => openAbout(ABOUT_SECTIONS.terms)],
                            ].map(([label, onClick]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={onClick}
                                    className="underline-offset-2 hover:underline hover:text-slate-600"
                                >
                                    {label}
                                </button>
                            ))}
                        </nav>
                        <p className="text-[10px] uppercase tracking-widest">© {OPERATOR_NAME} 2026</p>
                    </footer>
                </div>
            </div>

            <AppModals />
        </div>
    );
}
