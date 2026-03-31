import { useState } from "react";
import { apiPost } from "../api.js";

function trimUrl(v) {
    return String(v ?? "").trim();
}

function canOpenUrl(v) {
    const s = trimUrl(v);
    if (!s) return false;
    try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

/** URL field with Check (server-side GET, same as dashboard link check) and Open. */
export default function UrlWithActions({ value, onChange, compact, placeholder }) {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    async function doCheck() {
        const u = trimUrl(value);
        setMsg(null);
        if (!u) {
            setMsg({ type: "err", text: "Enter a URL first" });
            return;
        }
        setBusy(true);
        try {
            const r = await apiPost("/checks/check-url", { url: u });
            if (r.ok) {
                const via = r.method === "HEAD" ? "HEAD" : "GET";
                const phrase = r.statusText ? ` ${r.statusText}` : "";
                setMsg({ type: "ok", text: `OK (${via} ${r.status}${phrase})` });
            } else if (typeof r.status === "number") {
                const phrase = r.statusText ? ` ${r.statusText}` : "";
                setMsg({ type: "err", text: `Bad response: HTTP ${r.status}${phrase}` });
            } else {
                setMsg({ type: "err", text: `Bad response: ${r.status}` });
            }
        } catch (e) {
            setMsg({ type: "err", text: String(e.message || e) });
        } finally {
            setBusy(false);
        }
    }

    function doOpen() {
        if (!canOpenUrl(value)) return;
        try {
            const u = new URL(trimUrl(value));
            window.open(u.href, "_blank", "noopener,noreferrer");
        } catch {
            /* ignore */
        }
    }

    const btnClass = compact ? "url-action-btn" : undefined;

    return (
        <div className={`url-with-actions${compact ? " url-with-actions-compact" : ""}`}>
            <div className="url-with-actions-row">
                <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    className="url-with-actions-input"
                    value={value}
                    onChange={(e) => {
                        setMsg(null);
                        onChange(e);
                    }}
                    placeholder={placeholder}
                />
                <div className="url-with-actions-btns">
                    <button type="button" className={btnClass} onClick={doCheck} disabled={busy}>
                        {busy ? "…" : "Check"}
                    </button>
                    <button type="button" className={btnClass} onClick={doOpen} disabled={!canOpenUrl(value)}>
                        Open
                    </button>
                </div>
            </div>
            {msg ? (
                <div
                    className={`url-with-actions-msg url-with-actions-msg-${msg.type}`}
                    role="status"
                >
                    {msg.text}
                </div>
            ) : null}
        </div>
    );
}
