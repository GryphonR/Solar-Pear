/**
 * @file controller-review.js
 * Schema normalize + structural audit for `src/data/controllers/*.json`.
 *
 * Usage: node verification_scripts/controller-review.js [--nourl]
 */

import { pathToFileURL } from 'url';
import process from 'process';
import { CONTROLLERS_DIR, CONTROLLERS_SCHEMA_PATH } from './lib/paths.js';
import { runReview } from './lib/reviewCore.js';

export async function run() {
    await runReview({
        dataDir: CONTROLLERS_DIR,
        schemaPath: CONTROLLERS_SCHEMA_PATH,
        logPrefix: 'controller_processing_log',
        logTitle: 'SOLAR CONTROLLER PROCESSING LOG',
        affectedLabel: 'Affected Controllers',
        formatEntryId: (controller) =>
            `${controller.manufacturer || 'Unknown'} - ${controller.modelNumber || controller.name || 'Unknown'}`,
        sortEntries: (a, b) => {
            const modelA = a.modelNumber || a.name || '';
            const modelB = b.modelNumber || b.name || '';
            return modelA.localeCompare(modelB);
        },
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    run();
}
