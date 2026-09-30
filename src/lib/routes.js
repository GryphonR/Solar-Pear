/**
 * @file routes.js
 * URL scheme for the app (roadmap 13.3, delivers 5.4). Pure functions that turn a URL path into a
 * route object, check it against the projects store, and build paths back. `AppStateContext` treats the
 * URL as the source of truth: it derives the view from the location and navigates to change it.
 *
 * | Path | Route `view` |
 * | ---- | ------------ |
 * | `/` | `home`: the Guide in the old UI; the last project (or the chooser on first run) in the new shell |
 * | `/new` | `new`: "What are you building?" chooser (new shell; the Guide in the old UI) |
 * | `/learn`, `/learn/:slug` | `learn` (`guide`, `panels`, `controllers`, `methodology`) |
 * | `/about` | `about` (sections are `#hash` anchors) |
 * | `/library/panels`, `/library/controllers` | `library` |
 * | `/p/:project` | `project` overview |
 * | `/p/:project/summary` | `summary` (summary and BoM) |
 * | `/p/:project/s/:system[/(overview\|setup\|controllers\|bom)]` | `system` |
 * | `/p/:project/s/:system/a/:array[/(overview\|layout\|panel\|controllers)]` | `array` |
 *
 * Ids are the opaque project, system and array ids from `src/lib/projects.js`, so renames never break a
 * link. The array `controllers` tab exists until 13.6 moves controllers to the system page. The old UI
 * has no project or system screens, so it shows the summary for those routes; the URLs stay valid.
 */

export const LEARN_SLUGS = Object.freeze(['guide', 'panels', 'controllers', 'methodology']);
export const LIBRARY_SECTIONS = Object.freeze(['panels', 'controllers']);
export const SYSTEM_TABS = Object.freeze(['overview', 'setup', 'controllers', 'bom']);
export const ARRAY_TABS = Object.freeze(['overview', 'layout', 'panel', 'controllers']);

/** Tab ids of the old UI (`activeTab`). Any other `activeTab` value is an array id. */
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

/** Old UI array content tab ↔ URL segment (`panels` shows as `panel`, as in the brief). */
const CONTENT_TAB_TO_SEGMENT = Object.freeze({ overview: 'overview', layout: 'layout', panels: 'panel', controllers: 'controllers' });
const SEGMENT_TO_CONTENT_TAB = Object.freeze(Object.fromEntries(Object.entries(CONTENT_TAB_TO_SEGMENT).map(([k, v]) => [v, k])));
export const DEFAULT_ARRAY_CONTENT_TAB = 'overview';

const TAB_TO_ROUTE = Object.freeze({
    [TABS.guide]: { view: 'learn', slug: 'guide' },
    [TABS.guidePanels]: { view: 'learn', slug: 'panels' },
    [TABS.guideControllers]: { view: 'learn', slug: 'controllers' },
    [TABS.methodology]: { view: 'learn', slug: 'methodology' },
    [TABS.about]: { view: 'about' },
    [TABS.libraryPanels]: { view: 'library', section: 'panels' },
    [TABS.libraryControllers]: { view: 'library', section: 'controllers' },
});

const safeDecode = (segment) => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};
const enc = encodeURIComponent;
const trimPath = (path) => ((path || '/').replace(/\/+$/, '') || '/');

/** True when two paths name the same route, ignoring percent-encoding and trailing slashes. */
export function isSamePath(a, b) {
    const normalise = (path) => trimPath(path).split('/').map(safeDecode).join('/');
    return normalise(a) === normalise(b);
}

/**
 * Parses a path without checking ids. Returns null for paths that aren't part of the scheme.
 * @param {string} pathname
 */
export function parsePath(pathname) {
    const parts = trimPath(pathname).split('/').filter(Boolean).map(safeDecode);
    const [a, b, c, d, e, f, g, ...rest] = parts;
    if (parts.length === 0) return { view: 'home' };
    if (a === 'about' && parts.length === 1) return { view: 'about' };
    if (a === 'new' && parts.length === 1) return { view: 'new' };
    if (a === 'learn' && parts.length <= 2) {
        if (b === undefined) return { view: 'learn', slug: null };
        return LEARN_SLUGS.includes(b) ? { view: 'learn', slug: b } : null;
    }
    if (a === 'library' && parts.length <= 2) {
        return { view: 'library', section: LIBRARY_SECTIONS.includes(b) ? b : 'panels' };
    }
    if (a !== 'p' || !b || rest.length > 0) return null;
    const projectId = b;
    if (c === undefined) return { view: 'project', projectId };
    if (c === 'summary' && d === undefined) return { view: 'summary', projectId };
    if (c !== 's' || !d) return null;
    const systemId = d;
    if (e === undefined || SYSTEM_TABS.includes(e)) {
        return f === undefined ? { view: 'system', projectId, systemId, tab: e || 'overview' } : null;
    }
    if (e !== 'a' || !f) return null;
    return { view: 'array', projectId, systemId, arrayId: f, tab: ARRAY_TABS.includes(g) ? g : 'overview' };
}

/** Builds the canonical path for a route object. */
export function buildPath(route) {
    switch (route?.view) {
        case 'learn':
            return route.slug ? `/learn/${route.slug}` : '/learn';
        case 'about':
            return '/about';
        case 'new':
            return '/new';
        case 'library':
            return `/library/${route.section || 'panels'}`;
        case 'project':
            return `/p/${enc(route.projectId)}`;
        case 'summary':
            return `/p/${enc(route.projectId)}/summary`;
        case 'system': {
            const base = `/p/${enc(route.projectId)}/s/${enc(route.systemId)}`;
            return route.tab && route.tab !== 'overview' ? `${base}/${route.tab}` : base;
        }
        case 'array':
            return `/p/${enc(route.projectId)}/s/${enc(route.systemId)}/a/${enc(route.arrayId)}/${route.tab || 'overview'}`;
        default:
            return '/';
    }
}

/**
 * Parses a path and checks it against the projects store. Unknown or stale parts fall back to the
 * nearest thing that exists: an array whose system changed gets its current system, a deleted array
 * goes to its system, a deleted system to its project, and an unknown project to the active project.
 *
 * @param {string} pathname
 * @param {{ activeProjectId?: string, projects?: Array<{ id: string, systems: {id:string}[], arrays: {id:string, systemId:string}[] }> }} store
 * @returns {{ route: object, canonicalPath: string }}
 */
export function resolveRoute(pathname, store) {
    const done = (route) => ({ route, canonicalPath: buildPath(route) });
    const parsed = parsePath(pathname);
    if (!parsed) return { route: { view: 'home' }, canonicalPath: '/' };
    if (parsed.view === 'home') return { route: parsed, canonicalPath: '/' };
    if (!parsed.projectId) return done(parsed);

    const projects = store?.projects || [];
    const project = projects.find((p) => p.id === parsed.projectId);
    if (!project) {
        const active = projects.find((p) => p.id === store?.activeProjectId) || projects[0];
        return active ? done({ view: 'project', projectId: active.id }) : { route: { view: 'home' }, canonicalPath: '/' };
    }
    if (parsed.view === 'array') {
        const array = project.arrays.find((x) => x.id === parsed.arrayId);
        if (array && project.systems.some((s) => s.id === array.systemId)) {
            return done({ ...parsed, systemId: array.systemId });
        }
    }
    if (parsed.view === 'array' || parsed.view === 'system') {
        if (project.systems.some((s) => s.id === parsed.systemId)) {
            return done(parsed.view === 'system' ? parsed : { view: 'system', projectId: project.id, systemId: parsed.systemId, tab: 'overview' });
        }
        return done({ view: 'project', projectId: project.id });
    }
    return done(parsed);
}

/**
 * Old UI view for a route: `{ tab, contentTab }`. Project and system screens don't exist in the old UI,
 * so they show the summary.
 */
export function routeToTab(route) {
    switch (route?.view) {
        case 'learn':
            return { tab: { panels: TABS.guidePanels, controllers: TABS.guideControllers, methodology: TABS.methodology }[route.slug] || TABS.guide, contentTab: null };
        case 'about':
            return { tab: TABS.about, contentTab: null };
        case 'library':
            return { tab: route.section === 'controllers' ? TABS.libraryControllers : TABS.libraryPanels, contentTab: null };
        case 'project':
        case 'summary':
        case 'system':
            return { tab: TABS.summary, contentTab: null };
        case 'array':
            return { tab: route.arrayId, contentTab: SEGMENT_TO_CONTENT_TAB[route.tab] || DEFAULT_ARRAY_CONTENT_TAB };
        default:
            return { tab: TABS.guide, contentTab: null };
    }
}

/** Route for an array page of a project (`contentTab` is the old UI tab id, e.g. `panels`). */
export function arrayRoute(project, arrayId, contentTab = DEFAULT_ARRAY_CONTENT_TAB) {
    const array = project?.arrays.find((a) => a.id === arrayId);
    if (!array) return null;
    return {
        view: 'array',
        projectId: project.id,
        systemId: array.systemId,
        arrayId,
        tab: CONTENT_TAB_TO_SEGMENT[contentTab] || CONTENT_TAB_TO_SEGMENT[DEFAULT_ARRAY_CONTENT_TAB],
    };
}

/**
 * Path for an old UI tab. Any tab that isn't a fixed view is an array id of `project`.
 *
 * @param {string} tab
 * @param {{ project?: object, contentTab?: string }} [ctx]
 */
export function tabToPath(tab, { project, contentTab } = {}) {
    if (TAB_TO_ROUTE[tab]) return buildPath(TAB_TO_ROUTE[tab]);
    if (!project) return '/';
    if (tab === TABS.summary) return buildPath({ view: 'summary', projectId: project.id });
    const route = arrayRoute(project, tab, contentTab);
    return buildPath(route || { view: 'summary', projectId: project.id });
}
