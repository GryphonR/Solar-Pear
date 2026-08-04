import { safeHttpUrl } from './safeUrl';

/**
 * Sanitize buyLinks (array or legacy object) to http(s) URLs only.
 * @param {unknown} buyLinks
 * @returns {unknown}
 */
export function sanitizeBuyLinks(buyLinks) {
    if (!buyLinks) return buyLinks;
    if (Array.isArray(buyLinks)) {
        return buyLinks
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const raw = entry.URL || entry.url;
                const url = safeHttpUrl(raw);
                if (!url) return null;
                return { ...entry, URL: url, url };
            })
            .filter(Boolean);
    }
    if (typeof buyLinks === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(buyLinks)) {
            const url = safeHttpUrl(v);
            if (url) out[k] = url;
        }
        return out;
    }
    return {};
}

/**
 * Sanitize a panel/charger-like object: datasheetUrl + buyLinks.
 */
export function sanitizeCatalogItem(item) {
    if (!item || typeof item !== 'object') return null;
    const next = { ...item };
    if (next.datasheetUrl != null && next.datasheetUrl !== '') {
        next.datasheetUrl = safeHttpUrl(next.datasheetUrl) || '';
    }
    if (next.buyLinks != null) {
        next.buyLinks = sanitizeBuyLinks(next.buyLinks);
    }
    return next;
}

/**
 * Validate and sanitize a backup payload before apply.
 * @param {unknown} imported
 * @returns {{ ok: true, data: object, warnings: string[] } | { ok: false, error: string }}
 */
export function validateBackupPayload(imported) {
    if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
        return { ok: false, error: 'Backup root must be a JSON object.' };
    }

    const warnings = [];
    const data = { ...imported };

    const requireArray = (key) => {
        if (data[key] === undefined) return true;
        if (!Array.isArray(data[key])) {
            warnings.push(`Ignored invalid "${key}" (expected array).`);
            delete data[key];
            return false;
        }
        return true;
    };

    requireArray('areasData');
    requireArray('arraysData');
    requireArray('panelsData');
    requireArray('chargersData');
    requireArray('siteControllers');

    if (data.areasData) {
        data.areasData = data.areasData.filter((a) => typeof a === 'string' && a.trim());
        if (data.areasData.length === 0) {
            return { ok: false, error: 'areasData must contain at least one area name.' };
        }
    }

    if (data.arraysData) {
        data.arraysData = data.arraysData
            .filter((a) => a && typeof a === 'object' && typeof a.id === 'string')
            .map((a) => ({
                ...a,
                count: Number.isFinite(Number(a.count)) ? Number(a.count) : a.count,
                parallelStrings: Number.isFinite(Number(a.parallelStrings))
                    ? Number(a.parallelStrings)
                    : a.parallelStrings,
            }));
    }

    if (data.panelsData) {
        data.panelsData = data.panelsData
            .map(sanitizeCatalogItem)
            .filter((p) => p && typeof p.model === 'string' && p.model);
    }

    if (data.chargersData) {
        data.chargersData = data.chargersData
            .map(sanitizeCatalogItem)
            .filter((c) => c && typeof c.id === 'string' && c.id);
    }

    if (data.siteControllers) {
        data.siteControllers = data.siteControllers.filter(
            (sc) => sc && typeof sc === 'object' && typeof sc.id === 'string'
        );
    }

    if (data.areaSettingsByArea !== undefined) {
        if (!data.areaSettingsByArea || typeof data.areaSettingsByArea !== 'object' || Array.isArray(data.areaSettingsByArea)) {
            warnings.push('Ignored invalid areaSettingsByArea.');
            delete data.areaSettingsByArea;
        }
    }

    if (data.userNotes !== undefined) {
        if (!data.userNotes || typeof data.userNotes !== 'object' || Array.isArray(data.userNotes)) {
            warnings.push('Ignored invalid userNotes.');
            delete data.userNotes;
        }
    }

    if (data.selections !== undefined) {
        if (!data.selections || typeof data.selections !== 'object' || Array.isArray(data.selections)) {
            warnings.push('Ignored invalid legacy selections.');
            delete data.selections;
        }
    }

    return { ok: true, data, warnings };
}
