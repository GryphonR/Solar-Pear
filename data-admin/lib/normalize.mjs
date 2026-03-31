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

/** @param {string | undefined} url */
export async function checkUrl(url) {
    if (!url) return { ok: false, status: "No URL" };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: LINK_CHECK_HEADERS,
            signal: controller.signal,
            redirect: "follow",
        });

        if (isHttpSuccess(response.status)) {
            clearTimeout(timeoutId);
            return {
                ok: true,
                status: response.status,
                statusText: responseStatusLine(response),
                method: "GET",
            };
        }

        const getStatus = response.status;
        const getStatusText = responseStatusLine(response);
        if (getStatus === 404 || getStatus === 403 || getStatus === 405) {
            try {
                const headRes = await fetch(url, {
                    method: "HEAD",
                    headers: LINK_CHECK_HEADERS,
                    signal: controller.signal,
                    redirect: "follow",
                });
                if (isHttpSuccess(headRes.status)) {
                    clearTimeout(timeoutId);
                    return {
                        ok: true,
                        status: headRes.status,
                        statusText: responseStatusLine(headRes),
                        method: "HEAD",
                    };
                }
            } catch {
                /* fall through */
            }
        }

        clearTimeout(timeoutId);
        return { ok: false, status: getStatus, statusText: getStatusText, method: "GET" };
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
