import { useEffect, useMemo, useState } from "react";
import UrlWithActions from "./UrlWithActions.jsx";

function normalizeRows(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((link) => ({
        Supplier: String(link?.Supplier ?? ""),
        URL: String(link?.URL ?? ""),
        isAffiliate: !!link?.isAffiliate,
        Checked: link?.Checked === true,
    }));
}

export default function BuyLinksEditor({ value, onChange }) {
    const rows = useMemo(() => normalizeRows(value), [value]);
    const jsonStr = useMemo(() => JSON.stringify(rows, null, 2), [rows]);
    const [rawJson, setRawJson] = useState(jsonStr);

    useEffect(() => {
        setRawJson(jsonStr);
    }, [jsonStr]);

    function commit(nextRows) {
        onChange(nextRows);
    }

    function updateRow(i, patch) {
        const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
        commit(next);
    }

    function addRow() {
        commit([...rows, { Supplier: "", URL: "", isAffiliate: false, Checked: false }]);
    }

    function removeRow(i) {
        commit(rows.filter((_, j) => j !== i));
    }

    return (
        <div className="buy-links-editor">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>buyLinks</div>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 0.5rem" }}>
                Shop / vendor pages should be normal web URLs — not direct <code>.pdf</code> files.
            </p>
            <div className="table-scroll">
                <table className="data compact" style={{ minWidth: 520 }}>
                    <thead>
                        <tr>
                            <th>Supplier</th>
                            <th>URL</th>
                            <th title="Affiliate">Aff.</th>
                            <th title="Link manually checked">OK</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ color: "var(--muted)" }}>
                                    No buy links — use Add row.
                                </td>
                            </tr>
                        )}
                        {rows.map((row, i) => (
                            <tr key={i}>
                                <td>
                                    <input
                                        type="text"
                                        style={{ width: "100%", minWidth: 120 }}
                                        value={row.Supplier}
                                        onChange={(e) => updateRow(i, { Supplier: e.target.value })}
                                        placeholder="e.g. segen.co.uk"
                                    />
                                </td>
                                <td style={{ minWidth: 280, verticalAlign: "top" }}>
                                    <UrlWithActions
                                        compact
                                        value={row.URL}
                                        onChange={(e) => updateRow(i, { URL: e.target.value })}
                                        placeholder="https://…"
                                    />
                                </td>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={row.isAffiliate}
                                        onChange={(e) => updateRow(i, { isAffiliate: e.target.checked })}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={row.Checked}
                                        onChange={(e) => updateRow(i, { Checked: e.target.checked })}
                                    />
                                </td>
                                <td>
                                    <button type="button" className="danger" onClick={() => removeRow(i)}>
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button type="button" style={{ marginTop: "0.45rem" }} onClick={addRow}>
                Add row
            </button>
            <details style={{ marginTop: "0.65rem" }}>
                <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.82rem" }}>
                    Raw JSON (advanced)
                </summary>
                <textarea
                    className="pre"
                    rows={6}
                    style={{ width: "100%", marginTop: "0.35rem", fontSize: "0.75rem" }}
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                    onBlur={() => {
                        try {
                            const parsed = JSON.parse(rawJson || "[]");
                            if (Array.isArray(parsed)) {
                                commit(normalizeRows(parsed));
                            }
                        } catch {
                            setRawJson(jsonStr);
                        }
                    }}
                />
            </details>
        </div>
    );
}
