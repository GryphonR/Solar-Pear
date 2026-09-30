/**
 * Projects data model (roadmap 13.2): Project -> System -> Array, with stable opaque ids.
 *
 * A Project owns its systems, arrays and controller instances. "System" is the UI word for what the
 * code has always called an "area" (decision D9); in storage the systems array replaces the old
 * `solar_areas` name list, and arrays and controller instances point at a system by `systemId`.
 * Catalogue edits, notes and filter preferences are not part of a project; they stay global.
 *
 * The existing views still read the legacy shape (`areasData` names, `array.area`, `siteControllers[].area`,
 * `areaSettingsByArea`). `projectToLegacy` derives it from a project and `applyLegacyToProject` writes a
 * legacy-shaped change back, so those views keep working until 13.4 to 13.9 replace them.
 *
 * Everything here is pure: no storage, no React.
 */

import { COLD_TEMP_C, HOT_TEMP_C } from './arrayAnalysis';

export const PROJECTS_KEY = 'solar_projects';
export const PROJECTS_STORE_VERSION = 1;
export const DEFAULT_PROJECT_NAME = 'My design';
export const DEFAULT_SYSTEM_NAME = 'House';

/** Opaque id such as `sys_3f9c1a2b7d4e`. Not derived from any name, so renames never change it. */
export function newId(prefix) {
    const bytes = new Uint8Array(6);
    const c = globalThis.crypto;
    if (c?.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nowIso = () => new Date().toISOString();

export function makeSystem(name, settings = {}) {
    return { id: newId('sys'), name, settings: { ...settings } };
}

export function makeProject({ name = DEFAULT_PROJECT_NAME, systems, arrays = [], siteControllers = [], defaults, now = nowIso() } = {}) {
    return {
        id: newId('proj'),
        name,
        kind: 'local',
        ...(isPlainObject(defaults) ? { defaults: { ...defaults } } : {}),
        createdAt: now,
        updatedAt: now,
        systems: systems && systems.length > 0 ? systems : [makeSystem(DEFAULT_SYSTEM_NAME)],
        arrays,
        siteControllers,
    };
}

export function makeStore(projects) {
    const list = projects && projects.length > 0 ? projects : [makeProject()];
    return { version: PROJECTS_STORE_VERSION, activeProjectId: list[0].id, projects: list };
}

// ---------------------------------------------------------------------------------------------
// Legacy <-> project

/**
 * Builds a project from the legacy flat state (storage v2 / backups up to v5).
 * @param {{ areasData?: string[], arraysData?: object[], siteControllers?: object[], areaSettingsByArea?: object }} legacy
 */
export function legacyToProject(legacy, { name = DEFAULT_PROJECT_NAME, now } = {}) {
    const areaNames = [];
    const seen = new Set();
    const add = (n) => {
        const s = typeof n === 'string' ? n.trim() : '';
        if (s && !seen.has(s)) {
            seen.add(s);
            areaNames.push(s);
        }
    };
    (legacy.areasData || []).forEach(add);
    // Arrays and controllers may name an area missing from the list; keep them rather than lose them.
    (legacy.arraysData || []).forEach((a) => add(a?.area));
    (legacy.siteControllers || []).forEach((c) => add(c?.area));
    if (areaNames.length === 0) areaNames.push(DEFAULT_SYSTEM_NAME);

    const settings = isPlainObject(legacy.areaSettingsByArea) ? legacy.areaSettingsByArea : {};
    const systems = areaNames.map((n) => makeSystem(n, isPlainObject(settings[n]) ? settings[n] : {}));
    const idByName = new Map(systems.map((s) => [s.name, s.id]));
    const idOf = (areaName) => idByName.get(typeof areaName === 'string' ? areaName.trim() : '') ?? systems[0].id;

    const arrays = (legacy.arraysData || []).map(({ area, ...rest }) => ({ ...rest, systemId: idOf(area) }));
    const siteControllers = (legacy.siteControllers || []).map(({ area, ...rest }) => ({ ...rest, systemId: idOf(area) }));
    return makeProject({ name, systems, arrays, siteControllers, now });
}

/** Derives the legacy flat shape the existing views consume. */
export function projectToLegacy(project) {
    const nameById = new Map(project.systems.map((s) => [s.id, s.name]));
    const first = project.systems[0]?.name ?? DEFAULT_SYSTEM_NAME;
    const areaOf = (systemId) => nameById.get(systemId) ?? first;
    return {
        areasData: project.systems.map((s) => s.name),
        arraysData: project.arrays.map(({ systemId, ...rest }) => ({ ...rest, area: areaOf(systemId) })),
        siteControllers: project.siteControllers.map(({ systemId, ...rest }) => ({ ...rest, area: areaOf(systemId) })),
        areaSettingsByArea: Object.fromEntries(project.systems.map((s) => [s.name, s.settings || {}])),
    };
}

/**
 * Writes a legacy-shaped change into a project. Only the keys present in `patch` are applied.
 * Returns the same object when nothing changed, so React state updaters can bail out.
 *
 * Systems keep their id when a name list changes: a name that already exists reuses its system, and
 * a single unmatched slot at the same position counts as a rename. Arrays and controllers that name
 * an unknown area get a new system, and ones left without a system move to the first one, so an
 * import can never drop a design.
 */
export function applyLegacyToProject(project, patch) {
    let systems = project.systems;
    let arrays = project.arrays;
    let siteControllers = project.siteControllers;

    if (Array.isArray(patch.areasData)) {
        const names = [...new Set(patch.areasData.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()))];
        if (names.length > 0) {
            const used = new Set();
            const next = names.map((name, i) => {
                const same = systems.find((s) => s.name === name && !used.has(s.id));
                if (same) {
                    used.add(same.id);
                    return same;
                }
                const atIndex = systems[i];
                if (atIndex && !used.has(atIndex.id) && !names.includes(atIndex.name)) {
                    used.add(atIndex.id);
                    return { ...atIndex, name };
                }
                const created = makeSystem(name);
                used.add(created.id);
                return created;
            });
            const unchanged = next.length === systems.length && next.every((s, i) => s === systems[i]);
            if (!unchanged) systems = next;
        }
    }

    const ensureSystem = (areaName) => {
        const key = typeof areaName === 'string' ? areaName.trim() : '';
        if (!key) return systems[0].id;
        let found = systems.find((s) => s.name === key);
        if (!found) {
            found = makeSystem(key);
            systems = [...systems, found];
        }
        return found.id;
    };

    // Reuse an existing entry when its content is unchanged, so unrelated edits keep object identity.
    const remap = (incoming, current) => {
        const mapped = incoming.map(({ area, ...rest }) => ({ ...rest, systemId: ensureSystem(area) }));
        const merged = mapped.map((m, i) => (current[i] && JSON.stringify(current[i]) === JSON.stringify(m) ? current[i] : m));
        return merged.length === current.length && merged.every((m, i) => m === current[i]) ? current : merged;
    };
    if (Array.isArray(patch.arraysData)) arrays = remap(patch.arraysData, arrays);
    if (Array.isArray(patch.siteControllers)) siteControllers = remap(patch.siteControllers, siteControllers);

    if (isPlainObject(patch.areaSettingsByArea)) {
        const byName = patch.areaSettingsByArea;
        let changed = false;
        const withSettings = systems.map((s) => {
            if (!isPlainObject(byName[s.name])) return s;
            if (JSON.stringify(byName[s.name]) === JSON.stringify(s.settings)) return s;
            changed = true;
            return { ...s, settings: byName[s.name] };
        });
        if (changed) systems = withSettings;
    }

    // Anything that points at a system that no longer exists moves to the first system.
    const ids = new Set(systems.map((s) => s.id));
    const rehome = (list) => (list.every((x) => ids.has(x.systemId)) ? list : list.map((x) => (ids.has(x.systemId) ? x : { ...x, systemId: systems[0].id })));
    arrays = rehome(arrays);
    siteControllers = rehome(siteControllers);

    if (systems === project.systems && arrays === project.arrays && siteControllers === project.siteControllers) return project;
    return { ...project, systems, arrays, siteControllers };
}

// ---------------------------------------------------------------------------------------------
// System actions (id based; used instead of name lookups by the new UI)

export function addSystem(project, name, settings = {}) {
    const system = makeSystem(name, settings);
    return { project: { ...project, systems: [...project.systems, system] }, system };
}

export function renameSystem(project, systemId, name) {
    return { ...project, systems: project.systems.map((s) => (s.id === systemId ? { ...s, name } : s)) };
}

/**
 * Removes a system. Its arrays and controllers are deleted with it, or moved to `moveTo` (default: the
 * first remaining system). The last system cannot be removed.
 */
export function removeSystem(project, systemId, { deleteContents = false, moveTo } = {}) {
    if (project.systems.length <= 1 || !project.systems.some((s) => s.id === systemId)) return project;
    const systems = project.systems.filter((s) => s.id !== systemId);
    const target = systems.some((s) => s.id === moveTo) ? moveTo : systems[0].id;
    if (deleteContents) {
        const arrays = project.arrays.filter((a) => a.systemId !== systemId);
        const removed = new Set(project.siteControllers.filter((c) => c.systemId === systemId).map((c) => c.id));
        return {
            ...project,
            systems,
            arrays: arrays.map((a) => (removed.has(a.controllerInstanceId) ? { ...a, controllerInstanceId: '', controllerMppt: 1, controller: '' } : a)),
            siteControllers: project.siteControllers.filter((c) => c.systemId !== systemId),
        };
    }
    const move = (x) => (x.systemId === systemId ? { ...x, systemId: target } : x);
    return { ...project, systems, arrays: project.arrays.map(move), siteControllers: project.siteControllers.map(move) };
}

// ---------------------------------------------------------------------------------------------
// Store actions

export const getActiveProject = (store) => store.projects.find((p) => p.id === store.activeProjectId) ?? store.projects[0];

/** Applies `fn` to the active project. Returns the same store if `fn` returns the same project. */
export function updateActiveProject(store, fn, now = nowIso()) {
    const active = getActiveProject(store);
    const next = fn(active);
    if (next === active) return store;
    return { ...store, projects: store.projects.map((p) => (p.id === active.id ? { ...next, updatedAt: now } : p)) };
}

export function createProject(store, name = DEFAULT_PROJECT_NAME) {
    const project = makeProject({ name: uniqueName(store, name) });
    return { store: { ...store, activeProjectId: project.id, projects: [...store.projects, project] }, project };
}

/** Deep copy with fresh ids everywhere. References between arrays and controller instances are remapped. */
export function duplicateProject(store, projectId) {
    const source = store.projects.find((p) => p.id === projectId);
    if (!source) return { store, project: null };
    const sysIds = new Map(source.systems.map((s) => [s.id, newId('sys')]));
    const instIds = new Map(source.siteControllers.map((c) => [c.id, newId('inst')]));
    const now = nowIso();
    const project = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId('proj'),
        name: uniqueName(store, `${source.name} copy`),
        createdAt: now,
        updatedAt: now,
    };
    project.systems = project.systems.map((s) => ({ ...s, id: sysIds.get(s.id) }));
    project.siteControllers = project.siteControllers.map((c) => ({ ...c, id: instIds.get(c.id), systemId: sysIds.get(c.systemId) }));
    project.arrays = project.arrays.map((a) => ({
        ...a,
        id: newId('array'),
        systemId: sysIds.get(a.systemId),
        controllerInstanceId: instIds.get(a.controllerInstanceId) ?? '',
    }));
    return { store: { ...store, activeProjectId: project.id, projects: [...store.projects, project] }, project };
}

export function renameProject(store, projectId, name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return store;
    return { ...store, projects: store.projects.map((p) => (p.id === projectId ? { ...p, name: trimmed, updatedAt: nowIso() } : p)) };
}

export function switchProject(store, projectId) {
    return store.projects.some((p) => p.id === projectId) && store.activeProjectId !== projectId ? { ...store, activeProjectId: projectId } : store;
}

/** Deleting the last project leaves a fresh empty one, so there is always an active project. */
export function deleteProject(store, projectId) {
    if (!store.projects.some((p) => p.id === projectId)) return store;
    const rest = store.projects.filter((p) => p.id !== projectId);
    if (rest.length === 0) return makeStore();
    return { ...store, projects: rest, activeProjectId: store.activeProjectId === projectId ? rest[0].id : store.activeProjectId };
}

function uniqueName(store, wanted) {
    const names = new Set(store.projects.map((p) => p.name));
    if (!names.has(wanted)) return wanted;
    for (let n = 2; ; n += 1) if (!names.has(`${wanted} ${n}`)) return `${wanted} ${n}`;
}

// ---------------------------------------------------------------------------------------------
// Validation (storage and backups)

/** Returns a clean project, or null when it can't be used. Never throws. */
export function sanitizeProject(raw) {
    if (!isPlainObject(raw) || typeof raw.id !== 'string' || !raw.id) return null;
    if (!Array.isArray(raw.systems)) return null;
    const systems = [];
    const seen = new Set();
    for (const s of raw.systems) {
        if (!isPlainObject(s) || typeof s.id !== 'string' || !s.id || seen.has(s.id)) continue;
        const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : DEFAULT_SYSTEM_NAME;
        seen.add(s.id);
        systems.push({ id: s.id, name, settings: isPlainObject(s.settings) ? s.settings : {} });
    }
    if (systems.length === 0) return null;
    const fix = (list, needsId) =>
        (Array.isArray(list) ? list : [])
            .filter((x) => isPlainObject(x) && (!needsId || (typeof x.id === 'string' && x.id)))
            .map((x) => (seen.has(x.systemId) ? x : { ...x, systemId: systems[0].id }));
    const now = nowIso();
    return {
        id: raw.id,
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : DEFAULT_PROJECT_NAME,
        kind: 'local',
        ...(isPlainObject(raw.defaults) ? { defaults: sanitizeDefaults(raw.defaults) } : {}),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
        systems,
        arrays: fix(raw.arrays, true),
        siteControllers: fix(raw.siteControllers, true),
    };
}

/**
 * Project defaults (roadmap 13.5): design temperatures copied into new systems. Each system keeps its
 * own values in `settings`, so changing a default never re-checks existing systems.
 */
export const DEFAULT_PROJECT_DEFAULTS = Object.freeze({ designLowC: COLD_TEMP_C, designHighC: HOT_TEMP_C });

function sanitizeDefaults(raw) {
    const out = {};
    for (const key of Object.keys(DEFAULT_PROJECT_DEFAULTS)) {
        const n = Number(raw?.[key]);
        if (raw?.[key] !== null && raw?.[key] !== '' && Number.isFinite(n)) out[key] = n;
    }
    return out;
}

/** A project's defaults with the app defaults filled in. */
export function projectDefaults(project) {
    return { ...DEFAULT_PROJECT_DEFAULTS, ...sanitizeDefaults(project?.defaults) };
}

export function setProjectDefaults(project, patch) {
    return { ...project, defaults: sanitizeDefaults({ ...projectDefaults(project), ...patch }) };
}

/** Returns a clean store, or null when nothing in it is usable. */
export function sanitizeStore(raw) {
    if (!isPlainObject(raw) || !Array.isArray(raw.projects)) return null;
    const projects = [];
    const ids = new Set();
    for (const p of raw.projects) {
        const clean = sanitizeProject(p);
        if (clean && !ids.has(clean.id)) {
            ids.add(clean.id);
            projects.push(clean);
        }
    }
    if (projects.length === 0) return null;
    return {
        version: PROJECTS_STORE_VERSION,
        activeProjectId: ids.has(raw.activeProjectId) ? raw.activeProjectId : projects[0].id,
        projects,
    };
}
