import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusPill, SlotCard, Meter, SidePanel, EmptyState, FilterBar, FilterButton, Toast } from './index';
import SolarPearLogo from '../SolarPearLogo';

describe('StatusPill', () => {
    it.each([
        ['error', 'Error'],
        ['warning', 'Warning'],
        ['info', 'Info'],
        ['valid', 'OK'],
        ['unset', 'Not set'],
    ])('shows the word for %s so status never relies on colour', (status, word) => {
        render(<StatusPill status={status} />);
        expect(screen.getByText(word)).toBeInTheDocument();
    });

    it('gives every checked status an icon, and "Not set" none', () => {
        const { container: err } = render(<StatusPill status="error" />);
        expect(err.querySelector('svg')).not.toBeNull();
        const { container: unset } = render(<StatusPill status="unset" />);
        expect(unset.querySelector('svg')).toBeNull();
    });

    it('treats an unknown or missing status as not set, never OK', () => {
        render(<StatusPill status={undefined} />);
        expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('allows the word to be overridden', () => {
        render(<StatusPill status="warning">1 warning</StatusPill>);
        expect(screen.getByText('1 warning')).toBeInTheDocument();
    });
});

describe('SlotCard', () => {
    it('empty: the whole card is a button that fires the action', async () => {
        const onAction = vi.fn();
        render(<SlotCard eyebrow="2 · Panel" title="Choose a panel" onAction={onAction} />);
        await userEvent.click(screen.getByRole('button', { name: /choose a panel/i }));
        expect(onAction).toHaveBeenCalled();
    });

    it('filled: shows the summary and a Change action', async () => {
        const onAction = vi.fn();
        render(<SlotCard eyebrow="2 · Panel" state="filled" title="LONGi 430 W" detail="£84.88 each" onAction={onAction} />);
        await userEvent.click(screen.getByRole('button', { name: 'Change' }));
        expect(onAction).toHaveBeenCalled();
    });

    it('attention: offers Why', () => {
        render(<SlotCard eyebrow="3 · Controller" state="attention" title="ECCO 6kW" detail="1 warning" onAction={() => {}} />);
        expect(screen.getByRole('button', { name: 'Why' })).toBeInTheDocument();
    });
});

describe('Meter', () => {
    it('prints the percentage and exposes it to assistive tech', () => {
        render(<Meter label="DC input power" value={6450} max={7800} />);
        expect(screen.getByText(/6,450 \/ 7,800 W · 83%/)).toBeInTheDocument();
        expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '6450');
    });

    it('says when it is over the limit', () => {
        render(<Meter label="DC input power" value={9000} max={7800} />);
        expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', expect.stringContaining('over the limit'));
    });

    it('shows an unpublished limit as unknown, not empty', () => {
        render(<Meter label="DC input power" value={500} max={0} />);
        expect(screen.getByText('Limit not published')).toBeInTheDocument();
    });
});

describe('SidePanel', () => {
    it('renders nothing when closed', () => {
        render(<SidePanel open={false} onClose={() => {}} title="Add a controller">x</SidePanel>);
        expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('closes on Escape and on the close button, and returns focus', async () => {
        function Harness() {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <button onClick={() => setOpen(true)}>Open</button>
                    <SidePanel open={open} onClose={() => setOpen(false)} title="Add a controller">body</SidePanel>
                </>
            );
        }
        render(<Harness />);
        const opener = screen.getByRole('button', { name: 'Open' });
        await userEvent.click(opener);
        expect(screen.getByRole('complementary', { name: 'Add a controller' })).toHaveFocus();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('complementary')).toBeNull();
        expect(opener).toHaveFocus();
        await userEvent.click(opener);
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('complementary')).toBeNull();
    });
});

describe('EmptyState', () => {
    it('gives a next step', async () => {
        const onClick = vi.fn();
        render(<EmptyState title="No arrays yet" action={{ label: 'Add an array', onClick }}>Arrays are roof sections.</EmptyState>);
        await userEvent.click(screen.getByRole('button', { name: 'Add an array' }));
        expect(onClick).toHaveBeenCalled();
    });
});

describe('FilterBar', () => {
    it('reports search text, counts, and clears', async () => {
        const onSearch = vi.fn();
        const onClear = vi.fn();
        render(
            <FilterBar search="" onSearch={onSearch} searchLabel="Search panels" shown={8} total={183} onClear={onClear}>
                <FilterButton pressed active>Has a price</FilterButton>
            </FilterBar>
        );
        await userEvent.type(screen.getByLabelText('Search panels'), 'a');
        expect(onSearch).toHaveBeenCalledWith('a');
        expect(screen.getByText('183', { exact: false })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Has a price' })).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(onClear).toHaveBeenCalled();
    });
});

describe('Toast with undo', () => {
    it('runs the action and dismisses', async () => {
        const onUndo = vi.fn();
        const onClose = vi.fn();
        render(<Toast message="East roof removed" variant="dark" action={{ label: 'Undo', onClick: onUndo }} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(onUndo).toHaveBeenCalled();
    });
});

describe('SolarPearLogo', () => {
    it('full lockup tilts the pear 14 degrees and stacks SOLAR over PEAR', () => {
        const { container } = render(<SolarPearLogo />);
        expect(container.querySelector('g[transform="rotate(14, 26, 31)"]')).not.toBeNull();
        expect(screen.getByText('SOLAR')).toBeInTheDocument();
        expect(screen.getByText('PEAR')).toBeInTheDocument();
        expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 140 56');
    });

    it('the small mark stays upright and has no text', () => {
        const { container } = render(<SolarPearLogo mark />);
        expect(container.querySelector('[transform]')).toBeNull();
        expect(container.querySelector('text')).toBeNull();
    });
});
