/**
 * @file siteInfo.js
 * Operator details, public links and helpers shared by the trust and legal pages (roadmap phase 6).
 */

/** Who runs the site. Shown in the footer and on the legal pages. */
export const OPERATOR_NAME = 'eChook';

export const REPO_URL = 'https://github.com/GryphonR/Solar-Pear';

/** Public changelog of catalogue corrections (roadmap 6.6). */
export const DATA_CHANGELOG_URL = `${REPO_URL}/blob/main/changelogs/data-corrections.md`;

/** Date the legal and policy text last changed materially. Shown on the About & legal page. */
export const LEGAL_LAST_UPDATED = '30 September 2026';

/** Tab id of the About & legal page, and the ids of its sections (used as in-page anchors). */
export const ABOUT_TAB = 'ABOUT';
export const METHODOLOGY_TAB = 'METHODOLOGY';
export const ABOUT_SECTIONS = Object.freeze({
    disclaimer: 'disclaimer',
    affiliates: 'affiliate-disclosure',
    pricing: 'pricing-and-independence',
    data: 'data-sources',
    privacy: 'privacy',
    terms: 'terms',
});

/**
 * Link to the GitHub "Data correction" issue form, prefilled for one catalogue item.
 *
 * @param {'panel' | 'controller'} kind
 * @param {{ name?: string, model?: string, id?: string, manufacturer?: string }} item
 * @returns {string}
 */
export function dataCorrectionIssueUrl(kind, item) {
    const name = item?.name || item?.model || item?.id || '';
    // Many names already start with the brand ("Deye SUN-3.6K…"); don't repeat it.
    const brand = item?.manufacturer && !name.toLowerCase().startsWith(item.manufacturer.toLowerCase())
        ? item.manufacturer
        : '';
    const label = [brand, name].filter(Boolean).join(' ');
    const idPart = kind === 'panel' ? item?.model : item?.id;
    const params = new URLSearchParams({
        template: 'data-correction.yml',
        title: `[Data] ${label}: `,
        kind: kind === 'panel' ? 'Panel' : 'Controller / inverter',
        model: idPart && idPart !== label ? `${label} (${idPart})` : label,
    });
    return `${REPO_URL}/issues/new?${params.toString()}`;
}
