/**
 * @file controllerTypes.test.js
 * Covers the grouping and summarising the Guide to Controllers relies on, and checks the claims
 * that page makes about the bundled controller database.
 */

import { describe, it, expect } from 'vitest';
import { initialChargers } from '../data/loadData.js';
import {
    CONTROLLER_TYPE,
    CONTROLLER_TYPE_ORDER,
    CONTROLLER_TYPE_LABELS,
    hasPvInput,
    isBatteryVoltageClass,
    groupControllersByType,
    summariseControllerGroup,
    summariseGridCapabilities,
    findCurrentHeadroomExamples,
} from './controllerTypes';

describe('hasPvInput', () => {
    it('is false for devices with no solar tracker', () => {
        // AC-coupled inverters and plain inverter/chargers record a zero max PV voltage.
        expect(hasPvInput({ maxV: 0 })).toBe(false);
        expect(hasPvInput({})).toBe(false);
        expect(hasPvInput({ maxV: 250 })).toBe(true);
    });
});

describe('isBatteryVoltageClass', () => {
    it('separates low-voltage battery devices from grid-voltage ones', () => {
        expect(isBatteryVoltageClass({ systemVoltages: [12, 24, 48] })).toBe(true);
        expect(isBatteryVoltageClass({ systemVoltages: [400] })).toBe(false);
        expect(isBatteryVoltageClass({})).toBe(false);
    });
});

describe('summariseControllerGroup', () => {
    it('reports ranges and keeps only low-voltage battery options', () => {
        const summary = summariseControllerGroup([
            { id: 'a', name: 'A', maxV: 150, trackers: 1, systemVoltages: [12, 24], price: 200 },
            { id: 'b', name: 'B', maxV: 450, trackers: 4, systemVoltages: [48, 400], price: 100 },
        ]);

        expect(summary.count).toBe(2);
        expect(summary.maxV).toEqual({ min: 150, max: 450 });
        expect(summary.trackers).toEqual({ min: 1, max: 4 });
        // 400 V is a grid-side figure, not a battery bank, so it is excluded.
        expect(summary.batteryVoltages).toEqual([12, 24, 48]);
        expect(summary.pvInputCount).toBe(2);
        // Cheapest first, since the guide explains categories rather than recommending flagships.
        expect(summary.examples[0].id).toBe('b');
    });

    it('handles an empty group without throwing', () => {
        const summary = summariseControllerGroup([]);
        expect(summary.count).toBe(0);
        expect(summary.maxV).toBeNull();
        expect(summary.batteryVoltages).toEqual([]);
    });
});

describe('findCurrentHeadroomExamples', () => {
    it('returns only controllers whose fault and working current differ, widest gap first', () => {
        const examples = findCurrentHeadroomExamples([
            { id: 'same', maxIsc: 20, maxOperatingI: 20 },
            { id: 'small-gap', maxIsc: 20, maxOperatingI: 18 },
            { id: 'big-gap', maxIsc: 25, maxOperatingI: 14 },
            { id: 'missing', maxIsc: 25 },
        ]);

        expect(examples.map((c) => c.id)).toEqual(['big-gap', 'small-gap']);
    });
});

describe('against the bundled controller database', () => {
    it('labels every device type present in the data', () => {
        const groups = groupControllersByType(initialChargers);
        for (const type of Object.keys(groups)) {
            expect(CONTROLLER_TYPE_LABELS[type]).toBeTruthy();
            expect(CONTROLLER_TYPE_ORDER).toContain(type);
        }
    });

    it('holds controllers for each family the guide gives a card to', () => {
        const groups = groupControllersByType(initialChargers);
        for (const type of [
            CONTROLLER_TYPE.CHARGER,
            CONTROLLER_TYPE.HYBRID_INVERTER,
            CONTROLLER_TYPE.STRING_INVERTER,
            CONTROLLER_TYPE.MICROINVERTER,
        ]) {
            expect(groups[type]?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('finds string inverters reaching higher PV voltages than battery chargers', () => {
        // The guide contrasts these families on exactly this point.
        const groups = groupControllersByType(initialChargers);
        const stringMax = summariseControllerGroup(groups[CONTROLLER_TYPE.STRING_INVERTER]).maxV.max;
        const chargerMax = summariseControllerGroup(groups[CONTROLLER_TYPE.CHARGER]).maxV.max;

        expect(stringMax).toBeGreaterThan(chargerMax);
    });

    it('finds microinverters at far lower PV voltages, as they take one panel each', () => {
        const groups = groupControllersByType(initialChargers);
        const microMax = summariseControllerGroup(groups[CONTROLLER_TYPE.MICROINVERTER]).maxV.max;

        expect(microMax).toBeLessThan(100);
    });

    it('counts grid capabilities consistently', () => {
        const grid = summariseGridCapabilities(initialChargers);

        expect(grid.total).toBe(initialChargers.length);
        // Whole-house backup is a stronger claim than an EPS output, so it must be rarer.
        expect(grid.houseBackup).toBeLessThanOrEqual(grid.eps);
        for (const count of [grid.g98, grid.g99, grid.g100, grid.offGridNative]) {
            expect(count).toBeGreaterThan(0);
            expect(count).toBeLessThanOrEqual(grid.total);
        }
    });

    it('has at least one controller where fault and working current differ', () => {
        // The guide cites these live, so the section would be empty without them.
        expect(findCurrentHeadroomExamples(initialChargers).length).toBeGreaterThan(0);
    });
});
