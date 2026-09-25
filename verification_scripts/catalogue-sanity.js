/**
 * @file catalogue-sanity.js
 * Read-only catalogue sanity check (roadmap 3.2). Prints findings; exits 1 when any error is found.
 *
 *   npm run verify:sanity             # errors and warnings
 *   npm run verify:sanity -- --errors # errors only
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { PANELS_DIR, CONTROLLERS_DIR } from './lib/paths.js';
import { checkPanels, checkControllers, formatFindings } from './lib/sanityRules.js';

async function loadDir(dir) {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    const lists = await Promise.all(
        files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')))
    );
    return lists.flat();
}

const errorsOnly = process.argv.includes('--errors');
const findings = [
    ...checkPanels(await loadDir(PANELS_DIR)),
    ...checkControllers(await loadDir(CONTROLLERS_DIR)),
].filter((f) => !errorsOnly || f.severity === 'error');

for (const line of formatFindings(findings)) console.log(line);
const errors = findings.filter((f) => f.severity === 'error').length;
const warnings = findings.length - errors;
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exitCode = errors > 0 ? 1 : 0;
