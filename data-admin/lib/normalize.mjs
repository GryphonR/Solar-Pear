import dns from "dns/promises";
import net from "net";

/** @param {unknown} buyLinks */
export function normalizeBuyLinks(buyLinks) {
    if (Array.isArray(buyLinks)) {
        return buyLinks.map((link) => ({
            ...link,
            isAffiliate: link.isAffiliate || false,
            Checked: Object.prototype.hasOwnProperty.call(link, "Checked") ? link.Checked : false,
        }));
    }
    if (typeof buyLinks === "object" && buyLinks !== null) {
        return Object.entries(buyLinks).map(([supplier, url]) => ({
            Supplier: supplier,
            URL: url,
            isAffiliate: false,
            Checked: false,
        }));
    }
    return [];
}

/** @param {Record<string, unknown>} obj @param {string[]} fieldOrder */
export function reorderKeys(obj, fieldOrder) {
    const orderedObj = {};
    for (const key of fieldOrder) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            orderedObj[key] = obj[key];
        }
    }
    for (const key in obj) {
        if (!fieldOrder.includes(key)) {
            orderedObj[key] = obj[key];
        }
    }
    return orderedObj;
}

export const FETCH_TIMEOUT_MS = 10000;
export const LINK_CHECK_CONCURRENCY = 5;
export const MAX_REDIRECTS = 5;

/** Richer than a minimal bot string; avoid Sec-Fetch-* (often rejected from server/datacenter IPs). */
const LINK_CHECK_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/pdf;q=0.7",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
};

function isHttpSuccess(status) {
    return status >= 200 && status < 300;
}

/** @param {Response} res */
function responseStatusLine(res) {
    const t = (res.statusText || "").trim();
    return t || "";
}

/** Shared BlockList for private/special ranges (handles expanded IPv6 forms). */
const PRIVATE_BLOCKLIST = new net.BlockList();
// IPv4: unspecified, loopback, RFC1918, link-local/metadata, CGNAT, docs, multicast+
PRIVATE_BLOCKLIST.addSubnet("0.0.0.0", 8, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("192.0.0.0", 24, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("192.0.2.0", 24, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("198.18.0.0", 15, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("198.51.100.0", 24, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("203.0.113.0", 24, "ipv4");
PRIVATE_BLOCKLIST.addSubnet("224.0.0.0", 3, "ipv4");
// IPv6: unspecified, loopback, ULA, link-local, multicast, documentation
PRIVATE_BLOCKLIST.addAddress("::", "ipv6");
PRIVATE_BLOCKLIST.addAddress("::1", "ipv6");
PRIVATE_BLOCKLIST.addSubnet("fc00::", 7, "ipv6");
PRIVATE_BLOCKLIST.addSubnet("fe80::", 10, "ipv6");
PRIVATE_BLOCKLIST.addSubnet("ff00::", 8, "ipv6");
PRIVATE_BLOCKLIST.addSubnet("2001:db8::", 32, "ipv6");

/**
 * True for loopback, RFC1918, link-local, CGNAT, documentation, multicast, and IPv6 specials.
 * @param {string} ip
 */
export function isPrivateOrSpecialIp(ip) {
    const version = net.isIP(ip);
    if (!version) return true;

    const family = version === 4 ? "ipv4" : "ipv6";

    // IPv4-mapped IPv6: check the embedded address (do not add ::ffff:/96 to BlockList —
    // Node treats that range as matching all IPv4 checks).
    if (version === 6) {
        const lower = ip.toLowerCase();
        const dotted = lower.match(/:ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (dotted) return isPrivateOrSpecialIp(dotted[1]);
        const hexMapped = lower.match(/:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hexMapped) {
            const hi = parseInt(hexMapped[1], 16);
            const lo = parseInt(hexMapped[2], 16);
            const embedded = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
            return isPrivateOrSpecialIp(embedded);
        }
    }

    try {
        return PRIVATE_BLOCKLIST.check(ip, family);
    } catch {
        return true;
    }
}

/**
 * Validate URL scheme/host and resolve DNS; reject private/special targets.
 * @param {string} urlString
 * @returns {Promise<{ ok: true, href: string } | { ok: false, status: string }>}
 */
export async function assertSafeFetchUrl(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        return { ok: false, status: "Invalid URL" };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, status: "Only http/https allowed" };
    }

    const hostname = parsed.hostname;
    if (!hostname) return { ok: false, status: "Missing hostname" };

    // Block literal private IPs in the URL before any network I/O
    if (net.isIP(hostname)) {
        if (isPrivateOrSpecialIp(hostname)) {
            return { ok: false, status: "Blocked private/special IP" };
        }
        return { ok: true, href: parsed.href };
    }

    // Resolve DNS and block if any address is private/special
    try {
        const results = await dns.lookup(hostname, { all: true, verbatim: true });
        if (!results.length) {
            return { ok: false, status: "DNS lookup returned no addresses" };
        }
        for (const { address } of results) {
            if (isPrivateOrSpecialIp(address)) {
                return { ok: false, status: "Blocked private/special IP (DNS)" };
            }
        }
    } catch (err) {
        return { ok: false, status: `DNS lookup failed: ${err.message || "Unknown"}` };
    }

    return { ok: true, href: parsed.href };
}

/**
 * Discard response body without buffering it into memory.
 * @param {Response} res
 */
async function discardBody(res) {
    try {
        if (res.body && typeof res.body.cancel === "function") {
            await res.body.cancel();
        } else {
            await res.arrayBuffer();
        }
    } catch {
        /* ignore abort/cancel errors */
    }
}

/**
 * One hop with redirect:manual. Prefer HEAD, fall back to GET on method/status issues.
 * @param {string} href
 * @param {AbortSignal} signal
 */
async function fetchOneHop(href, signal) {
    /** @type {Response | null} */
    let headRes = null;
    try {
        headRes = await fetch(href, {
            method: "HEAD",
            headers: LINK_CHECK_HEADERS,
            signal,
            redirect: "manual",
        });
        // Some servers reject HEAD; retry with GET
        if (headRes.status === 405 || headRes.status === 501) {
            await discardBody(headRes);
            headRes = null;
        }
    } catch {
        headRes = null;
    }

    if (headRes) {
        return { res: headRes, method: "HEAD" };
    }

    const getRes = await fetch(href, {
        method: "GET",
        headers: LINK_CHECK_HEADERS,
        signal,
        redirect: "manual",
    });
    return { res: getRes, method: "GET" };
}

/**
 * Resolve Location against the current URL; returns absolute href or null.
 * @param {string} currentHref
 * @param {string | null} location
 */
function resolveRedirectTarget(currentHref, location) {
    if (!location || !String(location).trim()) return null;
    try {
        return new URL(location, currentHref).href;
    } catch {
        return null;
    }
}

/** @param {string | undefined} url */
export async function checkUrl(url) {
    if (!url) return { ok: false, status: "No URL" };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        let current = url;
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const safe = await assertSafeFetchUrl(current);
            if (!safe.ok) {
                clearTimeout(timeoutId);
                return { ok: false, status: safe.status };
            }

            const { res, method } = await fetchOneHop(safe.href, controller.signal);

            // Manual redirect following with re-validation of each hop
            if (res.status >= 300 && res.status < 400) {
                const next = resolveRedirectTarget(safe.href, res.headers.get("location"));
                await discardBody(res);
                if (!next) {
                    clearTimeout(timeoutId);
                    return {
                        ok: false,
                        status: res.status,
                        statusText: responseStatusLine(res) || "Redirect without Location",
                        method,
                    };
                }
                if (hop === MAX_REDIRECTS) {
                    clearTimeout(timeoutId);
                    return { ok: false, status: "Too many redirects" };
                }
                current = next;
                continue;
            }

            await discardBody(res);

            if (isHttpSuccess(res.status)) {
                clearTimeout(timeoutId);
                return {
                    ok: true,
                    status: res.status,
                    statusText: responseStatusLine(res),
                    method,
                };
            }

            // HEAD sometimes returns 403/404 while GET works — one GET retry on same URL
            if (method === "HEAD" && (res.status === 403 || res.status === 404 || res.status === 405)) {
                const getRes = await fetch(safe.href, {
                    method: "GET",
                    headers: LINK_CHECK_HEADERS,
                    signal: controller.signal,
                    redirect: "manual",
                });
                if (getRes.status >= 300 && getRes.status < 400) {
                    const next = resolveRedirectTarget(safe.href, getRes.headers.get("location"));
                    await discardBody(getRes);
                    if (!next) {
                        clearTimeout(timeoutId);
                        return {
                            ok: false,
                            status: getRes.status,
                            statusText: responseStatusLine(getRes) || "Redirect without Location",
                            method: "GET",
                        };
                    }
                    if (hop === MAX_REDIRECTS) {
                        clearTimeout(timeoutId);
                        return { ok: false, status: "Too many redirects" };
                    }
                    current = next;
                    continue;
                }
                await discardBody(getRes);
                clearTimeout(timeoutId);
                if (isHttpSuccess(getRes.status)) {
                    return {
                        ok: true,
                        status: getRes.status,
                        statusText: responseStatusLine(getRes),
                        method: "GET",
                    };
                }
                return {
                    ok: false,
                    status: getRes.status,
                    statusText: responseStatusLine(getRes),
                    method: "GET",
                };
            }

            clearTimeout(timeoutId);
            return {
                ok: false,
                status: res.status,
                statusText: responseStatusLine(res),
                method,
            };
        }

        clearTimeout(timeoutId);
        return { ok: false, status: "Too many redirects" };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            return { ok: false, status: "Timeout (10s)" };
        }
        return { ok: false, status: `Fetch Error: ${error.message || "Unknown"}` };
    }
}

/** @param {string} url */
export function isPdfDatasheetUrl(url) {
    if (!url || typeof url !== "string") return true;
    const base = url.split("?")[0].toLowerCase();
    return base.endsWith(".pdf");
}
