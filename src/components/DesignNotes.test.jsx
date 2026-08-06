/**
 * @file DesignNotes.test.jsx
 * Confirms the standard "Technology: ... Pros: ... Cons: ..." note format (see
 * src/data/panels/SCHEMA.md) is split into one paragraph per section with the lead-in bolded,
 * and that free-form notes (no series, or a controller's notes) still render sensibly.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import DesignNotes from './DesignNotes';

describe('DesignNotes', () => {
    it('splits a standard Technology/Pros/Cons note into three paragraphs', () => {
        const notes = 'Technology: N-Type TOPCon cells. Pros: cheap and widely available. Cons: lower efficiency than ABC.';
        render(<DesignNotes notes={notes} />);

        expect(screen.getByText('Technology:').tagName).toBe('STRONG');
        expect(screen.getByText(/N-Type TOPCon cells\./)).toBeInTheDocument();
        expect(screen.getByText('Pros:').tagName).toBe('STRONG');
        expect(screen.getByText(/cheap and widely available\./)).toBeInTheDocument();
        expect(screen.getByText('Cons:').tagName).toBe('STRONG');
        expect(screen.getByText(/lower efficiency than ABC\./)).toBeInTheDocument();
    });

    it('renders free-form notes with no Technology/Pros/Cons lead-ins as a single paragraph', () => {
        // e.g. a "(no series)" panel, or a controller's notes - neither follows the panel
        // series format, so there is nothing to split on.
        const notes = 'All-in-one solar solution: MultiPlus 12/1600/70 + MPPT 100/50 + AC Distribution.';
        render(<DesignNotes notes={notes} />);

        expect(screen.getByText(notes).tagName).toBe('P');
    });

    it('shows the fallback text when there are no notes', () => {
        render(<DesignNotes notes="" fallback="No specific design notes for this module." />);

        expect(screen.getByText('No specific design notes for this module.')).toBeInTheDocument();
    });
});
