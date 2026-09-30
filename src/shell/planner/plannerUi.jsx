/**
 * @file plannerUi.jsx
 * Small pieces shared by the layout planner screens (roadmap 13.8).
 */

import React, { useState } from 'react';

export const SOLARWIZARD = 'https://solarwizard.org.uk';

/** Number input with a unit suffix. Keeps the text while typing; `onChange` gets the raw string. */
export function NumberField({ label, unit, value, onChange, onBlur, aria, placeholder, step = 'any', className = '' }) {
    return (
        <label className={`flex flex-col gap-1 text-xs font-medium text-subtle ${className}`}>
            {label}
            <span className="flex h-9 items-center rounded-md border border-line-strong bg-white focus-within:ring-2 focus-within:ring-secondary">
                <input
                    type="number"
                    inputMode="decimal"
                    step={step}
                    value={value}
                    placeholder={placeholder}
                    aria-label={aria || label}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    className="h-full w-full min-w-0 rounded-md bg-transparent px-2.5 font-plex-mono text-sm text-body outline-none"
                />
                <span className="pr-2.5 font-plex-mono text-xs text-muted">{unit}</span>
            </span>
        </label>
    );
}

export function ShapeIcon({ shape, size = 22 }) {
    const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round', 'aria-hidden': true };
    if (shape === 'hipped') return <svg {...common}><path d="M7 6h10l5 12H2z" /></svg>;
    if (shape === 'draw') return <svg {...common}><path d="M3 18 6 5l7 4 8-3-2 12z" /><circle cx="6" cy="5" r="1.4" fill="currentColor" /><circle cx="13" cy="9" r="1.4" fill="currentColor" /></svg>;
    return <svg {...common}><rect x="3" y="6" width="18" height="12" /></svg>;
}

/**
 * "I know my panel count": sets the count (and optional size and weight limits for the panel list)
 * without the planner, like the old "Manually defined" mode.
 */
export function ManualCountForm({ array, onSave, onCancel }) {
    const [draft, setDraft] = useState({
        count: String(array.count ?? ''),
        maxPanelHeight: String(array.maxPanelHeight ?? ''),
        maxPanelWidth: String(array.maxPanelWidth ?? ''),
        maxPanelWeight: String(array.maxPanelWeight ?? ''),
    });
    const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
    const count = parseInt(draft.count, 10);
    const opt = (v, parse) => (v === '' ? '' : parse(v) || '');
    return (
        <form
            aria-label="Panel count"
            onSubmit={(e) => {
                e.preventDefault();
                if (!(count > 0)) return;
                onSave({
                    count,
                    maxPanelHeight: opt(draft.maxPanelHeight, (v) => parseInt(v, 10)),
                    maxPanelWidth: opt(draft.maxPanelWidth, (v) => parseInt(v, 10)),
                    maxPanelWeight: opt(draft.maxPanelWeight, parseFloat),
                });
            }}
            className="flex flex-col gap-3"
        >
            <NumberField label="Panels" unit="" step="1" value={draft.count} onChange={set('count')} aria="Number of panels" />
            <p className="text-xs text-muted">Optional limits, used to filter the panel list:</p>
            <div className="grid grid-cols-3 gap-2">
                <NumberField label="Max height" unit="mm" value={draft.maxPanelHeight} onChange={set('maxPanelHeight')} aria="Maximum panel height in millimetres" />
                <NumberField label="Max width" unit="mm" value={draft.maxPanelWidth} onChange={set('maxPanelWidth')} aria="Maximum panel width in millimetres" />
                <NumberField label="Max weight" unit="kg" value={draft.maxPanelWeight} onChange={set('maxPanelWeight')} aria="Maximum panel weight in kilograms" />
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={!(count > 0)} className="h-9 rounded-md bg-brand px-4 text-sm font-semibold text-ink disabled:bg-line-soft disabled:text-muted">
                    Save panel count
                </button>
                <button type="button" onClick={onCancel} className="h-9 rounded-md border border-line-strong bg-white px-4 text-sm">
                    Cancel
                </button>
            </div>
        </form>
    );
}
