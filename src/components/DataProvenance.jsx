import React from 'react';
import { CheckCircle } from './Icons';

const monthLabel = (iso) => {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/**
 * Whether a catalogue item's specs have been checked by a person (roadmap 3.3).
 * Verified items get a green badge; others a quiet prompt to check the datasheet.
 * @param {{ item: { reviewed?: boolean, reviewedAt?: string } }} props
 */
export function VerificationBadge({ item }) {
    if (item?.reviewed) {
        const when = monthLabel(item.reviewedAt);
        return (
            <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800"
                title="Every specification has been checked against the manufacturer's datasheet."
                data-testid="verified-badge"
            >
                <CheckCircle size={12} className="mr-1" /> Verified against datasheet{when ? ` (${when})` : ''}
            </span>
        );
    }
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200"
            title="These specifications have not yet been checked by a person. Confirm critical values against the datasheet."
            data-testid="unverified-badge"
        >
            Specs not yet verified
        </span>
    );
}

/**
 * Source line for design notes (roadmap 3.5): AI-generated unless a person has reviewed them.
 * @param {{ item: { notesReviewed?: boolean }, className?: string }} props
 */
export function NotesSourceLabel({ item, className = 'text-xs text-slate-400 italic mb-2' }) {
    return (
        <p className={className}>
            {item?.notesReviewed ? 'Reviewed by the Solar Pear team.' : 'AI generated, may not be accurate.'}
        </p>
    );
}
