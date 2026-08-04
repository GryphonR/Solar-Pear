/**
 * @file Guide.test.jsx
 * Guards the properties that make the guide's worked example instructive.
 *
 * The example exists to teach that temperature correction, not the datasheet figure, decides
 * whether a string is safe. That lesson breaks if the chosen panel or panel count is ever
 * changed to one where a row fails for some other, more obvious reason - so the intent is
 * pinned down here rather than left to whoever edits the numbers next.
 */

import { describe, it, expect } from 'vitest';
import { EXAMPLE_WIRINGS, EXAMPLE_CONTROLLER } from './Guide';

describe('Guide worked example', () => {
    it('offers exactly one wiring that clears every limit', () => {
        expect(EXAMPLE_WIRINGS.filter((w) => w.passes)).toHaveLength(1);
    });

    it('fails once on voltage and once on current, so both limits are demonstrated', () => {
        const failures = EXAMPLE_WIRINGS.filter((w) => !w.passes);

        expect(failures).toHaveLength(2);
        expect(failures.filter((w) => !w.vocOk)).toHaveLength(1);
        expect(failures.filter((w) => !w.iscOk)).toHaveLength(1);
    });

    it('keeps hot Vmp below the controller max PV input in every row', () => {
        // Vmp is only ever compared against the startup threshold. Were a row's hot Vmp to also
        // exceed the max PV input, a reader could reasonably think that was the failing check.
        for (const w of EXAMPLE_WIRINGS) {
            expect(w.hotVmp).toBeLessThan(EXAMPLE_CONTROLLER.maxV);
        }
    });

    it('keeps hot Vmp above the startup threshold in every row', () => {
        // The example is about the voltage ceiling and the current ceiling; a startup failure
        // mixed in would give the reader a third variable to track.
        for (const w of EXAMPLE_WIRINGS) {
            expect(w.vmpOk).toBe(true);
        }
    });

    it('breaks the voltage limit only after temperature correction', () => {
        const voltageFailure = EXAMPLE_WIRINGS.find((w) => !w.vocOk);

        // The whole point: safe by the datasheet, unsafe once corrected to the cold extreme.
        expect(voltageFailure.stcVoc).toBeLessThan(EXAMPLE_CONTROLLER.maxV);
        expect(voltageFailure.coldVoc).toBeGreaterThan(EXAMPLE_CONTROLLER.maxV);
    });

    it('breaks each limit by a narrow enough margin to be non-obvious', () => {
        const voltageFailure = EXAMPLE_WIRINGS.find((w) => !w.vocOk);
        const currentFailure = EXAMPLE_WIRINGS.find((w) => !w.iscOk);

        // A wiring that overshoots by miles makes the correction look incidental.
        expect(voltageFailure.coldVoc).toBeLessThan(EXAMPLE_CONTROLLER.maxV * 1.1);
        expect(currentFailure.hotIsc).toBeLessThan(EXAMPLE_CONTROLLER.maxIsc * 1.5);
    });
});
