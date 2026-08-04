/**
 * Allowlist http(s) URLs for hrefs and imports.
 * Rejects javascript:, data:, and URLs with embedded credentials.
 * @param {unknown} raw
 * @returns {string | null} Normalized href or null if unsafe/invalid
 */
export function safeHttpUrl(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    let url;
    try {
        url = new URL(s);
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Reject userinfo (e.g. https://user:pass@host) - phishing / credential embedding
    if (url.username || url.password) return null;
    return url.href;
}
