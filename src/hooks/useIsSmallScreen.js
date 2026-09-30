import { useEffect, useState } from 'react';

/** Minimum layout width (px) for editing in the layout planner. Below this the planner is view-only (13.9). */
export const MIN_DESKTOP_LAYOUT_WIDTH = 960;

/**
 * Reads the effective layout width for breakpoint checks. Mobile Chrome "Desktop site" often uses a ~980px
 * layout viewport while `innerWidth` can still reflect the narrow device width, so we take the widest signal.
 *
 * @returns {number}
 */
function getLayoutViewportWidthPx() {
    if (typeof window === 'undefined') return MIN_DESKTOP_LAYOUT_WIDTH;
    const inner = window.innerWidth;
    const docClient = typeof document !== 'undefined' ? document.documentElement?.clientWidth ?? 0 : 0;
    const visual =
        typeof window.visualViewport !== 'undefined' && window.visualViewport
            ? window.visualViewport.width
            : 0;
    // Widest value wins so desktop-mode / zoomed viewports unlock the full layout when appropriate.
    return Math.max(inner, docClient, visual);
}

/** Breakpoints for layouts chosen in JavaScript (so only one version of a table or list is rendered). */
export const PHONE_MAX_WIDTH = 767; // below `md`: cards instead of tables, the diagram's list view
export const DRAWER_MAX_WIDTH = 1023; // below `lg`: the sidebar is a drawer

/** The layout viewport width in px, kept up to date on resize and rotation. */
export function useViewportWidth() {
    const [width, setWidth] = useState(() => (typeof window === 'undefined' ? MIN_DESKTOP_LAYOUT_WIDTH : getLayoutViewportWidthPx()));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleResize = () => setWidth(getLayoutViewportWidthPx());
        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        window.visualViewport?.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            window.visualViewport?.removeEventListener('resize', handleResize);
        };
    }, []);

    return width;
}

/** True on phone-width screens (see `PHONE_MAX_WIDTH`). */
export const useIsPhone = () => useViewportWidth() <= PHONE_MAX_WIDTH;

/** True when the layout viewport is too narrow to edit the roof drawing (see `MIN_DESKTOP_LAYOUT_WIDTH`). */
export const useIsSmallScreen = () => useViewportWidth() < MIN_DESKTOP_LAYOUT_WIDTH;
