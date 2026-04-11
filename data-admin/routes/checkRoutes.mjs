import { runStaticChecks, runLinkChecks } from "../lib/checks.mjs";
import { checkUrl } from "../lib/normalize.mjs";

const JOB_TTL_MS = 60 * 60 * 1000;
/** @type {Map<string, { createdAt: number, status: string, progress?: object, issues?: object[], error?: string }>} */
const linkJobs = new Map();

function cleanupExpiredJobs() {
    const now = Date.now();
    for (const [id, job] of linkJobs.entries()) {
        if (now - job.createdAt > JOB_TTL_MS) {
            linkJobs.delete(id);
        }
    }
}

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

function summarizeIssues(issues) {
    const byKind = {};
    for (const i of issues) {
        byKind[i.kind] = (byKind[i.kind] || 0) + 1;
    }
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    return { byKind, errors, warnings, total: issues.length };
}

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

/**
 * @param {import("express").Express} app
 */
export function registerCheckRoutes(app) {
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

    app.post("/api/checks/run-links", async (req, res) => {
        try {
            cleanupExpiredJobs();
            const [p, c] = await Promise.all([runStaticChecks("panels"), runStaticChecks("controllers")]);
            const merged = mergeUrlRefs(p.urlMap, c.urlMap);
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            linkJobs.set(id, {
                createdAt: Date.now(),
                status: "running",
                progress: { done: 0, total: merged.size },
            });

            (async () => {
                try {
                    const issues = await runLinkChecks(merged, (done, total) => {
                        const job = linkJobs.get(id);
                        if (job) job.progress = { done, total };
                    });
                    linkJobs.set(id, {
                        createdAt: Date.now(),
                        status: "done",
                        issues,
                        progress: { done: merged.size, total: merged.size },
                    });
                } catch (err) {
                    linkJobs.set(id, {
                        createdAt: Date.now(),
                        status: "error",
                        error: String(err.message || err),
                    });
                }
            })();

            res.json({ jobId: id });
        } catch (e) {
            res.status(500).json({ error: String(e.message) });
        }
    });

    app.get("/api/checks/jobs/:id", (req, res) => {
        cleanupExpiredJobs();
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
}
