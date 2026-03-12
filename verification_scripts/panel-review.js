import fs from 'fs/promises';
import path from 'path';
import process from 'process';

// --- CONFIGURATION ---
const PANELS_DIR = path.join(process.cwd(), 'src/data/panels');
const LOG_FILE = path.join(process.cwd(), `panel_processing_log_${Date.now()}.txt`);
const CONCURRENCY_LIMIT = 5; 
const FETCH_TIMEOUT_MS = 10000; 

// Check for command line arguments
const SKIP_URL_CHECKS = process.argv.includes('--nourl');

const SCHEMA_ORDER = [
    "name", "model", "manufacturer", "panel-series", "height", "width", "depth", "weight",
    "glass", "bifacial", "power", "voc", "vmp", "isc", "imp", "price", "efficiency",
    "tempCoefPmax", "tempCoefVoc", "tempCoefIsc", "maxSeriesFuse", "maxSystemVoltage",
    "cells", "gseCompatibility", "datasheetUrl", "notes", "buyLinks", "active", "reviewed", "availableUK"
];

const DEFAULT_VALUES = {
    "panel-series": "",
    "reviewed": false,
    "notes": "",
    "active": false,
    "gseCompatibility": "None",
    "availableUK": true
};

// Fields where an empty string is perfectly valid and shouldn't trigger a log warning
const ALLOWED_EMPTY_STRINGS = [
    "notes",
    // "panel-series" // Added this as some manufacturers might not use series designations
];

// --- UTILITY FUNCTIONS ---

function normalizeBuyLinks(buyLinks) {
    if (Array.isArray(buyLinks)) return buyLinks;
    if (typeof buyLinks === 'object' && buyLinks !== null) {
        return Object.entries(buyLinks).map(([supplier, url]) => ({
            Supplier: supplier,
            URL: url,
            isAffiliate: false
        }));
    }
    return [];
}

function reorderKeys(obj) {
    const orderedObj = {};
    for (const key of SCHEMA_ORDER) {
        if (obj.hasOwnProperty(key)) {
            orderedObj[key] = obj[key];
        }
    }
    for (const key in obj) {
        if (!SCHEMA_ORDER.includes(key)) {
            orderedObj[key] = obj[key];
        }
    }
    return orderedObj;
}

async function checkUrl(url) {
    if (!url) return { ok: false, status: 'No URL' };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return { 
            ok: response.status === 200, 
            status: response.status 
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return { ok: false, status: 'Timeout (10s)' };
        }
        return { ok: false, status: `Fetch Error: ${error.message || 'Unknown'}` };
    }
}

// --- MAIN PROCESS ---

async function run() {
    let logOutput = "=== SOLAR PANEL PROCESSING LOG ===\n\n";
    
    const missingFieldsLog = {};
    const zeroValuesLog = [];
    const emptyStringsLog = [];
    const nonPdfDatasheetsLog = [];
    
    const urlToPanelsMap = new Map();

    function addUrlContext(url, manufacturer, model) {
        if (!url) return;
        if (!urlToPanelsMap.has(url)) {
            urlToPanelsMap.set(url, []);
        }
        const identifier = `${manufacturer || 'Unknown Mfr'} (${model || 'Unknown Model'})`;
        const currentList = urlToPanelsMap.get(url);
        if (!currentList.includes(identifier)) {
            currentList.push(identifier);
        }
    }

    try {
        const files = await fs.readdir(PANELS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const file of jsonFiles) {
            const filePath = path.join(PANELS_DIR, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let panels = JSON.parse(fileData);
            let fileMissingFields = new Set();

            for (let i = 0; i < panels.length; i++) {
                let panel = panels[i];

                // 1. Missing fields check
                for (const key of SCHEMA_ORDER) {
                    if (!panel.hasOwnProperty(key)) {
                        panel[key] = DEFAULT_VALUES.hasOwnProperty(key) ? DEFAULT_VALUES[key] : null;
                        fileMissingFields.add(key);
                    }
                }

                // 2. Zero values and Empty Strings check
                for (const [key, value] of Object.entries(panel)) {
                    if (value === 0) {
                        // Skip logging zero price for panels not available in the UK
                        if (key === 'price' && panel.availableUK === false) {
                            continue;
                        }
                        zeroValuesLog.push(`${panel.manufacturer || 'Unknown'} - ${panel.model || 'Unknown'}: Field '${key}' is 0`);
                    } else if (value === "" && !ALLOWED_EMPTY_STRINGS.includes(key)) {
                        emptyStringsLog.push(`${panel.manufacturer || 'Unknown'} - ${panel.model || 'Unknown'}: Field '${key}' is empty ("")`);
                    }
                }

                // 3. Standardise Name
                if (panel.manufacturer && panel['panel-series'] && panel.power) {
                    panel.name = `${panel.manufacturer.trim()} ${panel['panel-series'].trim()} ${panel.power}W`;
                }

                // 4. Datasheet PDF check (ignoring query parameters)
                if (panel.datasheetUrl && typeof panel.datasheetUrl === 'string') {
                    const urlWithoutQuery = panel.datasheetUrl.split('?')[0].toLowerCase();
                    if (!urlWithoutQuery.endsWith('.pdf')) {
                        nonPdfDatasheetsLog.push(`${panel.manufacturer || 'Unknown'} - ${panel.model || 'Unknown'}: URL is not a direct .pdf link (${panel.datasheetUrl})`);
                    }
                }

                panel.buyLinks = normalizeBuyLinks(panel.buyLinks);

                // 5. Collect URLs
                addUrlContext(panel.datasheetUrl, panel.manufacturer, panel.model);
                panel.buyLinks.forEach(link => {
                    addUrlContext(link.URL, panel.manufacturer, panel.model);
                });

                panels[i] = reorderKeys(panel);
            }

            // 6. Sort Array by Series, then Power
            panels.sort((a, b) => {
                const seriesA = a['panel-series'] || "";
                const seriesB = b['panel-series'] || "";
                if (seriesA < seriesB) return -1;
                if (seriesA > seriesB) return 1;
                return (a.power || 0) - (b.power || 0);
            });

            await fs.writeFile(filePath, JSON.stringify(panels, null, 4));

            if (fileMissingFields.size > 0) {
                missingFieldsLog[file] = Array.from(fileMissingFields);
            }
        }

        // --- Log Missing Fields ---
        logOutput += "--- MISSING FIELDS ADDED ---\n";
        if (Object.keys(missingFieldsLog).length === 0) {
            logOutput += "No missing fields found in any files.\n";
        } else {
            for (const [file, fields] of Object.entries(missingFieldsLog)) {
                logOutput += `${file}: ${fields.join(', ')}\n`;
            }
        }
        logOutput += "\n";

        // --- Log Zero Values ---
        logOutput += "--- ZERO VALUES FOUND ---\n";
        if (zeroValuesLog.length === 0) {
            logOutput += "No fields with a value of 0 found.\n";
        } else {
            zeroValuesLog.forEach(logLine => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += "\n";

        // --- Log Empty Strings ---
        logOutput += "--- EMPTY STRINGS FOUND ---\n";
        if (emptyStringsLog.length === 0) {
            logOutput += "No unexpected empty string fields found.\n";
        } else {
            emptyStringsLog.forEach(logLine => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += "\n";

        // --- Log Non-PDF Datasheets ---
        logOutput += "--- NON-PDF DATASHEET URLs ---\n";
        if (nonPdfDatasheetsLog.length === 0) {
            logOutput += "All datasheet URLs end in .pdf.\n";
        } else {
            nonPdfDatasheetsLog.forEach(logLine => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += "\n";

        // --- Check URLs ---
        logOutput += "--- BROKEN LINKS (Non-200 Responses or Timeouts) ---\n";
        
        if (SKIP_URL_CHECKS) {
            console.log("Skipping URL checks because --nourl flag was provided.");
            logOutput += "URL checking was skipped via the --nourl command line flag.\n";
        } else {
            const uniqueUrls = Array.from(urlToPanelsMap.keys());
            console.log(`Checking ${uniqueUrls.length} unique URLs in batches of ${CONCURRENCY_LIMIT}...`);
            
            let brokenLinksFound = false;

            for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY_LIMIT) {
                const batch = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);
                
                const batchPromises = batch.map(async (url) => {
                    const result = await checkUrl(url);
                    if (!result.ok) {
                        const affectedPanels = urlToPanelsMap.get(url).join(', ');
                        logOutput += `URL: ${url}\n`;
                        logOutput += `Status: ${result.status}\n`;
                        logOutput += `Affected Panels: ${affectedPanels}\n\n`;
                        brokenLinksFound = true;
                    }
                });

                await Promise.allSettled(batchPromises);
                await new Promise(resolve => setTimeout(resolve, 500)); 
                
                process.stdout.write(`\rProcessed ${Math.min(i + CONCURRENCY_LIMIT, uniqueUrls.length)} / ${uniqueUrls.length} URLs`);
            }
            console.log('\nURL checking complete.');

            if (!brokenLinksFound) {
                logOutput += "All links returned 200 OK.\n";
            }
        }

        await fs.writeFile(LOG_FILE, logOutput);
        console.log(`Process complete. Log saved to: ${LOG_FILE}`);

    } catch (error) {
        console.error("A fatal error occurred:", error);
    }
}

run();