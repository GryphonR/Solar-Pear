import { useEffect, useMemo, useState } from "react";
import UrlWithActions from "./UrlWithActions.jsx";

// Affiliate networks seen in the 4.14 research; free text is allowed too.
const NETWORKS = ["awin", "cj", "impact", "webgains", "partnerize", "rakuten", "paid-on-results", "in-house", "amazon"];

/**
 * Keeps every field on an entry (affiliateUrl, network, price, priceCheckedAt, inStock, …) so
 * editing a row never loses data, and keeps isAffiliate in step with affiliateUrl (roadmap 4.3).
 */
function normalizeRow(link) {
    const row = { ...(link && typeof link === "object" ? link : {}) };
    row.Supplier = String(row.Supplier ?? "");
    row.URL = String(row.URL ?? "");
    const affiliateUrl = typeof row.affiliateUrl === "string" ? row.affiliateUrl.trim() : "";
    if (affiliateUrl) row.affiliateUrl = affiliateUrl;
    else delete row.affiliateUrl;
    if (typeof row.network === "string" && row.network.trim()) row.network = row.network.trim();
    else delete row.network;
    row.isAffiliate = !!affiliateUrl;
    row.Checked = row.Checked === true;
    return row;
}

function normalizeRows(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeRow);
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
        const next = rows.map((r, j) => (j === i ? normalizeRow({ ...r, ...patch }) : r));
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
                Shop / vendor pages should be normal web URLs — not direct <code>.pdf</code> files.{" "}
                <strong>URL</strong> is the canonical product page (the pricing scan checks it). Put a tracking
                link in <strong>Affiliate URL</strong>: users are sent there, it is labelled as an affiliate
                link, and the scan never changes or removes that row.
            </p>
            <div className="table-scroll">
                <table className="data compact" style={{ minWidth: 820 }}>
                    <thead>
                        <tr>
                            <th>Supplier</th>
                            <th>URL</th>
                            <th>Affiliate URL</th>
                            <th>Network</th>
                            <th title="Affiliate (set by Affiliate URL)">Aff.</th>
                            <th title="Link manually checked">OK</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ color: "var(--muted)" }}>
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
                                <td style={{ minWidth: 220 }}>
                                    <input
                                        type="url"
                                        style={{ width: "100%" }}
                                        value={row.affiliateUrl ?? ""}
                                        onChange={(e) => updateRow(i, { affiliateUrl: e.target.value })}
                                        placeholder="https://www.awin1.com/cread.php?…"
                                        aria-label={`Affiliate URL for ${row.Supplier || "row " + (i + 1)}`}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        list="buy-link-networks"
                                        style={{ width: 110 }}
                                        value={row.network ?? ""}
                                        onChange={(e) => updateRow(i, { network: e.target.value })}
                                        placeholder="awin"
                                        aria-label={`Affiliate network for ${row.Supplier || "row " + (i + 1)}`}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={row.isAffiliate}
                                        readOnly
                                        disabled
                                        title="Set automatically from Affiliate URL"
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
            <datalist id="buy-link-networks">
                {NETWORKS.map((n) => (
                    <option key={n} value={n} />
                ))}
            </datalist>
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
