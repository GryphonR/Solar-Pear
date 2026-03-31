import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet, apiPut, apiPost } from "../api.js";
import EntryForm from "../components/EntryForm.jsx";

export default function BrowseControllers() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [files, setFiles] = useState([]);
    const [dataByFile, setDataByFile] = useState({});
    const [loaded, setLoaded] = useState(false);
    const [schema, setSchema] = useState(null);
    const [mfrOpen, setMfrOpen] = useState({});
    const [editTarget, setEditTarget] = useState(null);
    const [draft, setDraft] = useState(null);
    const [err, setErr] = useState("");

    const loadAll = useCallback(async () => {
        setErr("");
        try {
            const { files: list } = await apiGet("/data/controllers/files");
            setFiles(list || []);
            const entries = await Promise.all(
                (list || []).map(async (f) => {
                    const data = await apiGet(`/data/controllers/file/${encodeURIComponent(f)}`);
                    return [f, Array.isArray(data) ? data : []];
                })
            );
            const o = {};
            for (const [f, rows] of entries) o[f] = rows;
            setDataByFile(o);
            setLoaded(true);
        } catch (e) {
            setErr(String(e.message));
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useEffect(() => {
        apiGet("/schema/controllers").then(setSchema).catch(() => {});
    }, []);

    const openFromQuery = useCallback(() => {
        const file = searchParams.get("file");
        const indexStr = searchParams.get("index");
        if (!file || indexStr == null || !dataByFile[file]) return;
        const index = parseInt(indexStr, 10);
        if (!Number.isFinite(index) || !dataByFile[file][index]) return;
        const row = dataByFile[file][index];
        setEditTarget({ file, index });
        setDraft({ ...row });
        setMfrOpen((o) => ({ ...o, [file]: true }));
        requestAnimationFrame(() => {
            document.getElementById(`ctrl-row-${file}-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }, [searchParams, dataByFile]);

    useEffect(() => {
        if (!loaded) return;
        openFromQuery();
    }, [loaded, openFromQuery]);

    async function saveEntry() {
        if (!editTarget || !draft) return;
        const { file, index } = editTarget;
        setErr("");
        try {
            await apiPut(`/data/controllers/file/${encodeURIComponent(file)}/entry/${index}`, draft);
            setDataByFile((prev) => {
                const next = { ...prev, [file]: [...prev[file]] };
                next[file][index] = draft;
                return next;
            });
            setEditTarget(null);
            setDraft(null);
            setSearchParams({});
        } catch (e) {
            setErr(String(e.message));
        }
    }

    async function sortOneFile(file) {
        setErr("");
        try {
            await apiPost(`/data/controllers/file/${encodeURIComponent(file)}/sort`, {});
            const data = await apiGet(`/data/controllers/file/${encodeURIComponent(file)}`);
            setDataByFile((prev) => ({ ...prev, [file]: Array.isArray(data) ? data : [] }));
        } catch (e) {
            setErr(String(e.message));
        }
    }

    function startEdit(file, index, row) {
        setEditTarget({ file, index });
        setDraft({ ...row });
        setSearchParams({ file, index: String(index) });
    }

    function cancelEdit() {
        setEditTarget(null);
        setDraft(null);
        setSearchParams({});
    }

    return (
        <>
            <h2>Controllers</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                All manufacturer files on one page. Dashboard issue rows link here with the matching entry selected.
            </p>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            {!loaded && <p>Loading…</p>}

            {editTarget && draft && (
                <div className="card" style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <h3 style={{ marginTop: 0 }}>
                        Edit: {editTarget.file.replace(/\.json$/, "")} — {draft.id || draft.modelNumber || "entry"}
                    </h3>
                    <EntryForm schema={schema} entry={draft} onChange={setDraft} />
                    <div className="row" style={{ marginTop: "0.75rem" }}>
                        <button type="button" className="primary" onClick={saveEntry}>
                            Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {files.map((file) => {
                const openMfr = mfrOpen[file] !== false;
                const rows = dataByFile[file] || [];
                return (
                    <div key={file} id={`mfr-${file}`} className="card">
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setMfrOpen((o) => ({ ...o, [file]: !openMfr }))}
                                style={{ fontWeight: 700, fontSize: "1.05rem", background: "none", border: "none", padding: 0, color: "var(--text)" }}
                            >
                                {openMfr ? "▼" : "▶"} {file.replace(/\.json$/, "")} ({rows.length} controllers)
                            </button>
                            <button type="button" onClick={() => sortOneFile(file)} disabled={!rows.length}>
                                Sort this file
                            </button>
                        </div>
                        {openMfr && (
                            <table className="data" style={{ marginTop: "0.5rem" }}>
                                <thead>
                                    <tr>
                                        <th>id</th>
                                        <th>Model</th>
                                        <th>Type</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, idx) => (
                                        <tr
                                            key={`${file}-${idx}`}
                                            id={`ctrl-row-${file}-${idx}`}
                                            style={{
                                                outline:
                                                    editTarget?.file === file && editTarget?.index === idx
                                                        ? "2px solid var(--accent)"
                                                        : undefined,
                                            }}
                                        >
                                            <td>{row.id}</td>
                                            <td>{row.modelNumber || row.name}</td>
                                            <td>{row.type}</td>
                                            <td>
                                                <button type="button" onClick={() => startEdit(file, idx, row)}>
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );
            })}
        </>
    );
}
