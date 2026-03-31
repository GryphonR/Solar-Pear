import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api.js";

/** Rough word budget for Google query (site: adds tokens) */
function wordHint(domains) {
    if (!domains?.length) return 0;
    return 2 + domains.length * 2;
}

export default function SerperPage() {
    const [panels, setPanels] = useState([]);
    const [controllers, setControllers] = useState([]);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        apiGet("/config/serper-sites")
            .then((d) => {
                setPanels(d.panels || []);
                setControllers(d.controllers || []);
            })
            .catch((e) => setErr(String(e.message)));
    }, []);

    async function save() {
        setErr("");
        setMsg("");
        try {
            await apiPut("/config/serper-sites", { panels, controllers });
            setMsg("Saved.");
        } catch (e) {
            setErr(String(e.message));
        }
    }

    function SiteEditor({ title, list, setList }) {
        const w = wordHint(list);
        return (
            <div className="card">
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                <p style={{ color: w > 28 ? "var(--warn)" : "var(--muted)", fontSize: "0.85rem" }}>
                    ~{w} query tokens (site: filters). Google limits advanced queries; if searches fail, shorten the
                    list or batch in the scan script.
                </p>
                <textarea
                    rows={12}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
                    value={list.join("\n")}
                    onChange={(e) =>
                        setList(
                            e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean)
                        )
                    }
                />
                <div className="row" style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => setList([...list, "example.co.uk"])}>Add example row</button>
                </div>
            </div>
        );
    }

    return (
        <>
            <h2>Serper shopping sites</h2>
            <p style={{ color: "var(--muted)" }}>
                Domains used by <code>panel-availability-scan.js</code> and <code>controller-availability-scan.js</code>{" "}
                for <code>site:</code> filters (stored in <code>data-admin/config/serper-sites.json</code>).
            </p>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            {msg && <p style={{ color: "var(--ok)" }}>{msg}</p>}
            <div className="grid2">
                <SiteEditor title="Panels" list={panels} setList={setPanels} />
                <SiteEditor title="Controllers" list={controllers} setList={setControllers} />
            </div>
            <button type="button" className="primary" onClick={save}>
                Save both lists
            </button>
        </>
    );
}
