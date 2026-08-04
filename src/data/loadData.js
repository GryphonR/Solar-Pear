/**
 * Loads panels and controllers from per-manufacturer JSON files.
 * Add a new file in panels/ or controllers/ to include more data - no code changes needed.
 */
import { compareByManufacturerSeriesPower } from '../lib/panelSeries';

const panelModules = import.meta.glob('./panels/*.json', { eager: true });
const chargerModules = import.meta.glob('./controllers/*.json', { eager: true });

export const initialPanels = Object.values(panelModules)
    .flatMap((m) => m.default)
    .sort(compareByManufacturerSeriesPower);

export const initialChargers = Object.values(chargerModules)
    .flatMap((m) => m.default)
    .sort(
        (a, b) =>
            (a.manufacturer || '').localeCompare(b.manufacturer || '') ||
            (a.id || '').localeCompare(b.id || '')
    );
