/**
 * @file reviewCore.js
 * Shared schema-normalize + link-audit loop for panel and controller review scripts.
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { normalizeBuyLinks } from './buyLinks.js';
import { LOGS_DIR } from './paths.js';
import { checkUrl } from './urlQuality.js';

const CONCURRENCY_LIMIT = 5;

/**
 * Reorders object keys to match schema fieldOrder, appending any extras at the end.
 * @param {object} obj
 * @param {string[]} schemaOrder
 */
export function reorderKeys(obj, schemaOrder) {
    const orderedObj = {};
    for (const key of schemaOrder) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            orderedObj[key] = obj[key];
        }
    }
    for (const key in obj) {
        if (!schemaOrder.includes(key)) {
            orderedObj[key] = obj[key];
        }
    }
    return orderedObj;
}

/**
 * @param {object} entry
 * @param {{ field: string, equals: unknown }} when
 */
export function matchesWhen(entry, when) {
    return Object.prototype.hasOwnProperty.call(entry, when.field)
        ? entry[when.field] === when.equals
        : when.equals === undefined;
}

/**
 * @param {object} entry
 * @param {string} field
 * @param {Array<{ field: string, when: { field: string, equals: unknown } }>} zeroValueSkips
 */
export function shouldSkipZero(entry, field, zeroValueSkips) {
    for (const r of zeroValueSkips || []) {
        if (r.field === field && matchesWhen(entry, r.when)) return true;
    }
    return false;
}

/**
 * Runs schema fill, structural reports, optional URL checks, and in-place JSON writes.
 *
 * @param {object} config
 * @param {string} config.dataDir
 * @param {string} config.schemaPath
 * @param {string} config.logPrefix e.g. `panel_processing_log`
 * @param {string} config.logTitle e.g. `SOLAR PANEL PROCESSING LOG`
 * @param {string} config.affectedLabel e.g. `Affected Panels`
 * @param {(entry: object) => string} config.formatEntryId
 * @param {(a: object, b: object) => number} config.sortEntries
 * @param {(entry: object, schema: object) => void} [config.afterFill] optional per-entry hook (e.g. name standardize, typeAssertions)
 * @param {boolean} [config.skipUrlChecks]
 */
export async function runReview(config) {
    const {
        dataDir,
        schemaPath,
        logPrefix,
        logTitle,
        affectedLabel,
        formatEntryId,
        sortEntries,
        afterFill,
        skipUrlChecks = process.argv.includes('--nourl'),
    } = config;

    let logOutput = `=== ${logTitle} ===\n\n`;

    const missingFieldsLog = {};
    const zeroValuesLog = [];
    const emptyStringsLog = [];
    const nonPdfDatasheetsLog = [];
    const urlToEntriesMap = new Map();

    function addUrlContext(url, entry) {
        if (!url) return;
        if (!urlToEntriesMap.has(url)) {
            urlToEntriesMap.set(url, []);
        }
        const identifier = formatEntryId(entry);
        const currentList = urlToEntriesMap.get(url);
        if (!currentList.includes(identifier)) {
            currentList.push(identifier);
        }
    }

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `${logPrefix}_${Date.now()}.txt`);

        const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
        const SCHEMA_ORDER = schema.fieldOrder;
        const DEFAULT_VALUES = schema.defaults || {};
        const ALLOWED_EMPTY_STRINGS = schema.rules?.allowedEmptyStrings || [];
        const zeroValueSkips = schema.rules?.zeroValueSkips || [];
        const typeAssertions = schema.rules?.typeAssertions || [];
        const standardizeNameFrom = schema.rules?.standardizeNameFrom;

        const files = await fs.readdir(dataDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));

        for (const file of jsonFiles) {
            const filePath = path.join(dataDir, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let entries = JSON.parse(fileData);
            let fileMissingFields = new Set();

            for (let i = 0; i < entries.length; i++) {
                let entry = entries[i];

                for (const key of SCHEMA_ORDER) {
                    if (!Object.prototype.hasOwnProperty.call(entry, key)) {
                        entry[key] = Object.prototype.hasOwnProperty.call(DEFAULT_VALUES, key)
                            ? DEFAULT_VALUES[key]
                            : null;
                        fileMissingFields.add(key);
                    }
                }

                for (const [key, value] of Object.entries(entry)) {
                    if (value === 0) {
                        if (shouldSkipZero(entry, key, zeroValueSkips)) continue;
                        zeroValuesLog.push(`${formatEntryId(entry)}: Field '${key}' is 0`);
                    } else if (value === '' && !ALLOWED_EMPTY_STRINGS.includes(key)) {
                        emptyStringsLog.push(`${formatEntryId(entry)}: Field '${key}' is empty ("")`);
                    }
                }

                // Schema-driven type assertions (e.g. charger ⇒ MaxACPower === 0).
                for (const ta of typeAssertions) {
                    if (!matchesWhen(entry, ta.when)) continue;
                    for (const a of ta.assert || []) {
                        if (entry[a.field] !== a.equals) {
                            const detail = a.message || `${a.field} must be ${JSON.stringify(a.equals)}`;
                            zeroValuesLog.push(`[ERROR] ${formatEntryId(entry)}: ${detail}`);
                        }
                    }
                }

                // Panel-style name rebuild from manufacturer + series + power.
                if (
                    standardizeNameFrom?.length === 3 &&
                    entry[standardizeNameFrom[0]] &&
                    entry[standardizeNameFrom[1]] &&
                    entry[standardizeNameFrom[2]] != null
                ) {
                    const [mf, series, pow] = standardizeNameFrom;
                    entry.name = `${String(entry[mf]).trim()} ${String(entry[series]).trim()} ${entry[pow]}W`;
                }

                afterFill?.(entry, schema);

                if (entry.datasheetUrl && typeof entry.datasheetUrl === 'string') {
                    const urlWithoutQuery = entry.datasheetUrl.split('?')[0].toLowerCase();
                    if (!urlWithoutQuery.endsWith('.pdf')) {
                        nonPdfDatasheetsLog.push(
                            `${formatEntryId(entry)}: URL is not a direct .pdf link (${entry.datasheetUrl})`
                        );
                    }
                }

                entry.buyLinks = normalizeBuyLinks(entry.buyLinks);

                addUrlContext(entry.datasheetUrl, entry);
                entry.buyLinks.forEach((link) => {
                    addUrlContext(link.URL, entry);
                });

                entries[i] = reorderKeys(entry, SCHEMA_ORDER);
            }

            entries.sort(sortEntries);

            await fs.writeFile(filePath, JSON.stringify(entries, null, 4));

            if (fileMissingFields.size > 0) {
                missingFieldsLog[file] = Array.from(fileMissingFields);
            }
        }

        logOutput += '--- MISSING FIELDS ADDED ---\n';
        if (Object.keys(missingFieldsLog).length === 0) {
            logOutput += 'No missing fields found in any files.\n';
        } else {
            for (const [file, fields] of Object.entries(missingFieldsLog)) {
                logOutput += `${file}: ${fields.join(', ')}\n`;
            }
        }
        logOutput += '\n';

        logOutput += '--- ZERO VALUES FOUND ---\n';
        if (zeroValuesLog.length === 0) {
            logOutput += 'No fields with a value of 0 found.\n';
        } else {
            zeroValuesLog.forEach((logLine) => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += '\n';

        logOutput += '--- EMPTY STRINGS FOUND ---\n';
        if (emptyStringsLog.length === 0) {
            logOutput += 'No unexpected empty string fields found.\n';
        } else {
            emptyStringsLog.forEach((logLine) => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += '\n';

        logOutput += '--- NON-PDF DATASHEET URLs ---\n';
        if (nonPdfDatasheetsLog.length === 0) {
            logOutput += 'All datasheet URLs end in .pdf.\n';
        } else {
            nonPdfDatasheetsLog.forEach((logLine) => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += '\n';

        logOutput += '--- BROKEN LINKS (Non-200 Responses or Timeouts) ---\n';

        if (skipUrlChecks) {
            console.log('Skipping URL checks because --nourl flag was provided.');
            logOutput += 'URL checking was skipped via the --nourl command line flag.\n';
        } else {
            const uniqueUrls = Array.from(urlToEntriesMap.keys());
            console.log(`Checking ${uniqueUrls.length} unique URLs in batches of ${CONCURRENCY_LIMIT}...`);

            let brokenLinksFound = false;

            for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY_LIMIT) {
                const batch = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);

                const batchPromises = batch.map(async (url) => {
                    const result = await checkUrl(url);
                    if (!result.ok) {
                        const affected = urlToEntriesMap.get(url).join(', ');
                        logOutput += `URL: ${url}\n`;
                        logOutput += `Status: ${result.status}\n`;
                        logOutput += `${affectedLabel}: ${affected}\n\n`;
                        brokenLinksFound = true;
                    }
                });

                await Promise.allSettled(batchPromises);
                await new Promise((resolve) => setTimeout(resolve, 500));

                process.stdout.write(
                    `\rProcessed ${Math.min(i + CONCURRENCY_LIMIT, uniqueUrls.length)} / ${uniqueUrls.length} URLs`
                );
            }
            console.log('\nURL checking complete.');

            if (!brokenLinksFound) {
                logOutput += 'All links returned 200 OK.\n';
            }
        }

        await fs.writeFile(LOG_FILE, logOutput);
        console.log(`Process complete. Log saved to: ${LOG_FILE}`);
    } catch (error) {
        console.error('A fatal error occurred:', error);
    }
}
