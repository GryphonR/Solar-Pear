/**
 * @file panelTechnology.test.js
 * Covers the classification the Guide to Panels relies on, and pins the physical claims that
 * page makes about module construction against the real bundled database.
 */

import { describe, it, expect } from 'vitest';
import { initialPanels } from '../data/loadData.js';
import {
    PANEL_TECH,
    GLASS_TYPE,
    classifyPanelTechnology,
    classifyGlassType,
    getTotalGlassThicknessMm,
    getPanelAreaM2,
    getPanelMassPerAreaKgM2,
    getHalfCellCount,
    groupPanelsByTechnology,
    groupPanelsByCellCount,
    summarisePanelGroup,
    summariseGlassBuilds,
} from './panelTechnology';

describe('classifyPanelTechnology', () => {
    it('recognises each back-contact family as back-contact', () => {
        for (const cells of ['108 Half-Cell (ABC)', '108 Half-Cell (HPBC)', '66 IBC (Maxeon 6)']) {
            expect(classifyPanelTechnology({ cells })).toBe(PANEL_TECH.BACK_CONTACT);
        }
    });

    it('recognises TOPCon however the datasheet prefixes it', () => {
        for (const cells of [
            '108 Half-Cell (TOPCon)',
            '144 Half-Cell (i-TOPCon)',
            '96 Half-Cell (N-TOPCon 210R)',
        ]) {
            expect(classifyPanelTechnology({ cells })).toBe(PANEL_TECH.TOPCON);
        }
    });

    it('classifies an n-type wafer by its architecture, not its doping', () => {
        expect(classifyPanelTechnology({ cells: '108 Half-Cell (N-Type TOPCon)' })).toBe(
            PANEL_TECH.TOPCON
        );
        // Doping alone is not an architecture, so it must not become a group of its own.
        expect(classifyPanelTechnology({ cells: '108 Half-Cell (N-Type)' })).toBeNull();
    });

    it('treats Q.ANTUM as the PERC derivative it is', () => {
        expect(classifyPanelTechnology({ cells: '108 Half-Cell (Q.ANTUM)' })).toBe(PANEL_TECH.PERC);
        expect(classifyPanelTechnology({ cells: '132 Half-Cell (PERC)' })).toBe(PANEL_TECH.PERC);
    });

    it('does not lump the newer Q.ANTUM NEO in with plain Q.ANTUM PERC', () => {
        // Q.ANTUM NEO (Q.TRON) is a different, newer N-type architecture; Qcells' own
        // datasheets do not name it more specifically, so it should go uncited rather than
        // being mislabelled as PERC just because the names share a word.
        expect(classifyPanelTechnology({ cells: '96 Half-Cell (N-Type Q.ANTUM NEO)' })).toBeNull();
    });

    it('recognises heterojunction cells', () => {
        expect(classifyPanelTechnology({ cells: '80 Half-Cell (HJT)' })).toBe(PANEL_TECH.HJT);
    });

    it('returns null rather than guessing when no architecture is named', () => {
        // Nothing is inferred from model or series names, so an unlabelled entry stays uncited.
        for (const cells of ['132 Half-Cell', '120', 'LR7-54HVB-475', 'N-Type', '', undefined]) {
            expect(classifyPanelTechnology({ cells })).toBeNull();
        }
        expect(classifyPanelTechnology({})).toBeNull();
    });
});

describe('glass construction', () => {
    it('classifies single, dual and polymer builds', () => {
        expect(classifyGlassType({ glass: 'Single (3.2mm)' })).toBe(GLASS_TYPE.SINGLE);
        expect(classifyGlassType({ glass: 'Standard Tempered' })).toBe(GLASS_TYPE.SINGLE);
        expect(classifyGlassType({ glass: 'Dual (1.6mm + 1.6mm)' })).toBe(GLASS_TYPE.DUAL);
        expect(classifyGlassType({ glass: 'Glass-Glass' })).toBe(GLASS_TYPE.DUAL);
        expect(classifyGlassType({ glass: 'ETFE Coating' })).toBe(GLASS_TYPE.POLYMER);
        expect(classifyGlassType({ glass: '' })).toBe(GLASS_TYPE.UNKNOWN);
    });

    it('drops unknown-thickness builds and respects the minimum count', () => {
        const panels = [
            { glass: 'Single (3.2mm)', height: 2000, width: 1000, weight: 22 },
            { glass: 'Single (3.2mm)', height: 2000, width: 1000, weight: 23 },
            // No thickness stated, so this build cannot be compared on thickness.
            { glass: 'Glass-Glass', height: 2000, width: 1000, weight: 28 },
            { glass: 'Glass-Glass', height: 2000, width: 1000, weight: 29 },
        ];

        expect(summariseGlassBuilds(panels).map((b) => b.totalGlassMm)).toEqual([3.2]);
        // Raising the threshold above the group size drops the remaining build too.
        expect(summariseGlassBuilds(panels, 3)).toEqual([]);
    });

    it('sums both panes so equal total glass compares equal', () => {
        // The guide's central point about weight: 1.6 + 1.6 is the same glass as one 3.2 pane.
        expect(getTotalGlassThicknessMm({ glass: 'Dual (1.6mm + 1.6mm)' })).toBeCloseTo(3.2);
        expect(getTotalGlassThicknessMm({ glass: 'Single (3.2mm)' })).toBeCloseTo(3.2);
        expect(getTotalGlassThicknessMm({ glass: 'Dual (2.0mm + 2.0mm)' })).toBeCloseTo(4.0);
        expect(getTotalGlassThicknessMm({ glass: 'Single (3.2mm AR Coated)' })).toBeCloseTo(3.2);
        expect(getTotalGlassThicknessMm({ glass: 'Glass-Glass' })).toBeNull();
    });
});

describe('area-normalised mass', () => {
    it('computes area and mass per area from millimetre dimensions', () => {
        const panel = { height: 2000, width: 1000, weight: 22 };
        expect(getPanelAreaM2(panel)).toBeCloseTo(2.0);
        expect(getPanelMassPerAreaKgM2(panel)).toBeCloseTo(11.0);
    });

    it('returns null when a dimension or the weight is missing', () => {
        expect(getPanelAreaM2({ height: 2000 })).toBeNull();
        expect(getPanelMassPerAreaKgM2({ height: 2000, width: 1000 })).toBeNull();
    });
});

describe('cell counts', () => {
    it('reads the half-cell count and ignores entries without one', () => {
        expect(getHalfCellCount({ cells: '108 Half-Cell (TOPCon)' })).toBe(108);
        expect(getHalfCellCount({ cells: '144 Half Cell' })).toBe(144);
        expect(getHalfCellCount({ cells: '36-Cell Monocrystalline' })).toBeNull();
    });

    it('groups by cell count ascending', () => {
        const groups = groupPanelsByCellCount([
            { cells: '144 Half-Cell', voc: 50, isc: 14 },
            { cells: '108 Half-Cell', voc: 38, isc: 14 },
            { cells: 'no count here' },
        ]);
        expect(groups.map((g) => g.cellCount)).toEqual([108, 144]);
    });
});

describe('summarisePanelGroup', () => {
    it('reports ranges, averages and the highest-efficiency examples', () => {
        const summary = summarisePanelGroup(
            [
                { name: 'low', efficiency: 21, power: 400, tempCoefPmax: -0.3, bifacial: false },
                { name: 'high', efficiency: 23, power: 440, tempCoefPmax: -0.28, bifacial: true },
            ],
            1
        );

        expect(summary.count).toBe(2);
        expect(summary.efficiency).toEqual({ min: 21, max: 23 });
        expect(summary.power).toEqual({ min: 400, max: 440 });
        expect(summary.avgTempCoefPmax).toBeCloseTo(-0.29);
        expect(summary.bifacialCount).toBe(1);
        expect(summary.examples.map((p) => p.name)).toEqual(['high']);
    });

    it('handles an empty group without throwing', () => {
        const summary = summarisePanelGroup([]);
        expect(summary.count).toBe(0);
        expect(summary.efficiency).toBeNull();
        expect(summary.avgTempCoefPmax).toBeNull();
    });
});

describe('against the bundled panel database', () => {
    it('classifies the large majority of panels', () => {
        const groups = groupPanelsByTechnology(initialPanels);
        const classified = Object.values(groups).reduce((sum, list) => sum + list.length, 0);

        // Examples are only cited for panels whose entry names an architecture, so coverage
        // should stay high enough for every section of the guide to have something to show.
        expect(classified / initialPanels.length).toBeGreaterThan(0.7);
    });

    it('names an architecture wherever an entry states the wafer doping', () => {
        // Every n-type entry was checked against its manufacturer's material and names its cell
        // design, so none should fall through to uncited for want of an architecture.
        for (const panel of initialPanels) {
            if (!/\bN-?Type\b/i.test(panel.cells ?? '')) continue;
            expect(classifyPanelTechnology(panel)).not.toBeNull();
        }
    });

    it('finds panels for every architecture the guide has a section for', () => {
        const groups = groupPanelsByTechnology(initialPanels);
        for (const tech of [
            PANEL_TECH.PERC,
            PANEL_TECH.TOPCON,
            PANEL_TECH.HJT,
            PANEL_TECH.BACK_CONTACT,
        ]) {
            expect(groups[tech]?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('shows newer architectures with gentler temperature coefficients than PERC', () => {
        // The guide states this progression, so it should hold in the catalogue it cites.
        const groups = groupPanelsByTechnology(initialPanels);
        const avg = (tech) => summarisePanelGroup(groups[tech] || []).avgTempCoefPmax;

        const perc = avg(PANEL_TECH.PERC);
        expect(avg(PANEL_TECH.TOPCON)).toBeGreaterThan(perc);
        expect(avg(PANEL_TECH.HJT)).toBeGreaterThan(perc);
        expect(avg(PANEL_TECH.BACK_CONTACT)).toBeGreaterThan(perc);
    });

    it('omits builds whose thickness the manufacturer never published', () => {
        // Viridian and Victron state only "glass-glass" or "tempered", so those entries carry no
        // thickness. They must not reach the comparison table, which is about thickness vs weight.
        for (const build of summariseGlassBuilds(initialPanels)) {
            expect(build.totalGlassMm).not.toBeNull();
        }

        // The panels themselves are still classified by construction, which is stated.
        const unstated = initialPanels.filter(
            (p) => getTotalGlassThicknessMm(p) == null && classifyGlassType(p) === GLASS_TYPE.DUAL
        );
        expect(unstated.length).toBeGreaterThan(0);
    });

    it('confirms dual 1.6+1.6 glass is no heavier per area than single 3.2 glass', () => {
        // The guide claims total glass thickness drives weight, not the number of panes. Raw
        // kilograms hide this because larger modules dominate, so compare kg/m².
        const builds = summariseGlassBuilds(initialPanels);
        const dualThin = builds.find((b) => b.type === GLASS_TYPE.DUAL && b.totalGlassMm === 3.2);
        const singleThick = builds.find(
            (b) => b.type === GLASS_TYPE.SINGLE && b.totalGlassMm === 3.2
        );
        const dualThick = builds.find((b) => b.type === GLASS_TYPE.DUAL && b.totalGlassMm === 4.0);

        expect(dualThin?.medianKgM2).toBeLessThanOrEqual(singleThick.medianKgM2);
        // And the thicker glass-glass build genuinely does add weight.
        expect(dualThick.medianKgM2).toBeGreaterThan(dualThin.medianKgM2);
    });

    it('never reports a module lighter than the glass it contains', () => {
        // Glass masses about 2.5 kg/m² per mm, so this is a hard physical floor and catches a
        // transposed weight or dimension. No upper bound is asserted: published datasheets are
        // not always self-consistent about glass thickness, and the catalogue copies them
        // faithfully rather than second-guessing the manufacturer.
        for (const panel of initialPanels) {
            const totalGlassMm = getTotalGlassThicknessMm(panel);
            const kgM2 = getPanelMassPerAreaKgM2(panel);
            if (totalGlassMm == null || kgM2 == null) continue;

            expect(kgM2).toBeGreaterThan(totalGlassMm * 2.5 * 0.9);
        }
    });
});
