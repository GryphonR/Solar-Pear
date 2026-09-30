/**
 * @file App.jsx
 * Root: the app shell (`src/shell/`). It works from phone width up; the layout planner's drawing is
 * view-only on phones.
 */

import React, { useEffect } from 'react';
import { useLocation } from 'react-router';
import AppShell from './shell/AppShell';

export default function App() {
    // Scroll to an in-page section (e.g. /about#privacy) once the page has mounted.
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (!hash || typeof document === 'undefined') return;
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.({ block: 'start' });
    }, [pathname, hash]);

    return <AppShell />;
}
