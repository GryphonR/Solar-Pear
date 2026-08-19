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
    it('two wirings pass (voltage is the only hard limit; current overage just clips)', () => {
        expect(EXAMPLE_WIRINGS.filter((w) => w.passes)).toHaveLength(2);
    });

    it('fails once on voltage; one row clips on current (passes but with warning)', () => {
        const failures = EXAMPLE_WIRINGS.filter((w) => !w.passes);
        const clippers = EXAMPLE_WIRINGS.filter((w) => w.passes && w.clips);

        expect(failures).toHaveLength(1);
        expect(failures.filter((w) => !w.vocOk)).toHaveLength(1);
        expect(clippers).toHaveLength(1);
        expect(clippers[0].iscOk).toBe(false);
    });

    it('keeps hot Vmp below the controller max PV input in every row', () => {
        // Vmp is only ever compared against the startup threshold. Were a row's hot Vmp to also
        // exceed the max PV input, a reader could reasonably think that was the failing check.
        for (const w of EXAMPLE_WIRINGS) {
            expect(w.hotVmp).toBeLessThan(EXAMPLE_CONTROLLER.maxV);
        }
    });

    it('keeps hot Vmp above the startup threshold in every row (example simplicity)', () => {
        // The example is about the voltage ceiling and current clipping; a startup warning
        // mixed in would give the reader a third variable to track. This is a property of the
        // chosen example, not a hard requirement — lowStartup is just a warning anyway.
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

    it('exceeds each threshold by a narrow enough margin to be non-obvious', () => {
        const voltageFailure = EXAMPLE_WIRINGS.find((w) => !w.vocOk);
        const currentClipper = EXAMPLE_WIRINGS.find((w) => w.clips);

        // A wiring that overshoots by miles makes the correction look incidental.
        expect(voltageFailure.coldVoc).toBeLessThan(EXAMPLE_CONTROLLER.maxV * 1.1);
        expect(currentClipper.hotIsc).toBeLessThan(EXAMPLE_CONTROLLER.maxIsc * 1.5);
    });
});
