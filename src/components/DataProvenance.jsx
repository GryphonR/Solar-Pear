import React from 'react';

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
