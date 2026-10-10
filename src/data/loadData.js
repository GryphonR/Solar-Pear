/**
 * Loads panels and controllers from per-manufacturer JSON files.
 * Add a new file in panels/ or controllers/ to include more data - no code changes needed.
 * Buy links get affiliate URLs from the rules in affiliates.json (roadmap 4.5); the JSON files
 * themselves keep canonical product URLs only.
 */
import { compareByManufacturerSeriesPower } from '../lib/panelSeries';
import { applyAffiliateRulesToCatalogue } from '../lib/affiliateLinks';
import affiliates from './affiliates.json';

const panelModules = import.meta.glob('./panels/*.json', { eager: true });
const chargerModules = import.meta.glob('./controllers/*.json', { eager: true });

export const initialPanels = applyAffiliateRulesToCatalogue(
    Object.values(panelModules).flatMap((m) => m.default),
    affiliates.programmes
).sort(compareByManufacturerSeriesPower);

export const initialChargers = applyAffiliateRulesToCatalogue(
    Object.values(chargerModules).flatMap((m) => m.default),
    affiliates.programmes
).sort(
    (a, b) =>
        (a.manufacturer || '').localeCompare(b.manufacturer || '') ||
        (a.id || '').localeCompare(b.id || '')
);
