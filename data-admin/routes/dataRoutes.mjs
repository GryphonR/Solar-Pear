import fs from "fs/promises";
import path from "path";
import { paths, assertUnderBase } from "../lib/paths.mjs";
import { loadSchema } from "../lib/schemaLoader.mjs";
import { normalizeBuyLinks, reorderKeys } from "../lib/normalize.mjs";
import { sortEntries } from "../lib/sortEntries.mjs";
import { writeJsonAtomic } from "../lib/jsonWrite.mjs";

function safeJsonFileName(name) {
    if (!name || typeof name !== "string") return null;
    const base = path.basename(name);
    if (!base.endsWith(".json") || base.includes("..") || base.includes("/") || base.includes("\\")) {
        return null;
    }
    return base;
}

/**
 * @param {import("express").Express} app
 */
export function registerDataRoutes(app) {
    app.get("/api/data/:kind/files", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
            const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
            res.json({ files });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.get("/api/data/:kind/file/:name", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const name = safeJsonFileName(req.params.name);
            if (!name) return res.status(400).json({ error: "Bad filename" });
            const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
            const filePath = path.join(dir, name);
            assertUnderBase(filePath, dir);
            const text = await fs.readFile(filePath, "utf-8");
            res.json(JSON.parse(text));
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.put("/api/data/:kind/file/:name", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const name = safeJsonFileName(req.params.name);
            if (!name) return res.status(400).json({ error: "Bad filename" });
            const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
            const filePath = path.join(dir, name);
            assertUnderBase(filePath, dir);
            if (!Array.isArray(req.body)) {
                return res.status(400).json({ error: "Body must be a JSON array" });
            }
            await writeJsonAtomic(filePath, req.body);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.put("/api/data/:kind/file/:name/entry/:index", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const name = safeJsonFileName(req.params.name);
            const index = parseInt(req.params.index, 10);
            if (!name || !Number.isFinite(index) || index < 0) {
                return res.status(400).json({ error: "Bad request" });
            }
            const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
            const filePath = path.join(dir, name);
            assertUnderBase(filePath, dir);
            const arr = JSON.parse(await fs.readFile(filePath, "utf-8"));
            if (index >= arr.length) return res.status(404).json({ error: "Index out of range" });
            arr[index] = req.body;
            await writeJsonAtomic(filePath, arr);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.post("/api/data/:kind/file/:name/sort", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const name = safeJsonFileName(req.params.name);
            if (!name) return res.status(400).json({ error: "Bad filename" });
            const dir = kind === "panels" ? paths.panelsDir : paths.controllersDir;
            const filePath = path.join(dir, name);
            assertUnderBase(filePath, dir);
            const schema = await loadSchema(kind);
            let arr = JSON.parse(await fs.readFile(filePath, "utf-8"));
            arr = arr.map((entry) => {
                const e = { ...entry };
                e.buyLinks = normalizeBuyLinks(e.buyLinks);
                return reorderKeys(e, schema.fieldOrder);
            });
            arr = sortEntries(kind, arr);
            await writeJsonAtomic(filePath, arr);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.get("/api/config/serper-sites", async (req, res) => {
        try {
            const p = path.join(paths.configDir, "serper-sites.json");
            const raw = await fs.readFile(p, "utf-8");
            res.type("json").send(raw);
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.put("/api/config/serper-sites", async (req, res) => {
        try {
            const body = req.body;
            if (!body || !Array.isArray(body.panels) || !Array.isArray(body.controllers)) {
                return res.status(400).json({ error: "Expected { panels: string[], controllers: string[] }" });
            }
            const normalize = (arr) =>
                arr.map((s) => String(s).trim().replace(/^https?:\/\//, "").split("/")[0].toLowerCase());
            const data = { panels: normalize(body.panels), controllers: normalize(body.controllers) };
            const p = path.join(paths.configDir, "serper-sites.json");
            await writeJsonAtomic(p, data);
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });
}
