import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../api.js";
import { entryEditPath, seriesEditPath } from "../lib/editLinks.js";

const severityRank = { error: 0, warning: 1, info: 2 };

function badgeClass(sev) {
    if (sev === "error") return "badge error";
    if (sev === "warning") return "badge warn";
    return "badge info";
}

function issueSummary(i) {
    if (i.kind === "duplicate_id") {
        return `Duplicate ${i.kindEntity === "panels" ? "model" : "id"}: ${i.id}`;
    }
    if (i.kind === "broken_link") {
        const line =
            typeof i.status === "number"
                ? `${i.status}${i.statusText ? ` ${i.statusText}` : ""}`
                : String(i.status ?? "");
        return line ? `${line} — ${i.url}` : i.url;
    }
    if (i.kind === "series_spec_mismatch") {
        const bits = (i.variants || [])
            .map((v) => `${v.model}: ${v.value}`)
            .slice(0, 4);
        const more = (i.variants || []).length > 4 ? ` … +${(i.variants || []).length - 4}` : "";
        return `${i.field} — ${bits.join("; ")}${more}`;
    }
    if (i.kind === "buy_link_pdf") {
        const who = i.supplier ? String(i.supplier) : "vendor";
        const u = i.url ? (String(i.url).length > 52 ? `${String(i.url).slice(0, 49)}…` : i.url) : "";
        return `${who}: ${u}`;
    }
    const parts = [i.kind];
    if (i.field) parts.push(`field: ${i.field}`);
    if (i.message) parts.push(i.message);
    if (i.status) parts.push(String(i.status));
    return parts.join(" · ");
}

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [err, setErr] = useState("");
    const [linkJob, setLinkJob] = useState(null);
    const [linkBusy, setLinkBusy] = useState(false);

    const load = useCallback(() => {
        setErr("");
        apiGet("/checks/summary")
            .then(setSummary)
            .catch((e) => setErr(String(e.message)));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!linkJob?.id || linkJob.status === "done" || linkJob.status === "error") return;
        const id = linkJob.id;
        const t = setInterval(async () => {
            try {
                const j = await apiGet(`/checks/jobs/${id}`);
                setLinkJob((prev) => ({ ...prev, ...j, id }));
                if (j.status === "done" || j.status === "error") clearInterval(t);
            } catch {
                clearInterval(t);
            }
        }, 800);
        return () => clearInterval(t);
    }, [linkJob?.id, linkJob?.status]);

    async function runLinks() {
        setLinkBusy(true);
        setErr("");
        try {
            const { jobId } = await apiPost("/checks/run-links", {});
            setLinkJob({ id: jobId, status: "running", progress: { done: 0, total: 0 } });
        } catch (e) {
            setErr(String(e.message));
        } finally {
            setLinkBusy(false);
        }
    }

    const sortedStaticIssues = useMemo(() => {
        const issues = summary?.issues || [];
        return [...issues].sort((a, b) => {
            const ra = severityRank[a.severity] ?? 3;
            const rb = severityRank[b.severity] ?? 3;
            if (ra !== rb) return ra - rb;
            const fa = `${a.dataset}|${a.file}|${a.label}`;
            const fb = `${b.dataset}|${b.file}|${b.label}`;
            return fa.localeCompare(fb);
        });
    }, [summary?.issues]);

    if (!summary && !err) {
        return <p>Loading…</p>;
    }

    const c = summary?.summary?.combined;
    const linkIssues = linkJob?.issues || [];
    const linkErrors = linkIssues.length;

    return (
        <>
            <h2>Dashboard</h2>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

            <div className="card">
                <h3 style={{ marginTop: 0 }}>Static checks</h3>
                <p>
                    <button type="button" className="primary" onClick={load}>
                        Refresh
                    </button>
                </p>
                {c && (
                    <ul>
                        <li>
                            Total issues: <strong>{c.total}</strong> ({c.errors} errors, {c.warnings} warnings)
                        </li>
                        <li>Panels: {summary.summary.panels.total} — Controllers: {summary.summary.controllers.total}</li>
                    </ul>
                )}
                {c?.byKind && (
                    <table className="data" style={{ marginBottom: "1rem" }}>
                        <thead>
                            <tr>
                                <th>Kind</th>
                                <th>Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(c.byKind).map(([k, v]) => (
                                <tr key={k}>
                                    <td>{k}</td>
                                    <td>{v}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <h4 style={{ marginBottom: "0.5rem" }}>All issues (click to edit)</h4>
                <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <table className="data">
                        <thead style={{ position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
                            <tr>
                                <th>Severity</th>
                                <th>Dataset</th>
                                <th>Entry</th>
                                <th>Detail</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStaticIssues.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ color: "var(--muted)" }}>
                                        No static issues.
                                    </td>
                                </tr>
                            )}
                            {sortedStaticIssues.map((i, idx) => (
                                <tr
                                    key={`${i.kind}-${i.file}-${i.series ?? ""}-${i.field ?? ""}-${i.index ?? ""}-${idx}`}
                                >
                                    <td>
                                        <span className={badgeClass(i.severity)}>{i.severity}</span>
                                    </td>
                                    <td>{i.dataset || i.kindEntity || "—"}</td>
                                    <td>
                                        {i.kind === "duplicate_id" ? String(i.id) : i.label}
                                        {i.file && i.kind !== "duplicate_id" && (
                                            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{i.file}</div>
                                        )}
                                    </td>
                                    <td style={{ fontSize: "0.85rem" }}>{issueSummary(i)}</td>
                                    <td>
                                        {i.kind === "duplicate_id" &&
                                            (i.locations || []).map((loc, j) => (
                                                <div key={j}>
                                                    <Link
                                                        to={entryEditPath(
                                                            i.kindEntity === "controllers" ? "controllers" : "panels",
                                                            loc.file,
                                                            loc.index
                                                        )}
                                                    >
                                                        Open {loc.file} #{loc.index}
                                                    </Link>
                                                </div>
                                            ))}
                                        {i.kind === "series_spec_mismatch" && i.file && i.series != null && (
                                            <Link to={seriesEditPath(i.file, i.series)}>Edit series fields</Link>
                                        )}
                                        {i.kind !== "duplicate_id" &&
                                            i.kind !== "series_spec_mismatch" &&
                                            i.file != null &&
                                            i.index != null &&
                                            (i.dataset === "panels" || i.dataset === "controllers") && (
                                                <Link
                                                    to={entryEditPath(
                                                        i.dataset === "controllers" ? "controllers" : "panels",
                                                        i.file,
                                                        i.index
                                                    )}
                                                >
                                                    Edit
                                                </Link>
                                            )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginTop: 0 }}>Link checks (HTTP 200 on datasheet &amp; buy URLs)</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    Slow — batches requests with delay. Run when you need it.
                </p>
                <button type="button" className="primary" onClick={runLinks} disabled={linkBusy}>
                    {linkBusy ? "Starting…" : "Run link check"}
                </button>
                {linkJob?.status === "running" && linkJob.progress && (
                    <p>
                        Progress: {linkJob.progress.done} / {linkJob.progress.total} URLs
                    </p>
                )}
                {linkJob?.status === "error" && (
                    <p style={{ color: "var(--danger)" }}>{linkJob.error}</p>
                )}
                {linkJob?.status === "done" && (
                    <>
                        <p>
                            {linkErrors === 0 ? (
                                <span style={{ color: "var(--ok)" }}>All checked URLs returned 200.</span>
                            ) : (
                                <span style={{ color: "var(--danger)" }}>{linkErrors} broken or bad URLs.</span>
                            )}
                        </p>
                        {linkErrors > 0 && (
                            <div style={{ maxHeight: 360, overflow: "auto", fontSize: "0.85rem" }}>
                                <table className="data">
                                    <thead>
                                        <tr>
                                            <th>URL</th>
                                            <th>Status</th>
                                            <th>Affected entries</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linkIssues.map((issue, idx) => (
                                            <tr key={idx}>
                                                <td style={{ wordBreak: "break-all" }}>
                                                    <code>{issue.url}</code>
                                                </td>
                                                <td>
                                                    {typeof issue.status === "number"
                                                        ? `${issue.status}${issue.statusText ? ` ${issue.statusText}` : ""}`
                                                        : issue.status}
                                                </td>
                                                <td>
                                                    {(issue.refs || []).map((r, j) => (
                                                        <div key={j}>
                                                            <span style={{ color: "var(--muted)" }}>{r.label}</span>{" "}
                                                            <Link
                                                                to={entryEditPath(
                                                                    r.dataset === "controllers" ? "controllers" : "panels",
                                                                    r.file,
                                                                    r.index
                                                                )}
                                                            >
                                                                Edit
                                                            </Link>
                                                        </div>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="card">
                <h3 style={{ marginTop: 0 }}>Browse</h3>
                <p>
                    <Link to="/panels">All panels</Link>
                    {" · "}
                    <Link to="/controllers">All controllers</Link>
                    {" · "}
                    <Link to="/schema">Schema</Link>
                </p>
            </div>
        </>
    );
}
