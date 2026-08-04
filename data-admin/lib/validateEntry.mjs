/**
 * Lightweight entry/file body validation against panels/controllers schema types.
 * No ajv dependency — Array.isArray + object shape + type checks for known fields.
 */

/**
 * @param {unknown} value
 * @param {string} type
 */
function valueMatchesType(value, type) {
    if (value === null || value === undefined) return true;
    switch (type) {
        case "number":
            return typeof value === "number" && Number.isFinite(value);
        case "boolean":
            return typeof value === "boolean";
        case "array":
            return Array.isArray(value);
        case "string":
            return typeof value === "string";
        default:
            return true;
    }
}

/**
 * Validate a single panel/controller entry against schema types.
 * Present fields listed in schema.types must match; empty/null allowed.
 * @param {unknown} entry
 * @param {{ fieldOrder?: string[], types?: Record<string, string> }} schema
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateEntry(entry, schema) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { ok: false, error: "Entry must be a JSON object" };
    }

    const types = schema?.types || {};
    for (const [key, expected] of Object.entries(types)) {
        if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
        if (!valueMatchesType(entry[key], expected)) {
            return { ok: false, error: `Field "${key}" must be ${expected}` };
        }
    }

    return { ok: true };
}

/**
 * Validate a full file body (array of entries).
 * @param {unknown} body
 * @param {{ fieldOrder?: string[], types?: Record<string, string> }} schema
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateEntryArray(body, schema) {
    if (!Array.isArray(body)) {
        return { ok: false, error: "Body must be a JSON array" };
    }
    for (let i = 0; i < body.length; i++) {
        const result = validateEntry(body[i], schema);
        if (!result.ok) {
            return { ok: false, error: `Entry[${i}]: ${result.error}` };
        }
    }
    return { ok: true };
}
