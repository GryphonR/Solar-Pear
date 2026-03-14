import fs from 'fs/promises';
import path from 'path';
import process from 'process';

// --- CONFIGURATION ---
const CONTROLLERS_DIR = path.join(process.cwd(), 'src/data/controllers');
const LOG_FILE = path.join(process.cwd(), `controller_processing_log_${Date.now()}.txt`);
const CONCURRENCY_LIMIT = 5; 
const FETCH_TIMEOUT_MS = 10000; 

// Check for command line arguments
const SKIP_URL_CHECKS = process.argv.includes('--nourl');

const SCHEMA_ORDER = [
    "id", "name", "manufacturer", "modelNumber", "type", "systemType", 
    "systemVoltages", "maxV", "maxIsc", "maxOperatingI", "mpptRangeMin", 
    "mpptRangeMax", "vNominal", "startupV", "v_start_vbat_dependent", 
    "trackers", "price", "MaxACPower", "MaxDCPower", "islanding", 
    "notes", "datasheetUrl", "buyLinks", "availableUK", "g98_cert", "g99_cert", 
    "g100_cert", "off_grid", "pure_off_grid_native", "eps", "house_backup", 
    "three_phase", "reviewed"
];

const DEFAULT_VALUES = {
    "notes": "",
    "reviewed": false,
    "availableUK": true,
    "g98_cert": false,
    "g99_cert": false,
    "g100_cert": false,
    "off_grid": false,
    "pure_off_grid_native": false,
    "eps": false,
    "house_backup": false,
    "three_phase": false,
    "islanding": false,
    "v_start_vbat_dependent": false,
    "buyLinks": []
};

// Fields where an empty string is perfectly valid and shouldn't trigger a log warning
const ALLOWED_EMPTY_STRINGS = [
    "notes"
];

// --- UTILITY FUNCTIONS ---

function normalizeBuyLinks(buyLinks) {
    if (Array.isArray(buyLinks)) {
        return buyLinks.map(link => ({
            ...link,
            isAffiliate: link.isAffiliate || false,
            Checked: link.hasOwnProperty('Checked') ? link.Checked : false
        }));
    }
    if (typeof buyLinks === 'object' && buyLinks !== null) {
        return Object.entries(buyLinks).map(([supplier, url]) => ({
            Supplier: supplier,
            URL: url,
            isAffiliate: false,
            Checked: false
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
    let logOutput = "=== SOLAR CONTROLLER PROCESSING LOG ===\n\n";
    
    const missingFieldsLog = {};
    const zeroValuesLog = [];
    const emptyStringsLog = [];
    const nonPdfDatasheetsLog = [];
    
    const urlToControllersMap = new Map();

    function addUrlContext(url, manufacturer, modelNumber) {
        if (!url) return;
        if (!urlToControllersMap.has(url)) {
            urlToControllersMap.set(url, []);
        }
        const identifier = `${manufacturer || 'Unknown Mfr'} (${modelNumber || 'Unknown Model'})`;
        const currentList = urlToControllersMap.get(url);
        if (!currentList.includes(identifier)) {
            currentList.push(identifier);
        }
    }

    try {
        const files = await fs.readdir(CONTROLLERS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const file of jsonFiles) {
            const filePath = path.join(CONTROLLERS_DIR, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let controllers = JSON.parse(fileData);
            let fileMissingFields = new Set();

            for (let i = 0; i < controllers.length; i++) {
                let controller = controllers[i];

                // 1. Missing fields check
                for (const key of SCHEMA_ORDER) {
                    if (!controller.hasOwnProperty(key)) {
                        controller[key] = DEFAULT_VALUES.hasOwnProperty(key) ? DEFAULT_VALUES[key] : null;
                        fileMissingFields.add(key);
                    }
                }

                // 2. Zero values and Empty Strings check
                for (const [key, value] of Object.entries(controller)) {
                    if (value === 0) {
                        // Controllers often have 0 for properties like maxV if it's an AC-coupled inverter
                        // Skip logging zero price for controllers not available in the UK
                        if (key === 'price' && controller.availableUK === false) {
                            continue;
                        }
                        zeroValuesLog.push(`${controller.manufacturer || 'Unknown'} - ${controller.modelNumber || controller.name || 'Unknown'}: Field '${key}' is 0`);
                    } else if (value === "" && !ALLOWED_EMPTY_STRINGS.includes(key)) {
                        emptyStringsLog.push(`${controller.manufacturer || 'Unknown'} - ${controller.modelNumber || controller.name || 'Unknown'}: Field '${key}' is empty ("")`);
                    }
                }

                // 4. Datasheet PDF check (ignoring query parameters)
                if (controller.datasheetUrl && typeof controller.datasheetUrl === 'string') {
                    const urlWithoutQuery = controller.datasheetUrl.split('?')[0].toLowerCase();
                    if (!urlWithoutQuery.endsWith('.pdf')) {
                        nonPdfDatasheetsLog.push(`${controller.manufacturer || 'Unknown'} - ${controller.modelNumber || controller.name || 'Unknown'}: URL is not a direct .pdf link (${controller.datasheetUrl})`);
                    }
                }

                controller.buyLinks = normalizeBuyLinks(controller.buyLinks);

                // 5. Collect URLs
                addUrlContext(controller.datasheetUrl, controller.manufacturer, controller.modelNumber || controller.name);
                if (controller.buyLinks && Array.isArray(controller.buyLinks)) {
                    controller.buyLinks.forEach(link => {
                        addUrlContext(link.URL, controller.manufacturer, controller.modelNumber || controller.name);
                    });
                }

                controllers[i] = reorderKeys(controller);
            }

            // 6. Sort Array by Model Number
            controllers.sort((a, b) => {
                const modelA = a.modelNumber || a.name || "";
                const modelB = b.modelNumber || b.name || "";
                return modelA.localeCompare(modelB);
            });

            await fs.writeFile(filePath, JSON.stringify(controllers, null, 4));

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
            const uniqueUrls = Array.from(urlToControllersMap.keys());
            console.log(`Checking ${uniqueUrls.length} unique URLs in batches of ${CONCURRENCY_LIMIT}...`);
            
            let brokenLinksFound = false;

            for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY_LIMIT) {
                const batch = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);
                
                const batchPromises = batch.map(async (url) => {
                    const result = await checkUrl(url);
                    if (!result.ok) {
                        const affectedControllers = urlToControllersMap.get(url).join(', ');
                        logOutput += `URL: ${url}\n`;
                        logOutput += `Status: ${result.status}\n`;
                        logOutput += `Affected Controllers: ${affectedControllers}\n\n`;
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
