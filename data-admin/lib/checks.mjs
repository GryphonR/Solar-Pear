import fs from "fs/promises";
import path from "path";
import { paths } from "./paths.mjs";
import { loadSchema } from "./schemaLoader.mjs";
import {
    normalizeBuyLinks,
    checkUrl,
    isPdfDatasheetUrl,
    LINK_CHECK_CONCURRENCY,
} from "./normalize.mjs";
import { pushPanelSeriesUniformityIssues } from "./panelSeriesShared.mjs";

/** @param {Record<string, unknown>} entry @param {{ field: string, equals?: unknown }} when */
function matchesWhen(entry, when) {
    if (!when || typeof when.field !== "string") return false;
    return Object.prototype.hasOwnProperty.call(entry, when.field)
        ? entry[when.field] === when.equals
        : when.equals === undefined;
}

/**
 * @param {Record<string, unknown>} entry
 * @param {string} field
 * @param {Array<{ field: string, when: object }>} zeroValueSkips
 */
function shouldSkipZero(entry, field, zeroValueSkips) {
    for (const r of zeroValueSkips || []) {
        if (r.field === field && matchesWhen(entry, r.when)) return true;
    }
    return false;
}

/**
 * @param {"panels" | "controllers"} kind
 * @returns {Promise<{ issues: object[], urlMap: Map<string, { dataset: string, file: string, index: number, label: string }[]> }>}
 */
export async function runStaticChecks(kind) {
    const schema = await loadSchema(kind);
    const { fieldOrder, rules } = schema;
    const allowedEmpty = new Set(rules?.allowedEmptyStrings || []);
    const zeroSkips = rules?.zeroValueSkips || [];
    const typeAssertions = rules?.typeAssertions || [];

    const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));

    /** @type {object[]} */
    const issues = [];
    const urlMap = new Map();

    /** @param {string} url @param {{ file: string, index: number, label: string }} ref */
    function addUrlRef(url, ref) {
        if (!url) return;
        if (!urlMap.has(url)) urlMap.set(url, []);
        const list = urlMap.get(url);
        const key = `${ref.file}|${ref.index}`;
        if (!list.some((r) => `${r.file}|${r.index}` === key)) {
            list.push({ dataset: kind, file: ref.file, index: ref.index, label: ref.label });
        }
    }

    /** @type {Map<string, { file: string, index: number }[]>} */
    const idIndex = new Map();

    for (const file of files) {
        const filePath = path.join(dir, file);
        const arr = JSON.parse(await fs.readFile(filePath, "utf-8"));

        for (let index = 0; index < arr.length; index++) {
            const entry = arr[index];
            const label =
                kind === "panels"
                    ? `${entry.manufacturer || "?"} — ${entry.model || "?"}`
                    : `${entry.manufacturer || "?"} — ${entry.id || entry.modelNumber || "?"}`;

            const idKey = kind === "panels" ? entry.model : entry.id;
            if (idKey != null && String(idKey) !== "") {
                const k = String(idKey);
                if (!idIndex.has(k)) idIndex.set(k, []);
                idIndex.get(k).push({ file, index });
            }

            for (const key of fieldOrder) {
                if (!Object.prototype.hasOwnProperty.call(entry, key)) {
                    issues.push({
                        kind: "missing_field",
                        severity: "error",
                        file,
                        index,
                        field: key,
                        label,
                    });
                }
            }

            for (const [key, value] of Object.entries(entry)) {
                if (value === 0) {
                    if (shouldSkipZero(entry, key, zeroSkips)) continue;
                    issues.push({
                        kind: "zero_value",
                        severity: "info",
                        file,
                        index,
                        field: key,
                        label,
                    });
                } else if (value === "" && !allowedEmpty.has(key)) {
                    issues.push({
                        kind: "empty_string",
                        severity: "warning",
                        file,
                        index,
                        field: key,
                        label,
                    });
                }
            }

            for (const ta of typeAssertions) {
                if (!matchesWhen(entry, ta.when)) continue;
                for (const a of ta.assert || []) {
                    if (entry[a.field] !== a.equals) {
                        issues.push({
                            kind: "type_rule",
                            severity: "error",
                            file,
                            index,
                            field: a.field,
                            label,
                            message: a.message || `${a.field} must equal ${JSON.stringify(a.equals)}`,
                        });
                    }
                }
            }

            if (entry.datasheetUrl && !isPdfDatasheetUrl(String(entry.datasheetUrl))) {
                issues.push({
                    kind: "non_pdf_datasheet",
                    severity: "warning",
                    file,
                    index,
                    field: "datasheetUrl",
                    label,
                    url: entry.datasheetUrl,
                });
            }

            addUrlRef(entry.datasheetUrl, { file, index, label });
            const links = normalizeBuyLinks(entry.buyLinks);
            for (const link of links) {
                if (link.URL && isPdfDatasheetUrl(String(link.URL))) {
                    issues.push({
                        kind: "buy_link_pdf",
                        severity: "warning",
                        file,
                        index,
                        field: "buyLinks",
                        label,
                        url: link.URL,
                        supplier: link.Supplier,
                    });
                }
                addUrlRef(link.URL, { file, index, label });
            }
        }

        if (kind === "panels") {
            pushPanelSeriesUniformityIssues(file, arr, issues);
        }
    }

    for (const [idVal, locations] of idIndex) {
        if (locations.length > 1) {
            issues.push({
                kind: "duplicate_id",
                severity: "error",
                id: idVal,
                kindEntity: kind,
                locations,
            });
        }
    }

    return { issues, urlMap, schema };
}

/**
 * @param {Map<string, { dataset: string, file: string, index: number, label: string }[]>} urlMap
 * @param {(processed: number, total: number) => void} [onProgress]
 */
export async function runLinkChecks(urlMap, onProgress) {
    const uniqueUrls = Array.from(urlMap.keys());
    /** @type {object[]} */
    const issues = [];
    const total = uniqueUrls.length;

    for (let i = 0; i < uniqueUrls.length; i += LINK_CHECK_CONCURRENCY) {
        const batch = uniqueUrls.slice(i, i + LINK_CHECK_CONCURRENCY);
        await Promise.all(
            batch.map(async (url) => {
                const result = await checkUrl(url);
                if (!result.ok) {
                    issues.push({
                        kind: "broken_link",
                        severity: "error",
                        url,
                        status: result.status,
                        ...(result.statusText ? { statusText: result.statusText } : {}),
                        refs: urlMap.get(url) || [],
                    });
                }
            })
        );
        if (onProgress) onProgress(Math.min(i + LINK_CHECK_CONCURRENCY, total), total);
        await new Promise((r) => setTimeout(r, 500));
    }

    return issues;
}

/** Word-ish count for Serper query limit warning */
export function siteFilterWordCount(domains) {
    if (!domains?.length) return 0;
    return 1 + domains.length * 2;
}
