import React from 'react';

/**
 * Table cell with optional bar background (scaled by value within range).
 * @param {number|null|undefined} value - Value to display and use for bar ratio
 * @param {[number, number]} range - [min, max] for bar scaling (same range = 100% bar)
 * @param {boolean} [incompatible=false] - When true, use red-tinted background
 * @param {function(number): string} [formatter] - Format value for display; default renders value as-is
 * @param {string} [className] - Additional cell classes (e.g. for text color)
 */
export default function BarCell({
    value,
    range,
    incompatible = false,
    formatter,
    className = '',
}) {
    const [min, max] = range || [0, 0];
    const ratio =
        value == null || min === max
            ? (min === max && value != null ? 1 : 0)
            : (Number(value) - min) / (max - min);
    const barPct = Math.min(100, Math.max(0, ratio * 100));
    const cellBg = incompatible ? '#fee2e2' : '#ffffff';

    const display = formatter != null ? formatter(value) : value;

    return (
        <td
            className={`py-2 px-3 relative border-r border-slate-200/70 ${className}`}
            style={{ background: cellBg }}
        >
            {barPct > 0 && (
                <span
                    className="absolute inset-y-0 left-0 rounded-[4px] pointer-events-none"
                    style={{
                        width: `${barPct}%`,
                        background: 'rgba(0,0,0,0.08)',
                    }}
                />
            )}
            <span className="relative z-10">{display}</span>
        </td>
    );
}
