import fs from "fs/promises";
import path from "path";
import { paths } from "./paths.mjs";
import { loadSchema } from "./schemaLoader.mjs";
import { normalizeBuyLinks, reorderKeys } from "./normalize.mjs";
import { sortEntries } from "./sortEntries.mjs";
import { writeJsonAtomic } from "./jsonWrite.mjs";

/**
 * @param {Record<string, unknown>} entry
 * @param {object} schema
 * @param {"panels" | "controllers"} kind
 * @param {boolean} stripUnknown
 */
export function transformEntry(entry, schema, kind, stripUnknown) {
    const { fieldOrder, defaults, rules } = schema;
    const out = { ...entry };

    for (const key of fieldOrder) {
        if (!Object.prototype.hasOwnProperty.call(out, key)) {
            out[key] = Object.prototype.hasOwnProperty.call(defaults || {}, key)
                ? defaults[key]
                : null;
        }
    }

    if (stripUnknown) {
        for (const k of Object.keys(out)) {
            if (!fieldOrder.includes(k)) delete out[k];
        }
    }

    out.buyLinks = normalizeBuyLinks(out.buyLinks);

    if (kind === "panels" && rules?.standardizeNameFrom?.length === 3) {
        const [mf, series, pow] = rules.standardizeNameFrom;
        if (out[mf] && out[series] && out[pow] != null) {
            out.name = `${String(out[mf]).trim()} ${String(out[series]).trim()} ${out[pow]}W`;
        }
    }

    return reorderKeys(out, fieldOrder);
}

/**
 * @param {"panels" | "controllers"} kind
 * @param {{ stripUnknown?: boolean }} options
 */
export async function applySchemaToAllFiles(kind, options = {}) {
    const stripUnknown = !!options.stripUnknown;
    const schema = await loadSchema(kind);
    const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    const touched = [];

    for (const file of files) {
        const filePath = path.join(dir, file);
        const text = await fs.readFile(filePath, "utf-8");
        /** @type {Record<string, unknown>[]} */
        let arr = JSON.parse(text);
        arr = arr.map((entry) => transformEntry(entry, schema, kind, stripUnknown));

        arr = sortEntries(kind, arr);
        await writeJsonAtomic(filePath, arr);
        touched.push(file);
    }

    return { files: touched };
}
