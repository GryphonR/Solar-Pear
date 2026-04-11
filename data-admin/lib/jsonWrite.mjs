import fs from "fs/promises";
import path from "path";

/**
 * Atomically writes JSON by using temp file + rename.
 * This avoids leaving truncated JSON when interrupted mid-write.
 * @param {string} filePath
 * @param {unknown} data
 */
export async function writeJsonAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
    const payload = JSON.stringify(data, null, 4) + "\n";
    await fs.writeFile(tmpPath, payload, "utf-8");
    await fs.rename(tmpPath, filePath);
}
