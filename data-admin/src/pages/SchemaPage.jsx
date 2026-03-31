import { useEffect, useState } from "react";
import { apiGet, apiPut, apiPost } from "../api.js";
import SchemaFormEditor from "../components/SchemaFormEditor.jsx";

export default function SchemaPage() {
    const [kind, setKind] = useState("panels");
    const [schema, setSchema] = useState(null);
    const [jsonText, setJsonText] = useState("");
    const [view, setView] = useState("form");
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");
    const [stripUnknown, setStripUnknown] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setErr("");
        setMsg("");
        setView("form");
        apiGet(`/schema/${kind}`)
            .then((s) => {
                setSchema(s);
                setJsonText(JSON.stringify(s, null, 4));
            })
            .catch((e) => setErr(String(e.message)));
    }, [kind]);

    function switchToJson() {
        if (schema) setJsonText(JSON.stringify(schema, null, 4));
        setView("json");
    }

    function switchToForm() {
        try {
            const parsed = JSON.parse(jsonText);
            setSchema(parsed);
            setView("form");
            setErr("");
        } catch (e) {
            setErr(`Invalid JSON: ${e.message}`);
        }
    }

    function getPayloadForSave() {
        if (view === "json") {
            return JSON.parse(jsonText);
        }
        return schema;
    }

    async function save() {
        setErr("");
        setMsg("");
        try {
            const payload = getPayloadForSave();
            await apiPut(`/schema/${kind}`, payload);
            setSchema(payload);
            setJsonText(JSON.stringify(payload, null, 4));
            setMsg("Saved.");
        } catch (e) {
            setErr(String(e.message));
        }
    }

    async function apply() {
        setBusy(true);
        setErr("");
        setMsg("");
        try {
            const payload = getPayloadForSave();
            await apiPut(`/schema/${kind}`, payload);
            await apiPost(`/schema/${kind}/apply`, { stripUnknown });
            setSchema(payload);
            setJsonText(JSON.stringify(payload, null, 4));
            setMsg(`Applied to all ${kind} JSON files.`);
        } catch (e) {
            setErr(String(e.message));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="schema-page-compact">
            <h2>Schema</h2>
            <p>
                Edit field order, defaults, and rules. Save writes the schema file; Apply runs transforms on every
                manufacturer JSON file.
            </p>
            <div className="row" style={{ marginBottom: "0.45rem", flexWrap: "wrap", gap: 6 }}>
                <button type="button" className={kind === "panels" ? "primary" : ""} onClick={() => setKind("panels")}>
                    Panels
                </button>
                <button
                    type="button"
                    className={kind === "controllers" ? "primary" : ""}
                    onClick={() => setKind("controllers")}
                >
                    Controllers
                </button>
                <span style={{ color: "var(--muted)", marginLeft: 8 }}>Editor:</span>
                <button type="button" className={view === "form" ? "primary" : ""} onClick={() => setView("form")}>
                    Form
                </button>
                <button type="button" className={view === "json" ? "primary" : ""} onClick={switchToJson}>
                    Raw JSON
                </button>
                {view === "json" && (
                    <button type="button" onClick={switchToForm}>
                        Parse JSON → form
                    </button>
                )}
            </div>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
            {!schema ? (
                <p>Loading…</p>
            ) : view === "form" ? (
                <SchemaFormEditor kind={kind} schema={schema} setSchema={setSchema} />
            ) : (
                <textarea
                    className="pre schema-json-area"
                    style={{ width: "100%" }}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                />
            )}
            <div className="row" style={{ marginTop: "0.5rem" }}>
                <label className="row" style={{ gap: "0.35rem" }}>
                    <input
                        type="checkbox"
                        checked={stripUnknown}
                        onChange={(e) => setStripUnknown(e.target.checked)}
                    />
                    Strip keys not in fieldOrder when applying
                </label>
            </div>
            <div className="row" style={{ marginTop: "0.5rem", gap: "0.45rem" }}>
                <button type="button" onClick={save}>
                    Save schema only
                </button>
                <button type="button" className="primary" disabled={busy} onClick={apply}>
                    {busy ? "Applying…" : "Save & apply to all files"}
                </button>
            </div>
        </div>
    );
}
