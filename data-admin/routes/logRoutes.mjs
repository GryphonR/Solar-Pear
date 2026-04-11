import fs from "fs/promises";
import path from "path";
import { paths, assertUnderBase, REPO_ROOT } from "../lib/paths.mjs";

async function listChangelogPaths() {
    const out = [];
    const candidates = [path.join(REPO_ROOT, "CHANGELOG.md"), path.join(REPO_ROOT, "docs", "data-changelog.md")];
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
    const patterns = (name) => /processing_log|availability.*log|_log_\d+\.txt$/i.test(name) && name.endsWith(".txt");

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

/**
 * @param {import("express").Express} app
 */
export function registerLogRoutes(app) {
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
}
