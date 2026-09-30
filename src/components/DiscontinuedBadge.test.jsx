/**
 * @file DiscontinuedBadge.test.jsx
 * Discontinued products stay selectable but are labelled, with the catalogue's reason when it has one.
 * Also pins the GivEnergy records as discontinued (manufacturer in administration, April 2026).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import DiscontinuedBadge, { DiscontinuedNotice } from './DiscontinuedBadge';
import { initialChargers } from '../data/loadData';

describe('DiscontinuedBadge', () => {
    it('renders nothing for current products', () => {
        const { container } = render(<DiscontinuedBadge item={{ discontinued: false }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('labels discontinued products and uses the note as the tooltip', () => {
        render(<DiscontinuedBadge item={{ discontinued: true, discontinuedNote: 'Maker stopped trading.' }} />);
        expect(screen.getByText('Discontinued')).toHaveAttribute('title', 'Maker stopped trading.');
    });

    it('shows the reason in full, or a default explanation', () => {
        const { rerender } = render(<DiscontinuedNotice item={{ discontinued: true, discontinuedNote: 'Warranty void.' }} />);
        expect(screen.getByText(/Warranty void\./)).toBeInTheDocument();
        rerender(<DiscontinuedNotice item={{ discontinued: true, discontinuedNote: '' }} />);
        expect(screen.getByText(/design around existing or second-hand kit/)).toBeInTheDocument();
    });
});

describe('catalogue', () => {
    it('marks every GivEnergy controller as discontinued, with a reason', () => {
        const giv = initialChargers.filter((c) => c.manufacturer === 'GivEnergy');
        expect(giv.length).toBeGreaterThan(0);
        for (const c of giv) {
            expect(c.discontinued).toBe(true);
            expect(c.discontinuedNote).not.toBe('');
        }
    });
});
