/**
 * Price helpers (roadmap 2.2 / 2.3). A price of 0, blank or missing means "unknown", never free.
 */

/** Prices checked longer ago than this are flagged as possibly out of date. */
export const PRICE_STALE_DAYS = 60;

export function hasKnownPrice(item) {
    const n = Number(item?.price);
    return Number.isFinite(n) && n > 0;
}

/** Unit price, or null when unknown. */
export function knownPrice(item) {
    return hasKnownPrice(item) ? Number(item.price) : null;
}

const GBP = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** "£1,234.50", or the fallback for null/undefined/non-finite values. */
export function formatMoney(value, fallback = '—') {
    if (value == null || !Number.isFinite(Number(value))) return fallback;
    return GBP.format(Number(value));
}

/** Unit price for display: "£84.88" or "Price unavailable". */
export function formatUnitPrice(item, fallback = 'Price unavailable') {
    return hasKnownPrice(item) ? formatMoney(item.price) : fallback;
}

/**
 * How old a price check is.
 * @param {string} priceCheckedAt - ISO date (YYYY-MM-DD) or blank
 * @param {Date} [now]
 * @returns {{ label: string, days: number, isStale: boolean } | null}
 */
export function priceAge(priceCheckedAt, now = new Date()) {
    if (typeof priceCheckedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(priceCheckedAt)) return null;
    const checked = new Date(`${priceCheckedAt.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(checked.getTime())) return null;
    const days = Math.max(0, Math.floor((now.getTime() - checked.getTime()) / 86400000));
    const label = checked.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return { label, days, isStale: days > PRICE_STALE_DAYS };
}

/** "Price checked Aug 2026" (with "may be out of date" when stale), or "" when unknown. */
export function priceAgeText(priceCheckedAt, now = new Date()) {
    const age = priceAge(priceCheckedAt, now);
    if (!age) return '';
    return age.isStale ? `Price checked ${age.label} (may be out of date)` : `Price checked ${age.label}`;
}

/**
 * Sort comparator helper that always puts null/undefined last regardless of direction.
 * @returns {number | null} comparison result, or null when neither value is missing
 */
export function compareMissingLast(a, b) {
    const aMissing = a == null || Number.isNaN(a);
    const bMissing = b == null || Number.isNaN(b);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return null;
}
