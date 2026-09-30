/**
 * @file layoutRanking.js
 * How the layout planner ranks layouts by power. Kept apart from `plannerEngine.js` so the planner views
 * and the engine share one rule.
 */

/**
 * Layouts whose power is within this fraction of a better layout count as a near-tie, and the one with
 * fewer panels ranks first: about the same power from fewer modules needs less mounting kit, fewer
 * connectors and less labour.
 */
export const NEAR_TIE_FRACTION = 0.03;

/**
 * Orders items by power, most first, letting near-ties rank by fewer panels. An item more than
 * `fraction` below the current band's leader starts a new band, so the order is well defined.
 * Inside a band: fewer panels first, then more power.
 * @param {object[]} items
 * @param {(item) => number} powerOf
 * @param {(item) => number} countOf
 * @param {number} [fraction]
 * @returns {object[]} a new array
 */
export function rankByPowerWithNearTies(items, powerOf, countOf, fraction = NEAR_TIE_FRACTION) {
    const sorted = [...items].sort((a, b) => powerOf(b) - powerOf(a) || countOf(a) - countOf(b));
    const out = [];
    let band = [];
    let leader = null;
    const flush = () => {
        band.sort((a, b) => countOf(a) - countOf(b) || powerOf(b) - powerOf(a));
        out.push(...band);
        band = [];
    };
    for (const item of sorted) {
        if (leader == null || powerOf(item) < powerOf(leader) * (1 - fraction)) {
            flush();
            leader = item;
        }
        band.push(item);
    }
    flush();
    return out;
}
