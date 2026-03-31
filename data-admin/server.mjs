import express from "express";
import fs from "fs/promises";
import path from "path";
import { paths, assertUnderBase, REPO_ROOT } from "./lib/paths.mjs";
import { loadSchema, saveSchema } from "./lib/schemaLoader.mjs";
import { applySchemaToAllFiles } from "./lib/applySchema.mjs";
import { runStaticChecks, runLinkChecks } from "./lib/checks.mjs";
import { fileURLToPath } from "url";
import { normalizeBuyLinks, reorderKeys, checkUrl } from "./lib/normalize.mjs";

/** @param {unknown} raw */
function parseHttpUrlForCheck(raw) {
    if (raw == null || typeof raw !== "string") return null;
    const s = raw.trim();
    if (!s) return null;
    let u;
    try {
        u = new URL(s);
    } catch {
        return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DATA_ADMIN_PORT) || 3847;
const HOST = "127.0.0.1";

const app = express();
app.use(express.json({ limit: "20mb" }));

app.use((req, res, next) => {
    const host = (req.hostname || req.headers.host?.split(":")[0] || "").toLowerCase();
    if (host && host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
        return res.status(403).send("Forbidden: use localhost only");
    }
    next();
});

/** @type {Map<string, { status: string, progress?: object, issues?: object[], error?: string }>} */
const linkJobs = new Map();

function safeJsonFileName(name) {
    if (!name || typeof name !== "string") return null;
    const base = path.basename(name);
    if (!base.endsWith(".json") || base.includes("..") || base.includes("/") || base.includes("\\")) {
        return null;
    }
    return base;
}

function summarizeIssues(issues) {
    const byKind = {};
    for (const i of issues) {
        byKind[i.kind] = (byKind[i.kind] || 0) + 1;
    }
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    return { byKind, errors, warnings, total: issues.length };
}

// --- Schema ---
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

// --- Data files ---
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
        await fs.writeFile(filePath, JSON.stringify(req.body, null, 4) + "\n", "utf-8");
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
        await fs.writeFile(filePath, JSON.stringify(arr, null, 4) + "\n", "utf-8");
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
        if (kind === "panels") {
            arr.sort((a, b) => {
                const sA = a["panel-series"] || "";
                const sB = b["panel-series"] || "";
                if (sA < sB) return -1;
                if (sA > sB) return 1;
                return (Number(a.power) || 0) - (Number(b.power) || 0);
            });
        } else {
            arr.sort((a, b) => {
                const aM = String(a.modelNumber || a.name || "");
                const bM = String(b.modelNumber || b.name || "");
                return aM.localeCompare(bM);
            });
        }
        await fs.writeFile(filePath, JSON.stringify(arr, null, 4) + "\n", "utf-8");
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

// --- Checks ---
app.get("/api/checks/summary", async (req, res) => {
    try {
        const [p, c] = await Promise.all([runStaticChecks("panels"), runStaticChecks("controllers")]);
        const issues = [
            ...p.issues.map((i) => ({ ...i, dataset: "panels" })),
            ...c.issues.map((i) => ({ ...i, dataset: "controllers" })),
        ];
        res.json({
            issues,
            summary: {
                panels: summarizeIssues(p.issues),
                controllers: summarizeIssues(c.issues),
                combined: summarizeIssues(issues),
            },
        });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

function mergeUrlRefs(mapA, mapB) {
    const merged = new Map();
    function addAll(from) {
        for (const [url, refs] of from) {
            if (!merged.has(url)) merged.set(url, []);
            const list = merged.get(url);
            for (const r of refs) {
                const k = `${r.dataset}|${r.file}|${r.index}`;
                if (!list.some((x) => `${x.dataset}|${x.file}|${x.index}` === k)) list.push(r);
            }
        }
    }
    addAll(mapA);
    addAll(mapB);
    return merged;
}

app.post("/api/checks/run-links", async (req, res) => {
    try {
        const [p, c] = await Promise.all([runStaticChecks("panels"), runStaticChecks("controllers")]);
        const merged = mergeUrlRefs(p.urlMap, c.urlMap);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        linkJobs.set(id, { status: "running", progress: { done: 0, total: merged.size } });

        (async () => {
            try {
                const issues = await runLinkChecks(merged, (done, total) => {
                    const job = linkJobs.get(id);
                    if (job) job.progress = { done, total };
                });
                linkJobs.set(id, { status: "done", issues, progress: { done: merged.size, total: merged.size } });
            } catch (err) {
                linkJobs.set(id, { status: "error", error: String(err.message || err) });
            }
        })();

        res.json({ jobId: id });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

app.get("/api/checks/jobs/:id", (req, res) => {
    const job = linkJobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Unknown job" });
    res.json(job);
});

app.post("/api/checks/check-url", async (req, res) => {
    try {
        const href = parseHttpUrlForCheck(req.body?.url);
        if (!href) {
            return res.status(400).json({ error: "Invalid or unsupported URL (use http or https)" });
        }
        const result = await checkUrl(href);
        res.json({
            ok: result.ok,
            status: result.status,
            url: href,
            ...(result.method ? { method: result.method } : {}),
            ...(result.statusText ? { statusText: result.statusText } : {}),
        });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

// --- Serper config ---
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
        await fs.writeFile(p, JSON.stringify(data, null, 4) + "\n", "utf-8");
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

// --- Logs & changelogs ---
async function listChangelogPaths() {
    const out = [];
    const candidates = [
        path.join(REPO_ROOT, "CHANGELOG.md"),
        path.join(REPO_ROOT, "docs", "data-changelog.md"),
    ];
    for (const p of candidates) {
        try {
            await fs.access(p);
            out.push({ id: path.relative(REPO_ROOT, p).replace(/\\/g, "/"), path: p, label: path.basename(p) });
        } catch {
            /* missing */
        }
    }
    try {
        const dir = paths.changelogsDir;
        const names = await fs.readdir(dir);
        for (const n of names) {
            if (!n.endsWith(".md")) continue;
            const p = path.join(dir, n);
            out.push({ id: `changelogs/${n}`, path: p, label: n });
        }
    } catch {
        /* no folder */
    }
    return out;
}

async function listVerificationLogs() {
    const out = [];
    const patterns = (name) =>
        /processing_log|availability.*log|_log_\d+\.txt$/i.test(name) && name.endsWith(".txt");

    async function scanDir(dir) {
        try {
            const names = await fs.readdir(dir);
            for (const n of names) {
                if (!patterns(n)) continue;
                const p = path.join(dir, n);
                const st = await fs.stat(p);
                if (!st.isFile()) continue;
                out.push({
                    id: path.relative(REPO_ROOT, p).replace(/\\/g, "/"),
                    path: p,
                    label: n,
                    mtime: st.mtimeMs,
                });
            }
        } catch {
            /* missing */
        }
    }

    await scanDir(paths.logsDir);
    await scanDir(REPO_ROOT);
    out.sort((a, b) => b.mtime - a.mtime);
    return out;
}

app.get("/api/logs/changelogs", async (req, res) => {
    try {
        const items = await listChangelogPaths();
        res.json({ items });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

app.get("/api/logs/verification", async (req, res) => {
    try {
        const items = await listVerificationLogs();
        res.json({ items });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

app.get("/api/logs/read", async (req, res) => {
    try {
        const rel = req.query.path;
        if (!rel || typeof rel !== "string") return res.status(400).json({ error: "path query required" });
        const resolved = path.resolve(REPO_ROOT, rel);
        assertUnderBase(resolved, REPO_ROOT);
        if (resolved.endsWith(".md")) {
            const text = await fs.readFile(resolved, "utf-8");
            return res.json({ type: "markdown", content: text });
        }
        if (resolved.endsWith(".txt")) {
            const text = await fs.readFile(resolved, "utf-8");
            return res.json({ type: "text", content: text });
        }
        return res.status(400).json({ error: "Only .md and .txt supported" });
    } catch (e) {
        res.status(500).json({ error: String(e.message) });
    }
});

async function start() {
    if (process.env.NODE_ENV === "production") {
        const dist = path.join(__dirname, "dist");
        app.use(express.static(dist));
        app.use((req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            if (req.path.startsWith("/api")) return next();
            res.sendFile(path.join(dist, "index.html"));
        });
    } else {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "custom",
            root: path.join(__dirname, "src"),
            configFile: path.join(__dirname, "vite.config.js"),
        });
        app.use(vite.middlewares);
        app.use(async (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            if (req.originalUrl.startsWith("/api")) return next();
            try {
                const url = req.originalUrl;
                let template = await fs.readFile(path.join(__dirname, "src", "index.html"), "utf-8");
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ "Content-Type": "text/html" }).end(template);
            } catch (e) {
                vite.ssrFixStacktrace(e);
                next(e);
            }
        });
    }

    app.listen(PORT, HOST, () => {
        console.log(`Data admin listening on http://${HOST}:${PORT}`);
    });
}

start().catch(console.error);
