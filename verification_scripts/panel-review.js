/**
 * @file panel-review.js
 * Schema normalize + structural audit for `src/data/panels/*.json`.
 *
 * Usage: node verification_scripts/panel-review.js [--nourl]
 */

import { pathToFileURL } from 'url';
import process from 'process';
import { PANELS_DIR, PANELS_SCHEMA_PATH } from './lib/paths.js';
import { runReview } from './lib/reviewCore.js';

export async function run() {
    await runReview({
        dataDir: PANELS_DIR,
        schemaPath: PANELS_SCHEMA_PATH,
        logPrefix: 'panel_processing_log',
        logTitle: 'SOLAR PANEL PROCESSING LOG',
        affectedLabel: 'Affected Panels',
        formatEntryId: (panel) =>
            `${panel.manufacturer || 'Unknown'} - ${panel.model || 'Unknown'}`,
        sortEntries: (a, b) => {
            const seriesA = a['panel-series'] || '';
            const seriesB = b['panel-series'] || '';
            if (seriesA < seriesB) return -1;
            if (seriesA > seriesB) return 1;
            return (a.power || 0) - (b.power || 0);
        },
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
