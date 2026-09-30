/**
 * @file routes.js
 * URL scheme for the app (roadmap 13.3, delivers 5.4). Pure functions that map between a URL path
 * and the app's view state (`activeTab` plus, on array pages, the array content tab). The URL is the
 * source of truth: `AppStateContext` derives `activeTab` from the location and navigates on change.
 *
 * Route table (paths are relative to the Vite base path):
 *
 * | Path | View |
 * | ---- | ---- |
 * | `/` | Guide (the landing page until the chooser, 13.5) |
 * | `/learn/:slug` | `panels`, `controllers` and `methodology` guides; `guide` is an alias of `/` |
 * | `/about` | About & legal (sections are `#hash` anchors) |
 * | `/library/panels`, `/library/controllers` | Catalogue tables |
 * | `/p/:project/summary` | System summary and BoM |
 * | `/p/:project/s/:system/a/:array/(overview\|layout\|panel\|controllers)` | Array pages |
 * | `/p/:project`, `/p/:project/s/:system/…` | Redirect to the summary until the project and system screens exist (13.4–13.7) |
 *
 * Interim details, until 13.2 and 13.6 land:
 * - There is one implicit project, `LOCAL_PROJECT_ID`. 13.2 replaces it with stable opaque ids.
 * - `:system` is the URL-encoded area name, because areas have no ids yet. Array pages resolve by
 *   array id alone, so a renamed area only changes the canonical URL (old links redirect).
 * - `controllers` is still an array tab; 13.6 moves it to the system Controllers page.
 */

/** The single local project until the projects model (13.2) adds real ids. */
export const LOCAL_PROJECT_ID = 'local';

export const TABS = Object.freeze({
    guide: 'GUIDE',
    guidePanels: 'GUIDE_PANELS',
    guideControllers: 'GUIDE_CONTROLLERS',
    methodology: 'METHODOLOGY',
    about: 'ABOUT',
    summary: 'SUMMARY',
    libraryPanels: 'DB_PANELS',
    libraryControllers: 'DB_CHARGERS',
});

/** Array content tab (internal id) → URL segment. */
const ARRAY_TAB_SEGMENTS = Object.freeze({
    overview: 'overview',
    layout: 'layout',
    panels: 'panel',
    controllers: 'controllers',
});
const ARRAY_SEGMENT_TABS = Object.fromEntries(
    Object.entries(ARRAY_TAB_SEGMENTS).map(([tab, segment]) => [segment, tab])
);
export const DEFAULT_ARRAY_CONTENT_TAB = 'overview';

/** Fixed (non-array) tabs and their canonical paths. */
const STATIC_PATHS = Object.freeze({
    [TABS.guide]: '/',
    [TABS.guidePanels]: '/learn/panels',
    [TABS.guideControllers]: '/learn/controllers',
    [TABS.methodology]: '/learn/methodology',
    [TABS.about]: '/about',
    [TABS.summary]: `/p/${LOCAL_PROJECT_ID}/summary`,
    [TABS.libraryPanels]: '/library/panels',
    [TABS.libraryControllers]: '/library/controllers',
});
const PATH_TABS = Object.fromEntries(Object.entries(STATIC_PATHS).map(([tab, path]) => [path, tab]));
/** Extra paths that show a fixed tab but redirect to its canonical path. */
const PATH_ALIASES = Object.freeze({
    '/learn': TABS.guide,
    '/learn/guide': TABS.guide,
    '/library': TABS.libraryPanels,
    [`/p/${LOCAL_PROJECT_ID}`]: TABS.summary,
});

const safeDecode = (segment) => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

/** True when two paths name the same route, ignoring percent-encoding and trailing slashes. */
export function isSamePath(a, b) {
    const normalise = (path) =>
        ((path || '/').replace(/\/+$/, '') || '/').split('/').map(safeDecode).join('/');
    return normalise(a) === normalise(b);
}

/** Path of an array page. */
export function arrayPath(array, contentTab = DEFAULT_ARRAY_CONTENT_TAB) {
    const segment = ARRAY_TAB_SEGMENTS[contentTab] || ARRAY_TAB_SEGMENTS[DEFAULT_ARRAY_CONTENT_TAB];
    const system = encodeURIComponent(array.area || 'House');
    return `/p/${LOCAL_PROJECT_ID}/s/${system}/a/${encodeURIComponent(array.id)}/${segment}`;
}

/**
 * Path for a tab. Any tab that isn't a fixed view is an array id.
 *
 * @param {string} tab - `activeTab` value
 * @param {{ arraysData?: Array<{ id: string, area?: string }>, contentTab?: string }} [ctx]
 * @returns {string}
 */
export function tabToPath(tab, { arraysData = [], contentTab } = {}) {
    if (STATIC_PATHS[tab]) return STATIC_PATHS[tab];
    const array = arraysData.find((a) => a.id === tab);
    if (!array) return STATIC_PATHS[TABS.summary];
    return arrayPath(array, contentTab);
}

/**
 * Resolves a path to view state.
 *
 * @param {string} pathname - location pathname, relative to the base path
 * @param {Array<{ id: string, area?: string }>} arraysData
 * @returns {{ tab: string, contentTab: string | null, canonicalPath: string }}
 *   `canonicalPath` differs from `pathname` when the app should replace the URL (alias, renamed
 *   area, trailing slash, unknown or deleted target).
 */
export function resolvePath(pathname, arraysData = []) {
    const trimmed = (pathname || '/').replace(/\/+$/, '') || '/';
    const fixed = (tab) => ({ tab, contentTab: null, canonicalPath: STATIC_PATHS[tab] });

    if (PATH_TABS[trimmed]) return fixed(PATH_TABS[trimmed]);
    if (PATH_ALIASES[trimmed]) return fixed(PATH_ALIASES[trimmed]);

    const parts = trimmed.split('/').filter(Boolean).map(safeDecode);
    if (parts[0] === 'p') {
        // /p/:project/s/:system/a/:array[/:tab]
        if (parts[2] === 's' && parts[4] === 'a' && parts[5] && parts.length <= 7) {
            const array = arraysData.find((a) => a.id === parts[5]);
            const contentTab = ARRAY_SEGMENT_TABS[parts[6]] || DEFAULT_ARRAY_CONTENT_TAB;
            if (array) {
                return { tab: array.id, contentTab, canonicalPath: arrayPath(array, contentTab) };
            }
        }
        // Unknown project, system screens not built yet, or a deleted array.
        return fixed(TABS.summary);
    }
    return fixed(TABS.guide);
}
