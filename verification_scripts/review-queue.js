/**
 * @file review-queue.js
 * Human review programme helper (roadmap 3.3). Reports review coverage and lists unreviewed
 * products in priority order: sellable (has buy links) first, then UK availability, then those
 * with sanity warnings to resolve.
 *
 *   npm run verify:review-queue              # top 30
 *   npm run verify:review-queue -- --all
 *   npm run verify:review-queue -- --limit=50
 *
 * To record a review: set `reviewed: true`, `reviewedAt: "YYYY-MM-DD"` and `reviewedBy` on the
 * record after checking every spec against the datasheet (and `notesReviewed: true` if the notes
 * were checked or rewritten).
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { PANELS_DIR, CONTROLLERS_DIR } from './lib/paths.js';
import { checkPanels, checkControllers } from './lib/sanityRules.js';

/** Launch target from the roadmap: share of sellable products that are reviewed. */
const TARGET = 0.8;

async function loadDir(dir) {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    const lists = await Promise.all(
        files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')))
    );
    return lists.flat();
}

const hasLinks = (item) => Array.isArray(item.buyLinks) && item.buyLinks.length > 0;

/**
 * Priority score for an unreviewed item (higher = review sooner).
 * @param {object} item
 * @param {number} warningCount
 */
function reviewPriority(item, warningCount) {
    return (hasLinks(item) ? 100 : 0) + (item.availableUK !== false ? 10 : 0) + Math.min(warningCount, 5) * 5;
}

async function main() {
    const panels = await loadDir(PANELS_DIR);
    const controllers = await loadDir(CONTROLLERS_DIR);
    const warnings = new Map();
    for (const f of [...checkPanels(panels), ...checkControllers(controllers)]) {
        warnings.set(f.id, (warnings.get(f.id) || 0) + 1);
    }
    const items = [
        ...panels.map((p) => ({ kind: 'panel', id: p.model, name: p.name, item: p })),
        ...controllers.map((c) => ({ kind: 'controller', id: c.id, name: c.name, item: c })),
    ];

    const sellable = items.filter((x) => hasLinks(x.item));
    const reviewedSellable = sellable.filter((x) => x.item.reviewed).length;
    const reviewedAll = items.filter((x) => x.item.reviewed).length;
    const coverage = sellable.length ? reviewedSellable / sellable.length : 0;
    console.log(`Reviewed: ${reviewedAll} of ${items.length} products`);
    console.log(
        `Sellable (has buy links) reviewed: ${reviewedSellable} of ${sellable.length} (${(coverage * 100).toFixed(0)}%, launch target ${TARGET * 100}%)`
    );

    const all = process.argv.includes('--all');
    const limitArg = process.argv.find((a) => a.startsWith('--limit='));
    const limit = all ? Infinity : limitArg ? Number(limitArg.split('=')[1]) : 30;
    const queue = items
        .filter((x) => !x.item.reviewed)
        .map((x) => ({ ...x, score: reviewPriority(x.item, warnings.get(x.id) || 0) }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, limit);

    console.log(`\nNext ${queue.length} to review:`);
    for (const x of queue) {
        const w = warnings.get(x.id) ? ` [${warnings.get(x.id)} sanity warning(s)]` : '';
        console.log(`- ${x.kind.padEnd(10)} ${x.id}  ${x.name}${w}\n    ${x.item.datasheetUrl || '(no datasheet URL)'}`);
    }
}

await main();
