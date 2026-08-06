/**
 * @file DesignNotes.jsx
 * Renders a panel/controller "Design Notes" string as separate paragraphs, with the
 * "Technology:", "Pros:" and "Cons:" lead-ins (see src/data/panels/SCHEMA.md) shown in bold.
 *
 * The underlying `notes` field is still stored as a single plain-text string with no markdown -
 * this component only reformats it for display, so no data migration is needed and the
 * data-admin textarea editor keeps working exactly as before.
 */
import React from 'react';

// Matches the start of each standard lead-in so the note can be split into one segment per
// section. The lookahead keeps the label attached to the text that follows it.
const SECTION_SPLIT = /(?=(?:Technology|Pros|Cons):)/g;

// Pulls the label (without its colon) and the remaining text out of a single segment.
const SECTION_MATCH = /^(Technology|Pros|Cons):\s*(.*)$/s;

/**
 * @param {object} props
 * @param {string} [props.notes] - The raw design notes string for a panel or controller.
 * @param {string} [props.fallback] - Text shown when there are no notes to display.
 * @param {string} [props.className] - Classes applied to the wrapping element, so callers can
 *   keep matching the text sizing/colour used elsewhere on the page.
 */
export default function DesignNotes({ notes, fallback = 'No specific design notes for this module.', className = '' }) {
    if (!notes) {
        return <p className={className}>{fallback}</p>;
    }

    const segments = notes.split(SECTION_SPLIT).filter((segment) => segment.trim());

    // Free-form notes that don't use the standard lead-ins (e.g. a controller's notes, or a
    // one-off panel with no series) render as a single plain paragraph rather than guessing.
    if (segments.length <= 1) {
        return <p className={className}>{notes}</p>;
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {segments.map((segment, i) => {
                const match = segment.match(SECTION_MATCH);
                if (!match) {
                    return <p key={i}>{segment.trim()}</p>;
                }
                const [, label, text] = match;
                return (
                    <p key={i}>
                        <strong className="font-bold text-slate-800">{label}:</strong> {text.trim()}
                    </p>
                );
            })}
        </div>
    );
}
