import React from 'react';

const DEFAULT_REASON = 'No longer made. Still listed so you can design around existing or second-hand kit.';

/**
 * "Discontinued" pill for a panel or controller record. Discontinued products stay selectable.
 * @param {{ item: { discontinued?: boolean, discontinuedNote?: string } | null | undefined }} props
 */
export default function DiscontinuedBadge({ item }) {
    if (!item?.discontinued) return null;
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap"
            title={item.discontinuedNote || DEFAULT_REASON}
        >
            Discontinued
        </span>
    );
}

/**
 * Full explanation for info modals, where a hover title isn't enough (touch screens).
 * @param {{ item: { discontinued?: boolean, discontinuedNote?: string } | null | undefined }} props
 */
export function DiscontinuedNotice({ item }) {
    if (!item?.discontinued) return null;
    return (
        <p className="mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="font-semibold">Discontinued.</span> {item.discontinuedNote || DEFAULT_REASON}
        </p>
    );
}
