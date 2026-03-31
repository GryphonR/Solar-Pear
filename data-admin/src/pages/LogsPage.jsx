import { useEffect, useState } from "react";
import { apiGet } from "../api.js";

function simpleMdToHtml(md) {
    const esc = (s) =>
        s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    return md
        .split("\n")
        .map((line) => {
            const t = line.trim();
            if (t.startsWith("### ")) return `<h3>${esc(t.slice(4))}</h3>`;
            if (t.startsWith("## ")) return `<h2>${esc(t.slice(3))}</h2>`;
            if (t.startsWith("# ")) return `<h1>${esc(t.slice(2))}</h1>`;
            if (t.startsWith("- ") || t.startsWith("* "))
                return `<li>${esc(t.slice(2))}</li>`;
            if (t === "") return "<br/>";
            return `<p>${esc(line)}</p>`;
        })
        .join("");
}

export default function LogsPage() {
    const [changelogs, setChangelogs] = useState([]);
    const [verification, setVerification] = useState([]);
    const [content, setContent] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        apiGet("/logs/changelogs")
            .then((r) => setChangelogs(r.items || []))
            .catch((e) => setErr(String(e.message)));
        apiGet("/logs/verification")
            .then((r) => setVerification(r.items || []))
            .catch(() => {});
    }, []);

    async function openLog(id) {
        setErr("");
        try {
            const q = new URLSearchParams({ path: id });
            const data = await apiGet(`/logs/read?${q}`);
            setContent(data);
        } catch (e) {
            setErr(String(e.message));
        }
    }

    return (
        <>
            <h2>Logs</h2>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            <div className="grid2">
                <div className="card">
                    <h3 style={{ marginTop: 0 }}>Changelogs (markdown)</h3>
                    {changelogs.length === 0 && <p style={{ color: "var(--muted)" }}>No changelog files found.</p>}
                    <ul>
                        {changelogs.map((item) => (
                            <li key={item.id}>
                                <button type="button" onClick={() => openLog(item.id)}>
                                    {item.label}
                                </button>
                                <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: 8 }}>
                                    {item.id}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="card">
                    <h3 style={{ marginTop: 0 }}>Verification logs (.txt)</h3>
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                        Prefers <code>logs/</code>; also lists matching files in repo root.
                    </p>
                    {verification.length === 0 && <p style={{ color: "var(--muted)" }}>No log files found.</p>}
                    <ul style={{ maxHeight: 220, overflow: "auto" }}>
                        {verification.map((item) => (
                            <li key={item.id}>
                                <button type="button" onClick={() => openLog(item.id)}>
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            {content?.type === "text" && (
                <div className="card">
                    <h3 style={{ marginTop: 0 }}>Content</h3>
                    <div className="pre">{content.content}</div>
                </div>
            )}
            {content?.type === "markdown" && (
                <div className="card">
                    <h3 style={{ marginTop: 0 }}>Preview</h3>
                    <div
                        className="md-preview"
                        style={{ lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: simpleMdToHtml(content.content) }}
                    />
                </div>
            )}
        </>
    );
}
