import React from 'react';
import { STATUS, statusKey } from './statusConfig';

const ICON_PROPS = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
};

export function StatusIcon({ status, size = 14 }) {
    const props = { ...ICON_PROPS, width: size, height: size };
    if (status === 'error') {
        return (
            <svg {...props}>
                <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z" />
                <path d="m15 9-6 6M9 9l6 6" />
            </svg>
        );
    }
    if (status === 'warning') {
        return (
            <svg {...props}>
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                <path d="M12 9v4M12 17h.01" />
            </svg>
        );
    }
    if (status === 'info') {
        return (
            <svg {...props}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
            </svg>
        );
    }
    if (status === 'valid') {
        return (
            <svg {...props}>
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 3 3 5-6" />
            </svg>
        );
    }
    return null;
}

/**
 * Status pill: icon + word + colour. "Not set" has no icon and a dashed outline so it never reads as checked.
 * @param {{ status?: 'error'|'warning'|'info'|'valid'|'unset', children?: React.ReactNode, className?: string }} props
 *   `children` overrides the default word, e.g. "1 warning".
 */
export default function StatusPill({ status, children, className = '' }) {
    const key = statusKey(status);
    const { label, classes } = STATUS[key];
    return (
        <span
            data-status={key}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold whitespace-nowrap ${classes} ${className}`}
        >
            <StatusIcon status={key} />
            {children ?? label}
        </span>
    );
}
