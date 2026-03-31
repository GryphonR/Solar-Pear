import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet, apiPut, apiPost } from "../api.js";
import EntryForm from "../components/EntryForm.jsx";
import Modal from "../components/Modal.jsx";
import { PANEL_SERIES_SHARED_FIELDS, panelSeriesKeyFromRow } from "../constants/panelSeriesFields.js";

function cellNum(v) {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return String(v);
}

function dimsMm(row) {
    const parts = [row.height, row.width, row.depth].map((v) =>
        v === null || v === undefined || v === "" ? "—" : String(v)
    );
    if (parts.every((p) => p === "—")) return "—";
    return parts.join("×");
}

function parseNum(raw) {
    if (raw === "" || raw === null || raw === undefined) return null;
    const n = parseFloat(String(raw));
    return Number.isFinite(n) ? n : null;
}

export default function BrowsePanels() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [files, setFiles] = useState([]);
    const [dataByFile, setDataByFile] = useState({});
    const [loaded, setLoaded] = useState(false);
    const [schema, setSchema] = useState(null);
    const [mfrOpen, setMfrOpen] = useState({});
    const [seriesOpen, setSeriesOpen] = useState({});
    const [editTarget, setEditTarget] = useState(null);
    const [draft, setDraft] = useState(null);
    const [seriesEditTarget, setSeriesEditTarget] = useState(null);
    const [seriesDraft, setSeriesDraft] = useState({});
    const [seriesConflictFields, setSeriesConflictFields] = useState([]);
    const [err, setErr] = useState("");

    const loadAll = useCallback(async () => {
        setErr("");
        try {
            const { files: list } = await apiGet("/data/panels/files");
            setFiles(list || []);
            const entries = await Promise.all(
                (list || []).map(async (f) => {
                    const data = await apiGet(`/data/panels/file/${encodeURIComponent(f)}`);
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
        apiGet("/schema/panels").then(setSchema).catch(() => {});
    }, []);

    const getSeriesMembers = useCallback(
        (file, seriesKey) => {
            const rows = dataByFile[file] || [];
            return rows
                .map((row, idx) => ({ row, idx }))
                .filter(({ row }) => panelSeriesKeyFromRow(row) === seriesKey);
        },
        [dataByFile]
    );

    const seriesBlockId = useCallback((file, seriesKey) => {
        const keys = [...new Set((dataByFile[file] || []).map(panelSeriesKeyFromRow))].sort((a, b) =>
            a.localeCompare(b)
        );
        const si = keys.indexOf(seriesKey);
        return `sb-${file.replace(/[^a-z0-9_-]/gi, "_")}-${si >= 0 ? si : 0}`;
    }, [dataByFile]);

    const applySeriesEditorState = useCallback((file, seriesKey) => {
        const members = getSeriesMembers(file, seriesKey);
        if (members.length === 0) return false;
        const conflicts = [];
        const draft0 = {};
        for (const field of PANEL_SERIES_SHARED_FIELDS) {
            const vals = new Set(members.map((m) => JSON.stringify(m.row[field])));
            if (vals.size > 1) conflicts.push(field);
            draft0[field] = members[0].row[field];
        }
        setSeriesDraft(draft0);
        setSeriesConflictFields(conflicts);
        setMfrOpen((o) => ({ ...o, [file]: true }));
        setSeriesOpen((o) => ({ ...o, [`${file}|${seriesKey}`]: true }));
        return true;
    }, [getSeriesMembers]);

    const openSeriesEdit = useCallback(
        (file, seriesKey) => {
            const members = getSeriesMembers(file, seriesKey);
            if (members.length === 0) return;
            setEditTarget(null);
            setDraft(null);
            setSeriesEditTarget({ file, series: seriesKey });
            applySeriesEditorState(file, seriesKey);
            const q = new URLSearchParams({ file, series: seriesKey });
            setSearchParams(q);
            requestAnimationFrame(() => {
                const el = document.getElementById(seriesBlockId(file, seriesKey));
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        },
        [getSeriesMembers, setSearchParams, applySeriesEditorState, seriesBlockId]
    );

    const openFromQuery = useCallback(() => {
        const file = searchParams.get("file");
        if (!file || !dataByFile[file]) return;

        if (searchParams.has("series")) {
            const s = searchParams.get("series");
            const seriesKey = s === "" || s === null ? "(no series)" : s;
            const members = getSeriesMembers(file, seriesKey);
            if (members.length > 0) {
                setEditTarget(null);
                setDraft(null);
                setSeriesEditTarget({ file, series: seriesKey });
                applySeriesEditorState(file, seriesKey);
            }
            return;
        }

        const indexStr = searchParams.get("index");
        if (indexStr == null) return;
        const index = parseInt(indexStr, 10);
        if (!Number.isFinite(index) || !dataByFile[file][index]) return;
        setSeriesEditTarget(null);
        setSeriesDraft({});
        setSeriesConflictFields([]);
        const row = dataByFile[file][index];
        setEditTarget({ file, index });
        setDraft({ ...row });
        const series = row["panel-series"] || "(no series)";
        setMfrOpen((o) => ({ ...o, [file]: true }));
        setSeriesOpen((o) => ({ ...o, [`${file}|${series}`]: true }));
        requestAnimationFrame(() => {
            document.getElementById(`panel-row-${file}-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }, [searchParams, dataByFile, getSeriesMembers, applySeriesEditorState]);

    useEffect(() => {
        if (!loaded) return;
        openFromQuery();
    }, [loaded, openFromQuery]);

    const byFileSeries = useMemo(() => {
        const out = {};
        for (const file of files) {
            const entries = dataByFile[file] || [];
            const m = new Map();
            entries.forEach((row, idx) => {
                const s = panelSeriesKeyFromRow(row);
                if (!m.has(s)) m.set(s, []);
                m.get(s).push({ row, idx });
            });
            out[file] = {
                keys: [...m.keys()].sort((a, b) => a.localeCompare(b)),
                m,
            };
        }
        return out;
    }, [files, dataByFile]);

    async function saveEntry() {
        if (!editTarget || !draft) return;
        const { file, index } = editTarget;
        setErr("");
        try {
            await apiPut(`/data/panels/file/${encodeURIComponent(file)}/entry/${index}`, draft);
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

    async function saveSeriesEdit() {
        if (!seriesEditTarget) return;
        const { file, series } = seriesEditTarget;
        const members = getSeriesMembers(file, series);
        if (members.length === 0) return;
        setErr("");
        try {
            for (const { row, idx } of members) {
                const merged = { ...row };
                for (const field of PANEL_SERIES_SHARED_FIELDS) {
                    const raw = seriesDraft[field];
                    if (raw === "" || raw === null || (typeof raw === "string" && raw.trim() === "")) {
                        merged[field] = row[field];
                    } else {
                        const v = parseNum(raw);
                        merged[field] = v !== null ? v : row[field];
                    }
                }
                await apiPut(`/data/panels/file/${encodeURIComponent(file)}/entry/${idx}`, merged);
            }
            const data = await apiGet(`/data/panels/file/${encodeURIComponent(file)}`);
            setDataByFile((prev) => ({ ...prev, [file]: Array.isArray(data) ? data : [] }));
            setSeriesEditTarget(null);
            setSeriesDraft({});
            setSeriesConflictFields([]);
            setSearchParams({});
        } catch (e) {
            setErr(String(e.message));
        }
    }

    function setSeriesField(field, raw) {
        setSeriesDraft((d) => ({ ...d, [field]: raw }));
    }

    async function sortOneFile(file) {
        setErr("");
        try {
            await apiPost(`/data/panels/file/${encodeURIComponent(file)}/sort`, {});
            const data = await apiGet(`/data/panels/file/${encodeURIComponent(file)}`);
            setDataByFile((prev) => ({ ...prev, [file]: Array.isArray(data) ? data : [] }));
        } catch (e) {
            setErr(String(e.message));
        }
    }

    function startEdit(file, index, row) {
        setSeriesEditTarget(null);
        setSeriesDraft({});
        setSeriesConflictFields([]);
        setEditTarget({ file, index });
        setDraft({ ...row });
        setSearchParams({ file, index: String(index) });
    }

    function cancelEdit() {
        setEditTarget(null);
        setDraft(null);
        setSearchParams({});
    }

    function cancelSeriesEdit() {
        setSeriesEditTarget(null);
        setSeriesDraft({});
        setSeriesConflictFields([]);
        setSearchParams({});
    }

    const seriesMemberCount =
        seriesEditTarget && getSeriesMembers(seriesEditTarget.file, seriesEditTarget.series).length;

    return (
        <>
            <h2>Panels</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                All manufacturer files on one page. Edit one row, or use <strong>Edit series fields</strong> to set
                shared dimensions, weight, and temperature coefficients for every panel in the same series (same file).
            </p>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            {!loaded && <p>Loading…</p>}

            {seriesEditTarget && (
                <Modal
                    title={`Series: ${seriesEditTarget.file.replace(/\.json$/, "")} — “${seriesEditTarget.series}” (${seriesMemberCount} panels)`}
                    onClose={cancelSeriesEdit}
                    footer={
                        <>
                            <button type="button" className="primary" onClick={saveSeriesEdit}>
                                Save to all {seriesMemberCount} panels
                            </button>
                            <button type="button" onClick={cancelSeriesEdit}>
                                Cancel
                            </button>
                        </>
                    }
                >
                    <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 0 }}>
                        Updates <code>{PANEL_SERIES_SHARED_FIELDS.join(", ")}</code> on every panel in this series.
                        Per-model fields (power, Voc, links, etc.) are unchanged.
                    </p>
                    {seriesConflictFields.length > 0 && (
                        <p style={{ color: "var(--warn)", fontSize: "0.9rem" }}>
                            These fields differ across models — values are from the first row; adjust and save to align:{" "}
                            <strong>{seriesConflictFields.join(", ")}</strong>
                        </p>
                    )}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                            gap: "0.65rem",
                        }}
                    >
                        {PANEL_SERIES_SHARED_FIELDS.map((field) => (
                            <label key={field}>
                                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: "0.85rem" }}>{field}</div>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    style={{ width: "100%" }}
                                    value={
                                        seriesDraft[field] === null || seriesDraft[field] === undefined
                                            ? ""
                                            : String(seriesDraft[field])
                                    }
                                    onChange={(e) => setSeriesField(field, e.target.value)}
                                />
                            </label>
                        ))}
                    </div>
                </Modal>
            )}

            {editTarget && draft && !seriesEditTarget && (
                <Modal
                    wide
                    title={`Edit: ${editTarget.file.replace(/\.json$/, "")} — ${draft.model || `row ${editTarget.index}`}`}
                    onClose={cancelEdit}
                    footer={
                        <>
                            <button type="button" className="primary" onClick={saveEntry}>
                                Save
                            </button>
                            <button type="button" onClick={cancelEdit}>
                                Cancel
                            </button>
                        </>
                    }
                >
                    <EntryForm schema={schema} entry={draft} onChange={setDraft} />
                </Modal>
            )}

            {files.map((file) => {
                const openMfr = mfrOpen[file] !== false;
                const bs = byFileSeries[file] || { keys: [], m: new Map() };
                return (
                    <div key={file} id={`mfr-${file}`} className="card">
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setMfrOpen((o) => ({ ...o, [file]: !openMfr }))}
                                style={{
                                    fontWeight: 700,
                                    fontSize: "1.05rem",
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    color: "var(--text)",
                                }}
                            >
                                {openMfr ? "▼" : "▶"} {file.replace(/\.json$/, "")} ({(dataByFile[file] || []).length}{" "}
                                panels)
                            </button>
                            <button type="button" onClick={() => sortOneFile(file)} disabled={!dataByFile[file]?.length}>
                                Sort this file
                            </button>
                        </div>
                        {openMfr &&
                            bs.keys.map((series) => {
                                const openS = seriesOpen[`${file}|${series}`] !== false;
                                const count = bs.m.get(series)?.length || 0;
                                const blockId = seriesBlockId(file, series);
                                const seriesActive =
                                    seriesEditTarget?.file === file && seriesEditTarget?.series === series;
                                return (
                                    <div key={`${file}|${series}`} id={blockId} style={{ marginTop: "0.75rem" }}>
                                        <div className="row" style={{ flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSeriesOpen((o) => ({ ...o, [`${file}|${series}`]: !openS }))
                                                }
                                                style={{ fontWeight: 600, marginBottom: openS ? "0.35rem" : 0 }}
                                            >
                                                {openS ? "▼" : "▶"} {series} ({count})
                                            </button>
                                            {count >= 1 && (
                                                <button type="button" className="primary" onClick={() => openSeriesEdit(file, series)}>
                                                    Edit series fields
                                                </button>
                                            )}
                                        </div>
                                        {openS && (
                                            <div className="table-scroll">
                                                <table className="data compact">
                                                    <thead>
                                                        <tr>
                                                            <th>Model</th>
                                                            <th>Series</th>
                                                            <th>Power (W)</th>
                                                            <th title="H×W×D mm">Dims (mm)</th>
                                                            <th>Weight (kg)</th>
                                                            <th title="Temp coef Pmax %/°C">γ Pmax</th>
                                                            <th title="Temp coef Voc %/°C">γ Voc</th>
                                                            <th title="Temp coef Isc %/°C">γ Isc</th>
                                                            <th className="wrap-ok">Name</th>
                                                            <th />
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(bs.m.get(series) || []).map(({ row, idx }) => (
                                                            <tr
                                                                key={`${file}-${idx}`}
                                                                id={`panel-row-${file}-${idx}`}
                                                                style={{
                                                                    outline:
                                                                        editTarget?.file === file &&
                                                                        editTarget?.index === idx
                                                                            ? "2px solid var(--accent)"
                                                                            : undefined,
                                                                    boxShadow: seriesActive
                                                                        ? "inset 0 0 0 1px var(--accent)"
                                                                        : undefined,
                                                                }}
                                                            >
                                                                <td>{row.model}</td>
                                                                <td className="wrap-ok">{row["panel-series"] || "—"}</td>
                                                                <td>{cellNum(row.power)}</td>
                                                                <td>{dimsMm(row)}</td>
                                                                <td>{cellNum(row.weight)}</td>
                                                                <td>{cellNum(row.tempCoefPmax)}</td>
                                                                <td>{cellNum(row.tempCoefVoc)}</td>
                                                                <td>{cellNum(row.tempCoefIsc)}</td>
                                                                <td className="wrap-ok" title={row.name}>
                                                                    {row.name}
                                                                </td>
                                                                <td>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startEdit(file, idx, row)}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                );
            })}
        </>
    );
}
