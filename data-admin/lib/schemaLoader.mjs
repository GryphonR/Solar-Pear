import fs from "fs/promises";
import path from "path";
import { paths } from "./paths.mjs";

/** @param {"panels" | "controllers"} kind */
export async function loadSchema(kind) {
    const name = kind === "panels" ? "panels.schema.json" : "controllers.schema.json";
    const raw = await fs.readFile(path.join(paths.schemaDir, name), "utf-8");
    return JSON.parse(raw);
}

/** @param {"panels" | "controllers"} kind @param {object} data */
export async function saveSchema(kind, data) {
    const name = kind === "panels" ? "panels.schema.json" : "controllers.schema.json";
    const p = path.join(paths.schemaDir, name);
    await fs.writeFile(p, JSON.stringify(data, null, 4) + "\n", "utf-8");
}
