import { useEffect, useState } from 'react';

/** Minimum layout width (px) for the full planner UI. Below this, only the guide is shown. */
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

/** True when the layout viewport is too narrow for the full app (see `MIN_DESKTOP_LAYOUT_WIDTH`). */
export function useIsSmallScreen() {
    const [isSmallScreen, setIsSmallScreen] = useState(() => {
        if (typeof window === 'undefined') return false;
        return getLayoutViewportWidthPx() < MIN_DESKTOP_LAYOUT_WIDTH;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleResize = () => {
            setIsSmallScreen(getLayoutViewportWidthPx() < MIN_DESKTOP_LAYOUT_WIDTH);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        window.visualViewport?.addEventListener('resize', handleResize);
        window.visualViewport?.addEventListener('scroll', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    return isSmallScreen;
}
