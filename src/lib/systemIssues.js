/**
 * @file systemIssues.js
 * The Issues list under the single line diagram (roadmap 13.7, 7.5): every engine finding for a system,
 * with a heading, why (the engine's message), the datasheet fields used and a fix, plus the gaps that
 * stop a check from running (unfinished arrays, unknown prices). Pure; reads `analyzeArray` output only.
 */

import { adviceFor } from './issueAdvice';
import { LINK_CODES } from './sldLayout';
import { hasKnownPrice } from './pricing';

const POWER_CODES = ['chargerPower', 'dcPower'];
const RANK = { error: 0, warning: 1, info: 2 };

/**
 * @param {{ arrays: Array<{ id, name, status, progress, analysis }>, units: Array<{ instance, model, ports }> }} input
 * @returns {Array<{ id, severity: 'error'|'warning'|'info', code, title, why, fix, fields: string[], where, arrayId?, instanceId?, missing? }>}
 */
export function systemIssues({ arrays = [], units = [] }) {
    const items = [];
    const seen = new Set();
    const portOf = new Map(units.flatMap((u) => u.ports.filter((p) => p.arrayId).map((p) => [p.arrayId, { unit: u, port: p.port }])));
    const unitName = (u) => u.model?.name || u.instance.name || 'Controller';

    for (const entry of arrays) {
        const a = entry.analysis;
        if (entry.status === 'unset') {
            const p = entry.progress || {};
            const missing = !p.layout ? 'layout' : !p.panel ? 'panel' : 'controller';
            const text = {
                layout: 'No panel count or layout yet, so this array isn’t checked or counted.',
                panel: p.controller ? 'No panel yet, so this array isn’t checked or counted.' : 'No panel or controller yet, so this array isn’t checked or counted.',
                controller: 'Not on a controller port yet, so its voltage and current aren’t checked.',
            }[missing];
            items.push({ id: `unset:${entry.id}`, severity: 'info', code: 'unset', title: null, why: text, fix: null, fields: [], where: entry.name, arrayId: entry.id, missing, needsController: !p.controller });
        }
        if (!a) continue;
        const at = portOf.get(entry.id);
        for (const issue of a.issues || []) {
            const power = POWER_CODES.includes(issue.code);
            const key = power && at ? `${at.unit.instance.id}:${issue.code}` : `${entry.id}:${issue.code}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const where = power && at
                ? unitName(at.unit)
                : LINK_CODES.includes(issue.code) && at
                  ? `${entry.name} → ${unitName(at.unit)} MPPT ${at.port}`
                  : entry.name;
            items.push({
                id: key,
                severity: issue.severity,
                code: issue.code,
                ...adviceFor(issue, a.panel, a.controller),
                where,
                arrayId: power ? undefined : entry.id,
                instanceId: at?.unit.instance.id,
            });
        }
        if (a.panel && !hasKnownPrice(a.panel) && !seen.has(`price:${a.panel.model}`)) {
            seen.add(`price:${a.panel.model}`);
            items.push({ id: `price:${a.panel.model}`, severity: 'info', code: 'price', title: null, why: `${a.panel.name || a.panel.model}: price unknown. The system cost is incomplete until it has one.`, fix: null, fields: [], where: entry.name, arrayId: entry.id });
        }
    }
    for (const u of units) {
        if (u.model && !hasKnownPrice(u.model)) {
            items.push({ id: `price:${u.instance.id}`, severity: 'info', code: 'price', title: null, why: 'Price unknown. The system cost is incomplete until it has one.', fix: null, fields: [], where: unitName(u), instanceId: u.instance.id });
        }
    }
    return items.sort((x, y) => RANK[x.severity] - RANK[y.severity]);
}

/** Counts by severity for the Issues header. */
export function issueCounts(items) {
    const n = (s) => items.filter((i) => i.severity === s).length;
    return { error: n('error'), warning: n('warning'), info: n('info') };
}
