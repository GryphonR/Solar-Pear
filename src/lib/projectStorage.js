import { PROJECTS_KEY, sanitizeStore } from './projects';

/** Storage v2 keys that held the design directly. Replaced by `solar_projects` in v3 and removed once migrated. */
export const LEGACY_DESIGN_KEYS = [
    'solar_arrays',
    'solar_site_controllers',
    'solar_areas',
    'solar_area_settings',
    'solar_selections',
];

/** Reads and validates the projects store. Returns null when it is missing or unusable. */
export function loadProjectsStore(storage = window.localStorage) {
    try {
        const raw = storage.getItem(PROJECTS_KEY);
        return raw ? sanitizeStore(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

/** Writes the projects store. Throws when storage is full or unavailable. */
export function saveProjectsStore(store, storage = window.localStorage) {
    storage.setItem(PROJECTS_KEY, JSON.stringify(store));
}

/** Reads the raw v2 design keys, leaving parsing and migration of arrays/controllers to `lib/migration.js`. */
export function readLegacyAreas(storage = window.localStorage) {
    const parse = (key) => {
        try {
            const raw = storage.getItem(key);
            return raw ? JSON.parse(raw) : undefined;
        } catch {
            return undefined;
        }
    };
    const areas = parse('solar_areas');
    const settings = parse('solar_area_settings');
    return {
        areasData: Array.isArray(areas) ? areas.filter((a) => typeof a === 'string' && a.trim()) : undefined,
        areaSettingsByArea: settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : undefined,
    };
}

export function removeLegacyDesignKeys(storage = window.localStorage) {
    LEGACY_DESIGN_KEYS.forEach((k) => storage.removeItem(k));
}
