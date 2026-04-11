import { applySchemaToAllFiles } from "../lib/applySchema.mjs";
import { loadSchema, saveSchema } from "../lib/schemaLoader.mjs";

/**
 * @param {import("express").Express} app
 */
export function registerSchemaRoutes(app) {
    app.get("/api/schema/:kind", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const schema = await loadSchema(kind);
            res.json(schema);
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.put("/api/schema/:kind", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const body = req.body;
            if (!body || typeof body !== "object" || !Array.isArray(body.fieldOrder)) {
                return res.status(400).json({ error: "Invalid schema body" });
            }
            await saveSchema(kind, body);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.post("/api/schema/:kind/apply", async (req, res) => {
        try {
            const kind = req.params.kind === "controllers" ? "controllers" : "panels";
            const stripUnknown = !!req.body?.stripUnknown;
            const result = await applySchemaToAllFiles(kind, { stripUnknown });
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });
}
