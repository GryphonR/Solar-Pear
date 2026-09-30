import React from 'react';

/**
 * Load meter: a value against a limit (e.g. summed Wp against a controller's DC limit).
 * The bar turns amber above the limit and never uses colour alone: the percentage is always printed.
 * @param {{ value: number, max: number, label: string, unit?: string, className?: string }} props
 */
export default function Meter({ value, max, label, unit = 'W', className = '' }) {
    const known = Number.isFinite(max) && max > 0 && Number.isFinite(value);
    const pct = known ? Math.round((value / max) * 100) : null;
    const over = known && value > max;
    const fmt = (n) => Math.round(n).toLocaleString('en-GB');

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <div className="flex justify-between gap-4 text-[13px]">
                <span className="font-medium">{label}</span>
                <span className="font-plex-mono">
                    {known ? `${fmt(value)} / ${fmt(max)} ${unit} · ${pct}%` : 'Limit not published'}
                </span>
            </div>
            <div
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={known ? max : undefined}
                aria-valuenow={known ? value : undefined}
                aria-valuetext={known ? `${pct}% of limit${over ? ', over the limit' : ''}` : 'Limit not published'}
                className="flex h-2.5 rounded-full bg-line-soft"
            >
                {known ? (
                    <span
                        className={`h-2.5 rounded-full ${over ? 'bg-status-warning-edge' : 'bg-status-ok-fg'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                ) : null}
            </div>
        </div>
    );
}
