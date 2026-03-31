import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PANELS_DIR = path.join(ROOT, "src/data/panels");
const SCHEMA_PATH = path.join(ROOT, "data-admin/schema/panels.schema.json");
const LOGS_DIR = path.join(ROOT, "logs");

const CONCURRENCY_LIMIT = 5;
const FETCH_TIMEOUT_MS = 10000;

const SKIP_URL_CHECKS = process.argv.includes("--nourl");

function normalizeBuyLinks(buyLinks) {
    if (Array.isArray(buyLinks)) {
        return buyLinks.map((link) => ({
            ...link,
            isAffiliate: link.isAffiliate || false,
            Checked: Object.prototype.hasOwnProperty.call(link, "Checked") ? link.Checked : false,
        }));
    }
    if (typeof buyLinks === "object" && buyLinks !== null) {
        return Object.entries(buyLinks).map(([supplier, url]) => ({
            Supplier: supplier,
            URL: url,
            isAffiliate: false,
            Checked: false,
        }));
    }
    return [];
}

function reorderKeys(obj, schemaOrder) {
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

function matchesWhen(entry, when) {
    return Object.prototype.hasOwnProperty.call(entry, when.field)
        ? entry[when.field] === when.equals
        : when.equals === undefined;
}

function shouldSkipZero(entry, field, zeroValueSkips) {
    for (const r of zeroValueSkips || []) {
        if (r.field === field && matchesWhen(entry, r.when)) return true;
    }
    return false;
}

async function checkUrl(url) {
    if (!url) return { ok: false, status: "No URL" };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return {
            ok: response.status === 200,
            status: response.status,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            return { ok: false, status: "Timeout (10s)" };
        }
        return { ok: false, status: `Fetch Error: ${error.message || "Unknown"}` };
    }
}

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
        const identifier = `${manufacturer || "Unknown Mfr"} (${model || "Unknown Model"})`;
        const currentList = urlToPanelsMap.get(url);
        if (!currentList.includes(identifier)) {
            currentList.push(identifier);
        }
    }

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `panel_processing_log_${Date.now()}.txt`);

        const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, "utf-8"));
        const SCHEMA_ORDER = schema.fieldOrder;
        const DEFAULT_VALUES = schema.defaults || {};
        const ALLOWED_EMPTY_STRINGS = schema.rules?.allowedEmptyStrings || [];
        const zeroValueSkips = schema.rules?.zeroValueSkips || [];
        const standardizeNameFrom = schema.rules?.standardizeNameFrom;

        const files = await fs.readdir(PANELS_DIR);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));

        for (const file of jsonFiles) {
            const filePath = path.join(PANELS_DIR, file);
            const fileData = await fs.readFile(filePath, "utf-8");
            let panels = JSON.parse(fileData);
            let fileMissingFields = new Set();

            for (let i = 0; i < panels.length; i++) {
                let panel = panels[i];

                for (const key of SCHEMA_ORDER) {
                    if (!Object.prototype.hasOwnProperty.call(panel, key)) {
                        panel[key] = Object.prototype.hasOwnProperty.call(DEFAULT_VALUES, key)
                            ? DEFAULT_VALUES[key]
                            : null;
                        fileMissingFields.add(key);
                    }
                }

                for (const [key, value] of Object.entries(panel)) {
                    if (value === 0) {
                        if (shouldSkipZero(panel, key, zeroValueSkips)) continue;
                        zeroValuesLog.push(
                            `${panel.manufacturer || "Unknown"} - ${panel.model || "Unknown"}: Field '${key}' is 0`
                        );
                    } else if (value === "" && !ALLOWED_EMPTY_STRINGS.includes(key)) {
                        emptyStringsLog.push(
                            `${panel.manufacturer || "Unknown"} - ${panel.model || "Unknown"}: Field '${key}' is empty ("")`
                        );
                    }
                }

                if (
                    standardizeNameFrom?.length === 3 &&
                    panel[standardizeNameFrom[0]] &&
                    panel[standardizeNameFrom[1]] &&
                    panel[standardizeNameFrom[2]] != null
                ) {
                    const [mf, series, pow] = standardizeNameFrom;
                    panel.name = `${String(panel[mf]).trim()} ${String(panel[series]).trim()} ${panel[pow]}W`;
                }

                if (panel.datasheetUrl && typeof panel.datasheetUrl === "string") {
                    const urlWithoutQuery = panel.datasheetUrl.split("?")[0].toLowerCase();
                    if (!urlWithoutQuery.endsWith(".pdf")) {
                        nonPdfDatasheetsLog.push(
                            `${panel.manufacturer || "Unknown"} - ${panel.model || "Unknown"}: URL is not a direct .pdf link (${panel.datasheetUrl})`
                        );
                    }
                }

                panel.buyLinks = normalizeBuyLinks(panel.buyLinks);

                addUrlContext(panel.datasheetUrl, panel.manufacturer, panel.model);
                panel.buyLinks.forEach((link) => {
                    addUrlContext(link.URL, panel.manufacturer, panel.model);
                });

                panels[i] = reorderKeys(panel, SCHEMA_ORDER);
            }

            panels.sort((a, b) => {
                const seriesA = a["panel-series"] || "";
                const seriesB = b["panel-series"] || "";
                if (seriesA < seriesB) return -1;
                if (seriesA > seriesB) return 1;
                return (a.power || 0) - (b.power || 0);
            });

            await fs.writeFile(filePath, JSON.stringify(panels, null, 4));

            if (fileMissingFields.size > 0) {
                missingFieldsLog[file] = Array.from(fileMissingFields);
            }
        }

        logOutput += "--- MISSING FIELDS ADDED ---\n";
        if (Object.keys(missingFieldsLog).length === 0) {
            logOutput += "No missing fields found in any files.\n";
        } else {
            for (const [file, fields] of Object.entries(missingFieldsLog)) {
                logOutput += `${file}: ${fields.join(", ")}\n`;
            }
        }
        logOutput += "\n";

        logOutput += "--- ZERO VALUES FOUND ---\n";
        if (zeroValuesLog.length === 0) {
            logOutput += "No fields with a value of 0 found.\n";
        } else {
            zeroValuesLog.forEach((logLine) => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += "\n";

        logOutput += "--- EMPTY STRINGS FOUND ---\n";
        if (emptyStringsLog.length === 0) {
            logOutput += "No unexpected empty string fields found.\n";
        } else {
            emptyStringsLog.forEach((logLine) => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += "\n";

        logOutput += "--- NON-PDF DATASHEET URLs ---\n";
        if (nonPdfDatasheetsLog.length === 0) {
            logOutput += "All datasheet URLs end in .pdf.\n";
        } else {
            nonPdfDatasheetsLog.forEach((logLine) => {
                logOutput += `${logLine}\n`;
            });
        }
        logOutput += "\n";

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
                        const affectedPanels = urlToPanelsMap.get(url).join(", ");
                        logOutput += `URL: ${url}\n`;
                        logOutput += `Status: ${result.status}\n`;
                        logOutput += `Affected Panels: ${affectedPanels}\n\n`;
                        brokenLinksFound = true;
                    }
                });

                await Promise.allSettled(batchPromises);
                await new Promise((resolve) => setTimeout(resolve, 500));

                process.stdout.write(
                    `\rProcessed ${Math.min(i + CONCURRENCY_LIMIT, uniqueUrls.length)} / ${uniqueUrls.length} URLs`
                );
            }
            console.log("\nURL checking complete.");

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
