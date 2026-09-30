/**
 * @file TrustNotices.jsx
 * Small notices for roadmap phase 6: the results disclaimer (6.1) and the affiliate disclosure
 * shown next to buy buttons (6.2).
 */

import React from 'react';
import { useUiState } from '../context/AppStateContext';
import { ABOUT_SECTIONS, ABOUT_TAB } from '../lib/siteInfo';

/**
 * Opens the About & legal page at a section. The main pane re-mounts on tab change, so the scroll
 * waits a frame for the section to exist.
 *
 * @param {(tab: string) => void} setActiveTab
 * @param {string} [sectionId]
 */
export function openAboutSection(setActiveTab, sectionId) {
    setActiveTab(ABOUT_TAB);
    if (!sectionId || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
        });
    });
}

/** One-line disclaimer shown next to compatibility results (roadmap 6.1). */
export function ResultsDisclaimer({ className = '' }) {
    const { setActiveTab } = useUiState();
    return (
        <p className={`text-xs text-slate-500 ${className}`}>
            Checks component compatibility only, not an installation design. Confirm against the manufacturers’
            datasheets and BS 7671 before installing.{' '}
            <button
                type="button"
                onClick={() => openAboutSection(setActiveTab, ABOUT_SECTIONS.disclaimer)}
                className="underline hover:text-slate-700"
            >
                More
            </button>
        </p>
    );
}

/** One-line affiliate disclosure for places that show buy buttons. */
export function AffiliateNotice({ className = '' }) {
    const { setActiveTab } = useUiState();
    return (
        <p className={`text-xs text-slate-500 ${className}`}>
            Buy links marked * are affiliate links: we may earn a commission, at no cost to you. It never
            affects rankings.{' '}
            <button
                type="button"
                onClick={() => openAboutSection(setActiveTab, ABOUT_SECTIONS.affiliates)}
                className="underline hover:text-slate-700"
            >
                How we’re funded
            </button>
        </p>
    );
}
