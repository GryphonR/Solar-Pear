/**
 * @file paths.js
 * Shared filesystem roots and env/API-key bootstrap for verification scripts.
 */

import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (parent of `verification_scripts/`). */
export const ROOT = path.resolve(__dirname, '../..');

export const LOGS_DIR = path.join(ROOT, 'logs');
export const PANELS_DIR = path.join(ROOT, 'src/data/panels');
export const CONTROLLERS_DIR = path.join(ROOT, 'src/data/controllers');
export const PANELS_SCHEMA_PATH = path.join(ROOT, 'data-admin/schema/panels.schema.json');
export const CONTROLLERS_SCHEMA_PATH = path.join(ROOT, 'data-admin/schema/controllers.schema.json');
export const SERPER_SITES_PATH = path.join(ROOT, 'data-admin/config/serper-sites.json');

/**
 * Loads `./.env` into `process.env` when present (Node built-in; no dotenv dependency).
 * Safe to skip silently when CI/shells already export the needed vars.
 */
export function loadEnvFile() {
    try {
        process.loadEnvFile(path.join(ROOT, '.env'));
    } catch {
        // No .env file - fall back to whatever is already in the shell environment.
    }
}

/**
 * Resolves the Serper API key from `SERPER_API_KEY` or `--api=KEY` CLI fallback.
 * @param {string[]} [argv]
 * @returns {string | null}
 */
export function resolveSerperApiKey(argv = process.argv) {
    const apiArg = argv.find((arg) => arg.startsWith('--api='));
    return process.env.SERPER_API_KEY || (apiArg ? apiArg.split('=')[1] : null);
}

/**
 * Common CLI flags shared by pricing scans.
 * @param {string[]} [argv]
 */
export function parsePricingCliFlags(argv = process.argv) {
    const forceRecheck = argv.includes('--force') || argv.includes('-f');
    const skipStage2 = argv.includes('--nofetch');
    const manufacturerArg = argv.find((arg) => arg.startsWith('--manufacturer='));
    const manufacturerFilter = manufacturerArg ? manufacturerArg.split('=')[1].toLowerCase() : null;
    const priceStaleDays = Number(process.env.PRICE_STALE_DAYS) || 30;
    return { forceRecheck, skipStage2, manufacturerFilter, priceStaleDays };
}
