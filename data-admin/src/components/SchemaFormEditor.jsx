
function parseEquals(raw) {
    const t = String(raw).trim();
    if (t === "true") return true;
    if (t === "false") return false;
    if (t === "") return undefined;
    const n = Number(t);
    if (t !== "" && Number.isFinite(n) && String(n) === t) return n;
    try {
        return JSON.parse(t);
    } catch {
        return t;
    }
}

function stringifyEquals(v) {
    if (v === undefined) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
}

export default function SchemaFormEditor({ kind, schema, setSchema }) {
    const fieldOrder = schema.fieldOrder || [];
    const defaults = schema.defaults || {};
    const types = schema.types || {};
    const rules = schema.rules || {};

    function setFieldOrder(next) {
        setSchema({ ...schema, fieldOrder: next });
    }

    function moveField(i, delta) {
        const j = i + delta;
        if (j < 0 || j >= fieldOrder.length) return;
        const o = [...fieldOrder];
        [o[i], o[j]] = [o[j], o[i]];
        setFieldOrder(o);
    }

    function addField() {
        const name = window.prompt("New field name (JSON key):");
        if (!name || !name.trim()) return;
        const k = name.trim();
        if (fieldOrder.includes(k)) return;
        setSchema({
            ...schema,
            fieldOrder: [...fieldOrder, k],
            defaults: { ...defaults, [k]: null },
            types: { ...types, [k]: "string" },
        });
    }

    function removeField(k) {
        if (!window.confirm(`Remove field "${k}" from fieldOrder?`)) return;
        const { [k]: _d, ...restD } = defaults;
        const { [k]: _t, ...restT } = types;
        setSchema({
            ...schema,
            fieldOrder: fieldOrder.filter((f) => f !== k),
            defaults: restD,
            types: restT,
        });
    }

    function setDefault(key, value) {
        setSchema({ ...schema, defaults: { ...defaults, [key]: value } });
    }

    function setType(key, t) {
        setSchema({ ...schema, types: { ...types, [key]: t } });
    }

    function setAllowedEmptyFromText(text) {
        const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
        setSchema({
            ...schema,
            rules: { ...rules, allowedEmptyStrings: lines },
        });
    }

    function setZeroSkips(next) {
        setSchema({
            ...schema,
            rules: { ...rules, zeroValueSkips: next },
        });
    }

    function addZeroSkip() {
        setZeroSkips([...(rules.zeroValueSkips || []), { field: "", when: { field: "", equals: false } }]);
    }

    function updateZeroSkip(i, patch) {
        const arr = [...(rules.zeroValueSkips || [])];
        arr[i] = { ...arr[i], ...patch };
        if (patch.when) arr[i].when = { ...arr[i].when, ...patch.when };
        setZeroSkips(arr);
    }

    function removeZeroSkip(i) {
        const arr = [...(rules.zeroValueSkips || [])];
        arr.splice(i, 1);
        setZeroSkips(arr);
    }

    function setTypeAssertions(next) {
        setSchema({
            ...schema,
            rules: { ...rules, typeAssertions: next },
        });
    }

    function addTypeAssertion() {
        setTypeAssertions([
            ...(rules.typeAssertions || []),
            { when: { field: "type", equals: "charger" }, assert: [{ field: "MaxACPower", equals: 0, message: "" }] },
        ]);
    }

    function updateTypeAssertion(i, next) {
        const arr = [...(rules.typeAssertions || [])];
        arr[i] = next;
        setTypeAssertions(arr);
    }

    function removeTypeAssertion(i) {
        const arr = [...(rules.typeAssertions || [])];
        arr.splice(i, 1);
        setTypeAssertions(arr);
    }

    function setStandardizeFrom(arr3) {
        setSchema({
            ...schema,
            rules: { ...rules, standardizeNameFrom: arr3 },
        });
    }

    const snf = rules.standardizeNameFrom || ["manufacturer", "panel-series", "power"];

    return (
        <div className="schema-form schema-editor-compact">
            <section className="card">
                <h3>Field order</h3>
                <p className="schema-help">
                    Order controls JSON key ordering when applying schema. Use ↑ ↓ to reorder.
                </p>
                <div className="schema-field-order-list">
                    {fieldOrder.map((key, i) => (
                        <div
                            key={key}
                            className="row schema-field-order-row"
                        >
                            <code className="schema-field-name">{key}</code>
                            <button type="button" disabled={i === 0} onClick={() => moveField(i, -1)} title="Move up">
                                ↑
                            </button>
                            <button
                                type="button"
                                disabled={i === fieldOrder.length - 1}
                                onClick={() => moveField(i, 1)}
                                title="Move down"
                            >
                                ↓
                            </button>
                            <button type="button" className="danger" onClick={() => removeField(key)}>
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" className="schema-mt-sm" onClick={addField}>
                    Add field
                </button>
            </section>

            <section className="card">
                <h3>Defaults &amp; types</h3>
                <p className="schema-help">
                    Default is applied when a key is missing during &quot;Apply&quot;. Type drives the entry editor.
                </p>
                <div className="table-scroll">
                    <table className="data schema-types-table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Type</th>
                                <th>Default value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fieldOrder.map((key) => {
                                const t = types[key] || "string";
                                const val = defaults[key];
                                return (
                                    <tr key={key}>
                                        <td>
                                            <code>{key}</code>
                                        </td>
                                        <td>
                                            <select value={t} onChange={(e) => setType(key, e.target.value)}>
                                                <option value="string">string</option>
                                                <option value="number">number</option>
                                                <option value="boolean">boolean</option>
                                                <option value="array">array</option>
                                                <option value="object">object</option>
                                            </select>
                                        </td>
                                        <td>
                                            {t === "boolean" ? (
                                                <label className="row" style={{ gap: 6 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!val}
                                                        onChange={(e) => setDefault(key, e.target.checked)}
                                                    />
                                                    true
                                                </label>
                                            ) : t === "number" ? (
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    style={{ width: "100%", maxWidth: 200 }}
                                                    value={val === null || val === undefined ? "" : String(val)}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        if (raw === "") setDefault(key, null);
                                                        else {
                                                            const n = parseFloat(raw);
                                                            setDefault(key, Number.isFinite(n) ? n : val);
                                                        }
                                                    }}
                                                />
                                            ) : t === "array" || t === "object" ? (
                                                <textarea
                                                    rows={2}
                                                    className="schema-mono-input"
                                                    style={{ width: "100%", minWidth: 200 }}
                                                    value={
                                                        val === null || val === undefined
                                                            ? ""
                                                            : JSON.stringify(val, null, 0)
                                                    }
                                                    onChange={(e) => {
                                                        try {
                                                            setDefault(key, JSON.parse(e.target.value || "null"));
                                                        } catch {
                                                            /* keep */
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    style={{ width: "100%", maxWidth: 320 }}
                                                    value={val === null || val === undefined ? "" : String(val)}
                                                    onChange={(e) => setDefault(key, e.target.value)}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card">
                <h3>Rules — allowed empty strings</h3>
                <p className="schema-help">One field name per line.</p>
                <textarea
                    rows={3}
                    className="schema-mono-input schema-textarea-full"
                    value={(rules.allowedEmptyStrings || []).join("\n")}
                    onChange={(e) => setAllowedEmptyFromText(e.target.value)}
                />
            </section>

            <section className="card">
                <h3>Rules — skip zero-value warnings</h3>
                <p className="schema-help">
                    When <code>when</code> matches the entry, a zero in <code>field</code> is not flagged.
                </p>
                {(rules.zeroValueSkips || []).map((z, i) => (
                    <div key={i} className="row schema-zero-skip-row">
                        <label>
                            Field{" "}
                            <input
                                value={z.field || ""}
                                onChange={(e) => updateZeroSkip(i, { field: e.target.value })}
                            />
                        </label>
                        <label>
                            When field{" "}
                            <input
                                value={z.when?.field || ""}
                                onChange={(e) => updateZeroSkip(i, { when: { field: e.target.value } })}
                            />
                        </label>
                        <label>
                            equals{" "}
                            <input
                                value={stringifyEquals(z.when?.equals)}
                                onChange={(e) =>
                                    updateZeroSkip(i, { when: { equals: parseEquals(e.target.value) } })
                                }
                            />
                        </label>
                        <button type="button" className="danger" onClick={() => removeZeroSkip(i)}>
                            Remove
                        </button>
                    </div>
                ))}
                <button type="button" onClick={addZeroSkip}>
                    Add skip rule
                </button>
            </section>

            {kind === "panels" && (
                <section className="card">
                    <h3>Rules — auto name from fields</h3>
                    <p className="schema-help">
                        <code>standardizeNameFrom</code>: three field keys used to build <code>name</code> on apply.
                    </p>
                    <div className="row schema-sn-row">
                        {["Field 1", "Field 2", "Field 3 (power)"].map((lab, i) => (
                            <label key={i}>
                                {lab}{" "}
                                <input
                                    value={snf[i] || ""}
                                    onChange={(e) => {
                                        const next = [...(snf.length === 3 ? snf : ["", "", ""])];
                                        next[i] = e.target.value;
                                        setStandardizeFrom(next);
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                </section>
            )}

            {kind === "controllers" && (
                <section className="card">
                    <h3>Rules — type assertions</h3>
                    <p className="schema-help">
                        When <code>when</code> matches, each <code>assert</code> must hold or the check reports an error.
                    </p>
                    {(rules.typeAssertions || []).map((ta, i) => (
                        <div key={i} className="schema-type-assert-block">
                            <div className="row schema-type-assert-head">
                                <label>
                                    When field{" "}
                                    <input
                                        value={ta.when?.field || ""}
                                        onChange={(e) =>
                                            updateTypeAssertion(i, {
                                                ...ta,
                                                when: { ...ta.when, field: e.target.value },
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    equals{" "}
                                    <input
                                        value={stringifyEquals(ta.when?.equals)}
                                        onChange={(e) =>
                                            updateTypeAssertion(i, {
                                                ...ta,
                                                when: { ...ta.when, equals: parseEquals(e.target.value) },
                                            })
                                        }
                                    />
                                </label>
                                <button type="button" className="danger" onClick={() => removeTypeAssertion(i)}>
                                    Remove block
                                </button>
                            </div>
                            <label>
                                Assert (JSON array){" "}
                                <textarea
                                    rows={3}
                                    className="schema-mono-input schema-textarea-full"
                                    value={JSON.stringify(ta.assert || [], null, 2)}
                                    onChange={(e) => {
                                        try {
                                            updateTypeAssertion(i, { ...ta, assert: JSON.parse(e.target.value) });
                                        } catch {
                                            /* invalid */
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    ))}
                    <button type="button" onClick={addTypeAssertion}>
                        Add type assertion block
                    </button>
                </section>
            )}
        </div>
    );
}
