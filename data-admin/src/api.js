/** Optional admin token from Vite env; sent on mutating API calls when set. */
const ADMIN_TOKEN = import.meta.env.VITE_DATA_ADMIN_TOKEN || "";

/** @returns {Record<string, string>} */
function authHeaders() {
    if (!ADMIN_TOKEN) return {};
    return {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "X-Admin-Token": ADMIN_TOKEN,
    };
}

export async function apiGet(path) {
    const r = await fetch(`/api${path}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
}

export async function apiPut(path, body) {
    const r = await fetch(`/api${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
}

export async function apiPost(path, body) {
    const r = await fetch(`/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body !== undefined ? JSON.stringify(body) : "{}",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
}
