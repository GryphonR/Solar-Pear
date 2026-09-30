/**
 * @file ControllerPicker.jsx
 * Controller picker side panel (roadmap 13.6, canvas board "System Controllers"). Lists catalogue
 * controllers allowed by the system's setup, checks each against the target arrays with the engine
 * (`evaluateElectrical`, plus `evaluateControllerPower` for the summed power), and sorts by fit, then price.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { SidePanel } from '../components/ui';
import { conditionsFromAreaSettings, evaluateControllerPower, evaluateElectrical } from '../lib/arrayAnalysis';
import { controllerMatchesSystem } from '../lib/controllerFilter';
import { CONTROLLER_FILTERS, labelOf } from '../lib/presets';
import { compareMissingLast, formatMoney, knownPrice } from '../lib/pricing';
import { portCount } from '../lib/ports';
import { ABOUT_SECTIONS } from '../lib/siteInfo';

const PAGE = 20;
const RANK = { valid: 0, warning: 1, unchecked: 2, error: 3 };
const FIT = {
    valid: { label: 'Fits', className: 'text-status-ok-fg' },
    warning: { label: 'Fits, with warnings', className: 'text-status-warning-fg' },
    error: { label: "Doesn't fit", className: 'text-status-error-fg' },
    unchecked: { label: 'Not checked', className: 'text-muted' },
};

/**
 * Worst fit of a controller across the target arrays: 'valid' | 'warning' | 'error', or 'unchecked'
 * when no target has a panel yet.
 */
export function fitOf(controller, targets, settings) {
    const conditions = conditionsFromAreaSettings(settings);
    const checked = targets.filter((t) => t.panel);
    if (checked.length === 0) return 'unchecked';
    let worst = 'valid';
    const bump = (s) => {
        if (RANK[s] > RANK[worst]) worst = s;
    };
    for (const t of checked) {
        const e = evaluateElectrical(t.panel, controller, {
            count: t.array.count,
            parallelStrings: t.array.parallelStrings || 1,
            systemVoltage: settings.systemVoltage,
            conditions,
        });
        if (!e.hardOk) bump('error');
        else if (e.issues.some((i) => i.severity === 'warning')) bump('warning');
    }
    const totalWp = checked.reduce((sum, t) => sum + t.panel.power * (t.array.count || 0), 0);
    const power = evaluateControllerPower(controller, totalWp, { systemVoltage: settings.systemVoltage, arrayCount: checked.length });
    if (power.issue?.severity === 'warning') bump('warning');
    return worst;
}

export default function ControllerPicker({ open, onClose, title, system, settings, setupTo, targets, chargers, onPick, pickLabel = 'Add', currentModelId }) {
    const [query, setQuery] = useState('');
    const [ignoreSetup, setIgnoreSetup] = useState(false);
    const [includeMisfits, setIncludeMisfits] = useState(false);
    const [shown, setShown] = useState(PAGE);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return chargers
            .filter((c) => c.id !== currentModelId)
            .filter((c) => ignoreSetup || controllerMatchesSystem(c, settings))
            .filter((c) => !q || `${c.manufacturer || ''} ${c.name} ${c.id}`.toLowerCase().includes(q))
            .map((c) => ({ c, fit: fitOf(c, targets, settings) }))
            .filter((r) => includeMisfits || r.fit !== 'error')
            .sort(
                (a, b) =>
                    RANK[a.fit] - RANK[b.fit] ||
                    compareMissingLast(knownPrice(a.c), knownPrice(b.c)) ||
                    (knownPrice(a.c) ?? 0) - (knownPrice(b.c) ?? 0) ||
                    a.c.name.localeCompare(b.c.name)
            );
    }, [chargers, currentModelId, ignoreSetup, settings, query, targets, includeMisfits]);

    const chips = [
        settings.systemVoltage ? `${settings.systemVoltage} V` : null,
        settings.systemType && settings.systemType !== 'any' ? labelOf(CONTROLLER_FILTERS, settings.systemType) : null,
        settings.systemType === 'grid-connected' && settings.filterEps ? 'EPS' : null,
        settings.systemType === 'grid-connected' && settings.filterHouseBackup ? 'Whole-house backup' : null,
    ].filter(Boolean);
    const withPanels = targets.filter((t) => t.panel);

    return (
        <SidePanel
            open={open}
            onClose={onClose}
            title={title}
            className="sticky top-0 max-h-[calc(100vh-8rem)] self-start rounded-l-[10px]"
            footer={
                <p className="text-xs text-muted">
                    Prices from UK retailers. Some buy links earn us a commission; it never changes the order.{' '}
                    <Link to={`/about#${ABOUT_SECTIONS.affiliates}`} className="text-secondary hover:underline">
                        Disclosure
                    </Link>
                </p>
            }
        >
            <div className="flex flex-col gap-3 border-b border-line-soft px-5 pb-3.5 pt-3">
                <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShown(PAGE);
                    }}
                    placeholder={`Search ${chargers.length} controllers`}
                    aria-label="Search controllers"
                    className="h-10 rounded-lg border border-line-strong px-3 text-sm"
                />
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded bg-[#EEF0EB] px-2 py-1 font-medium">From {system.name} setup:</span>
                    {chips.length === 0 ? <span className="text-muted">no filters</span> : null}
                    {chips.map((chip) => (
                        <span key={chip} className={`rounded-full border border-line-strong px-2 py-0.5 ${ignoreSetup ? 'text-muted line-through' : ''}`}>
                            {chip}
                        </span>
                    ))}
                    {chips.length > 0 ? (
                        <button type="button" onClick={() => setIgnoreSetup((v) => !v)} className="font-semibold text-secondary hover:underline">
                            {ignoreSetup ? 'Use setup filters' : 'Show all'}
                        </button>
                    ) : null}
                    <Link to={setupTo} className="ml-auto text-secondary hover:underline">
                        Edit setup
                    </Link>
                </div>
                <p className="text-xs text-muted">
                    {withPanels.length > 0
                        ? `Checked against ${withPanels
                              .map((t) => `${t.array.name}: ${t.array.count} × ${t.panel.name}`)
                              .join('; ')}, at ${settings.designLowC} °C / ${settings.designHighC} °C. Sorted by fit, then price.`
                        : 'No panel chosen yet, so nothing is checked. Sorted by price.'}
                </p>
            </div>
            <ul aria-label="Controllers">
                {rows.slice(0, shown).map(({ c, fit }) => (
                    <li key={c.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{c.manufacturer || 'Unknown'}</span>
                            <span className="truncate text-[15px] font-semibold">{c.name}</span>
                            <span className="font-plex-mono text-xs text-subtle">
                                {portCount(c)} MPPT · {c.maxV} V max
                                {c.mpptRangeMin && c.mpptRangeMax ? ` · ${c.mpptRangeMin}–${c.mpptRangeMax} V` : ''}
                            </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-semibold ${FIT[fit].className}`}>{FIT[fit].label}</span>
                            <span className="font-plex-mono text-sm font-semibold">{formatMoney(knownPrice(c), '—')}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => onPick(c)}
                            aria-label={`${pickLabel} ${c.manufacturer ? `${c.manufacturer} ` : ''}${c.name}`}
                            className="h-9 rounded-md border border-line-strong bg-white px-3.5 text-[13px] font-semibold hover:bg-brand hover:border-brand"
                        >
                            {pickLabel}
                        </button>
                    </li>
                ))}
                {rows.length === 0 ? <li className="px-5 py-6 text-sm text-muted">No controllers match. Try Show all, or include ones that don&apos;t fit.</li> : null}
                <li className="flex items-center justify-between px-5 py-3.5 text-[13px]">
                    {rows.length > shown ? (
                        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="font-semibold text-secondary hover:underline">
                            Show more ({rows.length - shown})
                        </button>
                    ) : (
                        <span className="text-muted">{rows.length} shown</span>
                    )}
                    <label className="flex items-center gap-2 text-subtle">
                        <input type="checkbox" checked={includeMisfits} onChange={(e) => setIncludeMisfits(e.target.checked)} />
                        Include ones that don&apos;t fit
                    </label>
                </li>
            </ul>
        </SidePanel>
    );
}
