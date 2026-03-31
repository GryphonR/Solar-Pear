import BuyLinksEditor from "./BuyLinksEditor.jsx";
import UrlWithActions from "./UrlWithActions.jsx";

function coerceValue(type, raw) {
    if (type === "number") {
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : 0;
    }
    if (type === "boolean") return raw === true || raw === "true";
    return raw;
}

export default function EntryForm({ schema, entry, onChange }) {
    const types = schema?.types || {};
    const order = schema?.fieldOrder || Object.keys(entry || {});

    function setField(key, value) {
        onChange({ ...entry, [key]: value });
    }

    if (!entry) return null;

    return (
        <div className="entry-form-fields" style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {order.map((key) => {
                const t = types[key] || "string";
                const val = entry[key];

                if (key === "buyLinks") {
                    return (
                        <BuyLinksEditor
                            key={key}
                            value={val}
                            onChange={(links) => setField("buyLinks", links)}
                        />
                    );
                }

                if (t === "boolean") {
                    return (
                        <label key={key} className="row" style={{ gap: "0.5rem" }}>
                            <input
                                type="checkbox"
                                checked={!!val}
                                onChange={(e) => setField(key, e.target.checked)}
                            />
                            <span>{key}</span>
                        </label>
                    );
                }

                if (key === "datasheetUrl") {
                    return (
                        <label key={key}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{key}</div>
                            <UrlWithActions
                                value={val === null || val === undefined ? "" : String(val)}
                                onChange={(e) => setField(key, e.target.value)}
                                placeholder="https://…"
                            />
                        </label>
                    );
                }

                if (t === "number") {
                    return (
                        <label key={key}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{key}</div>
                            <input
                                type="text"
                                inputMode="decimal"
                                style={{ width: "100%", maxWidth: 480 }}
                                value={val === null || val === undefined ? "" : String(val)}
                                onChange={(e) => setField(key, coerceValue("number", e.target.value))}
                            />
                        </label>
                    );
                }

                if (t === "array") {
                    return (
                        <label key={key}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{key}</div>
                            <textarea
                                rows={4}
                                style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                                value={
                                    Array.isArray(val) ? JSON.stringify(val, null, 2) : String(val ?? "")
                                }
                                onChange={(e) => {
                                    try {
                                        setField(key, JSON.parse(e.target.value));
                                    } catch {
                                        /* ignore */
                                    }
                                }}
                            />
                        </label>
                    );
                }

                return (
                    <label key={key}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{key}</div>
                        <input
                            type="text"
                            style={{ width: "100%", maxWidth: 560 }}
                            value={val === null || val === undefined ? "" : String(val)}
                            onChange={(e) => setField(key, e.target.value)}
                        />
                    </label>
                );
            })}
        </div>
    );
}
