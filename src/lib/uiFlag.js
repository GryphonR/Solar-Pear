/**
 * Feature flag for the UX overhaul (roadmap phase 13). The old UI stays the default until 13.9.
 * Switch on with `?ui=next` (remembered in localStorage) and off with `?ui=old`. `?ui=kit` opens the
 * component gallery for the current session only.
 */
const STORAGE_KEY = 'solar_ui';

/** @returns {'old'|'next'|'kit'} */
export function getUiMode(search = globalThis.location?.search ?? '') {
    const asked = new URLSearchParams(search).get('ui');
    if (asked === 'kit') return 'kit';
    try {
        if (asked === 'next' || asked === 'old') {
            globalThis.localStorage?.setItem(STORAGE_KEY, asked);
            return asked;
        }
        return globalThis.localStorage?.getItem(STORAGE_KEY) === 'next' ? 'next' : 'old';
    } catch {
        return asked === 'next' ? 'next' : 'old';
    }
}
