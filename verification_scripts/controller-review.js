import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTROLLERS_DIR = path.join(ROOT, "src/data/controllers");
const SCHEMA_PATH = path.join(ROOT, "data-admin/schema/controllers.schema.json");
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
        const identifier = `${manufacturer || "Unknown Mfr"} (${modelNumber || "Unknown Model"})`;
        const currentList = urlToControllersMap.get(url);
        if (!currentList.includes(identifier)) {
            currentList.push(identifier);
        }
    }

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `controller_processing_log_${Date.now()}.txt`);

        const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, "utf-8"));
        const SCHEMA_ORDER = schema.fieldOrder;
        const DEFAULT_VALUES = schema.defaults || {};
        const ALLOWED_EMPTY_STRINGS = schema.rules?.allowedEmptyStrings || [];
        const zeroValueSkips = schema.rules?.zeroValueSkips || [];
        const typeAssertions = schema.rules?.typeAssertions || [];

        const files = await fs.readdir(CONTROLLERS_DIR);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));

        for (const file of jsonFiles) {
            const filePath = path.join(CONTROLLERS_DIR, file);
            const fileData = await fs.readFile(filePath, "utf-8");
            let controllers = JSON.parse(fileData);
            let fileMissingFields = new Set();

            for (let i = 0; i < controllers.length; i++) {
                let controller = controllers[i];

                for (const key of SCHEMA_ORDER) {
                    if (!Object.prototype.hasOwnProperty.call(controller, key)) {
                        controller[key] = Object.prototype.hasOwnProperty.call(DEFAULT_VALUES, key)
                            ? DEFAULT_VALUES[key]
                            : null;
                        fileMissingFields.add(key);
                    }
                }

                for (const [key, value] of Object.entries(controller)) {
                    if (value === 0) {
                        if (shouldSkipZero(controller, key, zeroValueSkips)) continue;
                        zeroValuesLog.push(
                            `${controller.manufacturer || "Unknown"} - ${controller.modelNumber || controller.name || "Unknown"}: Field '${key}' is 0`
                        );
                    } else if (value === "" && !ALLOWED_EMPTY_STRINGS.includes(key)) {
                        emptyStringsLog.push(
                            `${controller.manufacturer || "Unknown"} - ${controller.modelNumber || controller.name || "Unknown"}: Field '${key}' is empty ("")`
                        );
                    }
                }

                for (const ta of typeAssertions) {
                    if (!matchesWhen(controller, ta.when)) continue;
                    for (const a of ta.assert || []) {
                        if (controller[a.field] !== a.equals) {
                            const detail =
                                a.message ||
                                `${a.field} must be ${JSON.stringify(a.equals)}`;
                            zeroValuesLog.push(
                                `[ERROR] ${controller.manufacturer || "Unknown"} - ${controller.modelNumber || controller.name || "Unknown"}: ${detail}`
                            );
                        }
                    }
                }

                if (controller.datasheetUrl && typeof controller.datasheetUrl === "string") {
                    const urlWithoutQuery = controller.datasheetUrl.split("?")[0].toLowerCase();
                    if (!urlWithoutQuery.endsWith(".pdf")) {
                        nonPdfDatasheetsLog.push(
                            `${controller.manufacturer || "Unknown"} - ${controller.modelNumber || controller.name || "Unknown"}: URL is not a direct .pdf link (${controller.datasheetUrl})`
                        );
                    }
                }

                controller.buyLinks = normalizeBuyLinks(controller.buyLinks);

                addUrlContext(
                    controller.datasheetUrl,
                    controller.manufacturer,
                    controller.modelNumber || controller.name
                );
                if (controller.buyLinks && Array.isArray(controller.buyLinks)) {
                    controller.buyLinks.forEach((link) => {
                        addUrlContext(
                            link.URL,
                            controller.manufacturer,
                            controller.modelNumber || controller.name
                        );
                    });
                }

                controllers[i] = reorderKeys(controller, SCHEMA_ORDER);
            }

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
            const uniqueUrls = Array.from(urlToControllersMap.keys());
            console.log(`Checking ${uniqueUrls.length} unique URLs in batches of ${CONCURRENCY_LIMIT}...`);

            let brokenLinksFound = false;

            for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY_LIMIT) {
                const batch = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);

                const batchPromises = batch.map(async (url) => {
                    const result = await checkUrl(url);
                    if (!result.ok) {
                        const affectedControllers = urlToControllersMap.get(url).join(", ");
                        logOutput += `URL: ${url}\n`;
                        logOutput += `Status: ${result.status}\n`;
                        logOutput += `Affected Controllers: ${affectedControllers}\n\n`;
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
