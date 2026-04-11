import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { writeJsonAtomic } from "./jsonWrite.mjs";

describe("writeJsonAtomic", () => {
    it("writes formatted JSON payload to target file", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "solar-data-admin-"));
        const target = path.join(tempDir, "sample.json");
        await writeJsonAtomic(target, { a: 1, b: ["x"] });
        const text = await fs.readFile(target, "utf-8");
        expect(text).toContain('"a": 1');
        expect(text.endsWith("\n")).toBe(true);
    });
});
