import { describe, it, expect } from 'vitest';
import {
    legacyToProject,
    projectToLegacy,
    applyLegacyToProject,
    makeStore,
    makeProject,
    createProject,
    duplicateProject,
    renameProject,
    deleteProject,
    switchProject,
    updateActiveProject,
    getActiveProject,
    addSystem,
    renameSystem,
    removeSystem,
    sanitizeStore,
    sanitizeProject,
    DEFAULT_PROJECT_NAME,
} from './projects';

const legacy = () => ({
    areasData: ['House', 'Garage'],
    arraysData: [
        { id: 'A1', name: 'South', area: 'House', count: 8, panel: 'p1', controllerInstanceId: 'inst_1', controllerMppt: 2, controller: '' },
        { id: 'array_99', name: 'Roof', area: 'Garage', count: 4, panel: '', controllerInstanceId: '', controllerMppt: 1, controller: '' },
    ],
    siteControllers: [{ id: 'inst_1', modelId: 'ss150', area: 'House', name: 'Victron (#1)' }],
    areaSettingsByArea: { House: { systemVoltage: 48, designLowC: -15 }, Garage: { systemVoltage: 12 } },
});

describe('legacy <-> project', () => {
    it('round-trips an existing design without losing anything', () => {
        const project = legacyToProject(legacy());
        expect(projectToLegacy(project)).toEqual(legacy());
    });

    it('gives systems and the project stable opaque ids that do not come from names', () => {
        const project = legacyToProject(legacy());
        expect(project.id).toMatch(/^proj_[0-9a-f]{12}$/);
        expect(project.name).toBe(DEFAULT_PROJECT_NAME);
        expect(project.systems.map((s) => s.id)).toEqual([expect.stringMatching(/^sys_/), expect.stringMatching(/^sys_/)]);
        expect(project.arrays[0].systemId).toBe(project.systems[0].id);
        expect(project.arrays[0]).not.toHaveProperty('area');
    });

    it('keeps arrays whose area is missing from the area list, and defaults an empty design to one system', () => {
        const project = legacyToProject({ areasData: ['House'], arraysData: [{ id: 'A1', area: 'Barn' }] });
        expect(project.systems.map((s) => s.name)).toEqual(['House', 'Barn']);
        expect(legacyToProject({}).systems.map((s) => s.name)).toEqual(['House']);
    });
});

describe('applyLegacyToProject', () => {
    it('returns the same object when nothing changes', () => {
        const project = legacyToProject(legacy());
        expect(applyLegacyToProject(project, projectToLegacy(project))).toBe(project);
    });

    it('treats a changed name at the same position as a rename and keeps the id', () => {
        const project = legacyToProject(legacy());
        const next = applyLegacyToProject(project, { areasData: ['Main house', 'Garage'] });
        expect(next.systems[0].id).toBe(project.systems[0].id);
        expect(next.systems[0].name).toBe('Main house');
        expect(next.arrays[0].systemId).toBe(project.systems[0].id);
    });

    it('adds a system for a new name', () => {
        const project = legacyToProject(legacy());
        const next = applyLegacyToProject(project, { areasData: ['House', 'Garage', 'Barn'] });
        expect(next.systems).toHaveLength(3);
        expect(next.systems[2].name).toBe('Barn');
    });

    it('moves contents of a removed system to the first system rather than dropping them', () => {
        const project = legacyToProject(legacy());
        const next = applyLegacyToProject(project, { areasData: ['House'] });
        expect(next.arrays.every((a) => a.systemId === next.systems[0].id)).toBe(true);
    });

    it('creates a system for an array that names an unknown area', () => {
        const project = legacyToProject(legacy());
        const l = projectToLegacy(project);
        const next = applyLegacyToProject(project, { arraysData: [...l.arraysData, { id: 'A3', area: 'Shed' }] });
        expect(next.systems.map((s) => s.name)).toContain('Shed');
        expect(projectToLegacy(next).arraysData.at(-1).area).toBe('Shed');
    });

    it('updates area settings by name', () => {
        const project = legacyToProject(legacy());
        const next = applyLegacyToProject(project, { areaSettingsByArea: { House: { systemVoltage: 24 } } });
        expect(next.systems[0].settings).toEqual({ systemVoltage: 24 });
        expect(next.systems[1].settings).toEqual({ systemVoltage: 12 });
    });
});

describe('system actions', () => {
    it('adds and renames without changing ids', () => {
        const project = legacyToProject(legacy());
        const { project: withBarn, system } = addSystem(project, 'Barn');
        expect(withBarn.systems.at(-1)).toBe(system);
        const renamed = renameSystem(withBarn, system.id, 'Workshop');
        expect(renamed.systems.at(-1)).toMatchObject({ id: system.id, name: 'Workshop' });
    });

    it('removes a system and moves its arrays, or deletes them and unbinds the controller', () => {
        const project = legacyToProject(legacy());
        const [house, garage] = project.systems;
        const moved = removeSystem(project, garage.id);
        expect(moved.arrays.map((a) => a.systemId)).toEqual([house.id, house.id]);

        const deleted = removeSystem(project, house.id, { deleteContents: true });
        expect(deleted.arrays.map((a) => a.id)).toEqual(['array_99']);
        expect(deleted.siteControllers).toEqual([]);
    });

    it('never removes the last system', () => {
        const project = legacyToProject({ areasData: ['House'] });
        expect(removeSystem(project, project.systems[0].id)).toBe(project);
    });
});

describe('store actions', () => {
    it('starts with one local project called "My design"', () => {
        const store = makeStore();
        expect(store.projects).toHaveLength(1);
        expect(getActiveProject(store).name).toBe('My design');
    });

    it('creates, renames, switches and deletes projects, keeping one active', () => {
        let store = makeStore();
        const first = store.activeProjectId;
        ({ store } = createProject(store, 'Workshop'));
        expect(store.projects).toHaveLength(2);
        expect(getActiveProject(store).name).toBe('Workshop');
        store = renameProject(store, first, 'Cottage');
        expect(store.projects[0].name).toBe('Cottage');
        expect(renameProject(store, first, '   ')).toBe(store);
        store = switchProject(store, first);
        expect(store.activeProjectId).toBe(first);
        store = deleteProject(store, first);
        expect(store.projects).toHaveLength(1);
        expect(store.activeProjectId).toBe(store.projects[0].id);
    });

    it('deleting the last project leaves a fresh one', () => {
        const store = makeStore();
        const next = deleteProject(store, store.activeProjectId);
        expect(next.projects).toHaveLength(1);
        expect(next.projects[0].id).not.toBe(store.projects[0].id);
    });

    it('makes project names unique', () => {
        let store = makeStore();
        ({ store } = createProject(store, DEFAULT_PROJECT_NAME));
        expect(store.projects.map((p) => p.name)).toEqual(['My design', 'My design 2']);
    });

    it('duplicates with fresh ids everywhere and remaps controller bindings', () => {
        const project = legacyToProject(legacy());
        const store = { ...makeStore([project]) };
        const { store: next, project: copy } = duplicateProject(store, project.id);
        expect(next.projects).toHaveLength(2);
        expect(copy.name).toBe('My design copy');
        const ids = (p) => [p.id, ...p.systems.map((s) => s.id), ...p.arrays.map((a) => a.id), ...p.siteControllers.map((c) => c.id)];
        expect(ids(copy).some((id) => ids(project).includes(id))).toBe(false);
        expect(copy.arrays[0].controllerInstanceId).toBe(copy.siteControllers[0].id);
        expect(copy.arrays[0].systemId).toBe(copy.systems[0].id);
        // The original is untouched.
        expect(projectToLegacy(project)).toEqual(legacy());
    });

    it('updateActiveProject bumps updatedAt and bails out when nothing changed', () => {
        const store = makeStore();
        expect(updateActiveProject(store, (p) => p)).toBe(store);
        const next = updateActiveProject(store, (p) => ({ ...p, name: 'X' }), '2030-01-01T00:00:00.000Z');
        expect(getActiveProject(next).updatedAt).toBe('2030-01-01T00:00:00.000Z');
    });
});

describe('sanitising', () => {
    it('rejects garbage and repairs dangling references', () => {
        expect(sanitizeStore(null)).toBeNull();
        expect(sanitizeStore({ projects: [{ id: 'p', systems: [] }] })).toBeNull();
        const p = makeProject();
        const clean = sanitizeProject({ ...p, arrays: [{ id: 'A1', systemId: 'gone' }, { name: 'no id' }], siteControllers: 'x' });
        expect(clean.arrays).toEqual([{ id: 'A1', systemId: p.systems[0].id }]);
        expect(clean.siteControllers).toEqual([]);
    });

    it('falls back to the first project when the active id is unknown', () => {
        const a = makeProject();
        const store = sanitizeStore({ activeProjectId: 'nope', projects: [a] });
        expect(store.activeProjectId).toBe(a.id);
    });
});
