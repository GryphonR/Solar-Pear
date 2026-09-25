/**
 * Catalogue persistence as user overrides (roadmap 2.1).
 *
 * The bundled panel/controller catalogue ships with the app and changes with every release. Only
 * what the user changed is stored: per-item field overrides for bundled items, whole user-added
 * items, and bundled items the user removed. On load the overrides are applied over the current
 * bundled catalogue, so refreshed prices and specs reach returning users unless they edited them.
 */

/** Current localStorage key. Replaces the legacy full-array keys solar_panels / solar_chargers. */
export const CATALOGUE_OVERRIDES_KEY = 'solar_catalogue_overrides';
export const LEGACY_PANELS_KEY = 'solar_panels';
export const LEGACY_CHARGERS_KEY = 'solar_chargers';

/** Stable id field per catalogue kind. */
export const CATALOGUE_ID_KEY = { panels: 'model', chargers: 'id' };

/**
 * Fields the legacy merge preserved from the saved copy (everything else was re-read from the
 * bundle on every load), so these are the only legacy fields that can hold user edits.
 */
const LEGACY_EDITABLE_FIELDS = {
    panels: ['price', 'active', 'gseCompatibility'],
    chargers: ['price', 'notes', 'active'],
};

export const emptyCatalogueDiff = () => ({ overrides: {}, custom: [], removed: [] });

const sameValue = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Computes what differs between the in-app catalogue and the bundled one.
 * @param {object[]} current - Catalogue as shown in the app (bundled + edits + custom items)
 * @param {object[]} bundled - Catalogue shipped with this build
 * @param {string} idKey - 'model' for panels, 'id' for controllers
 * @returns {{ overrides: Record<string, object>, custom: object[], removed: string[] }}
 */
export function diffCatalogue(current, bundled, idKey) {
    const bundledById = new Map(bundled.map((item) => [item[idKey], item]));
    const currentIds = new Set();
    const overrides = {};
    const custom = [];
    for (const item of Array.isArray(current) ? current : []) {
        if (!item || typeof item !== 'object') continue;
        const id = item[idKey];
        currentIds.add(id);
        const base = bundledById.get(id);
        if (!base) {
            custom.push(item);
            continue;
        }
        const changed = {};
        for (const [field, value] of Object.entries(item)) {
            if (!sameValue(value, base[field])) changed[field] = value;
        }
        if (Object.keys(changed).length) overrides[id] = changed;
    }
    const removed = bundled.map((item) => item[idKey]).filter((id) => !currentIds.has(id));
    return { overrides, custom, removed };
}

/**
 * Rebuilds the in-app catalogue from the bundled one plus a stored diff.
 * Overrides for items no longer in the bundle are dropped; custom items whose id now clashes
 * with a bundled item are dropped in favour of the bundled record.
 */
export function applyCatalogue(bundled, diff, idKey) {
    const overrides = diff?.overrides && typeof diff.overrides === 'object' ? diff.overrides : {};
    const removed = new Set(Array.isArray(diff?.removed) ? diff.removed : []);
    const bundledIds = new Set(bundled.map((item) => item[idKey]));
    const merged = bundled
        .filter((item) => !removed.has(item[idKey]))
        .map((item) => {
            const o = overrides[item[idKey]];
            return o && typeof o === 'object' ? { ...item, ...o, [idKey]: item[idKey] } : item;
        });
    for (const item of Array.isArray(diff?.custom) ? diff.custom : []) {
        if (item && typeof item === 'object' && item[idKey] != null && !bundledIds.has(item[idKey])) {
            merged.push(item);
        }
    }
    return merged;
}

/**
 * Converts a legacy full-catalogue snapshot (old localStorage or backup ≤ v4) into a diff.
 *
 * The legacy format cannot distinguish a user's price edit from a price that was simply stale when
 * saved. A saved price that differs from the bundle is kept only when the bundled record has not
 * been re-priced since the snapshot (same `priceCheckedAt`), which means the difference can only
 * be a user edit. Otherwise the refreshed bundled price wins and the edit is counted as dropped.
 * Legacy controller `notes` differences are dropped the same way (personal notes live in userNotes).
 *
 * @param {unknown} saved - Parsed legacy array
 * @param {object[]} bundled
 * @param {'panels'|'chargers'} kind
 * @returns {{ diff: ReturnType<typeof emptyCatalogueDiff>, droppedEdits: number }}
 */
export function migrateLegacyCatalogue(saved, bundled, kind) {
    const idKey = CATALOGUE_ID_KEY[kind];
    const diff = emptyCatalogueDiff();
    let droppedEdits = 0;
    if (!Array.isArray(saved)) return { diff, droppedEdits };
    const bundledById = new Map(bundled.map((item) => [item[idKey], item]));
    for (const item of saved) {
        if (!item || typeof item !== 'object' || item[idKey] == null) continue;
        const base = bundledById.get(item[idKey]);
        if (!base) {
            diff.custom.push(item);
            continue;
        }
        const changed = {};
        for (const field of LEGACY_EDITABLE_FIELDS[kind]) {
            if (!(field in item) || sameValue(item[field], base[field])) continue;
            if (field === 'price') {
                const unchangedSinceSnapshot =
                    (item.priceCheckedAt || '') !== '' && item.priceCheckedAt === base.priceCheckedAt;
                if (!unchangedSinceSnapshot) {
                    droppedEdits++;
                    continue;
                }
            }
            if (field === 'notes') {
                droppedEdits++;
                continue;
            }
            changed[field] = item[field];
        }
        if (Object.keys(changed).length) diff.overrides[item[idKey]] = changed;
    }
    return { diff, droppedEdits };
}

/** Validates the shape of a stored/imported diff; returns null when unusable. */
export function sanitizeCatalogueDiff(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
        overrides:
            value.overrides && typeof value.overrides === 'object' && !Array.isArray(value.overrides)
                ? value.overrides
                : {},
        custom: Array.isArray(value.custom) ? value.custom.filter((x) => x && typeof x === 'object') : [],
        removed: Array.isArray(value.removed) ? value.removed.filter((x) => typeof x === 'string') : [],
    };
}

/** Version of the app's localStorage layout. 1 = full catalogue arrays; 2 = catalogue overrides. */
export const STORAGE_VERSION_KEY = 'solar_storage_version';
export const STORAGE_VERSION = 2;

const readJson = (storage, key) => {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
};

/**
 * Loads the in-app catalogue from localStorage, migrating the legacy full-array keys (storage v1)
 * to the overrides format (v2) on first run. Legacy keys are removed once migrated.
 * @returns {{ panels: object[], chargers: object[], droppedEdits: number, migrated: boolean }}
 */
export function loadCatalogueFromStorage(bundledPanels, bundledChargers, storage = window.localStorage) {
    const doc = readJson(storage, CATALOGUE_OVERRIDES_KEY);
    const hasLegacy =
        storage.getItem(LEGACY_PANELS_KEY) != null || storage.getItem(LEGACY_CHARGERS_KEY) != null;
    if ((doc && typeof doc === 'object') || !hasLegacy) {
        return {
            panels: applyCatalogue(bundledPanels, sanitizeCatalogueDiff(doc?.panels), CATALOGUE_ID_KEY.panels),
            chargers: applyCatalogue(bundledChargers, sanitizeCatalogueDiff(doc?.chargers), CATALOGUE_ID_KEY.chargers),
            droppedEdits: 0,
            migrated: false,
        };
    }
    const p = migrateLegacyCatalogue(readJson(storage, LEGACY_PANELS_KEY), bundledPanels, 'panels');
    const c = migrateLegacyCatalogue(readJson(storage, LEGACY_CHARGERS_KEY), bundledChargers, 'chargers');
    saveCatalogueToStorage({ panels: p.diff, chargers: c.diff }, storage);
    storage.removeItem(LEGACY_PANELS_KEY);
    storage.removeItem(LEGACY_CHARGERS_KEY);
    return {
        panels: applyCatalogue(bundledPanels, p.diff, CATALOGUE_ID_KEY.panels),
        chargers: applyCatalogue(bundledChargers, c.diff, CATALOGUE_ID_KEY.chargers),
        droppedEdits: p.droppedEdits + c.droppedEdits,
        migrated: true,
    };
}

/** Builds the stored/exported overrides document for the current in-app catalogue. */
export function buildCatalogueOverrides(panels, chargers, bundledPanels, bundledChargers) {
    return {
        panels: diffCatalogue(panels, bundledPanels, CATALOGUE_ID_KEY.panels),
        chargers: diffCatalogue(chargers, bundledChargers, CATALOGUE_ID_KEY.chargers),
    };
}

/** Writes the overrides document and storage version. Throws when storage is full or unavailable. */
export function saveCatalogueToStorage(doc, storage = window.localStorage) {
    storage.setItem(CATALOGUE_OVERRIDES_KEY, JSON.stringify(doc));
    storage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
}
