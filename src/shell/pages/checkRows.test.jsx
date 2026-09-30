import { describe, it, expect } from "vitest";
import { checkRows } from "./ArrayPage";

const base = {
    panel: { maxSystemVoltage: 1500 },
    controller: { maxV: 500, mpptRangeMin: 90, mpptRangeMax: 435, maxIsc: 20 },
    conditions: { coldTempC: -10, hotTempC: 65 },
    coldVoc: 59,
    coldVmp: 49,
    hotVmp: 40,
    effectiveStartupV: 90,
    arrayIscHot: 14.8,
    arrayImpHot: 14,
    currentClipLimit: 16,
};
const row = (rows, label) => rows.find((r) => r.label.startsWith(label));

describe("checkRows (roadmap 13.6)", () => {
    it("shows nothing until both a panel and a controller are set", () => {
        expect(checkRows({ ...base, controller: null })).toEqual([]);
    });

    it("gives a row the covering check's status when the engine reports a finding once", () => {
        // Startup fails, so the engine doesn't also raise mpptMin; the MPPT-min row must not read OK.
        const rows = checkRows({
            ...base,
            flags: { isVmpOk: false },
            issues: [{ code: "vmpStartup", severity: "warning", message: "" }],
        });
        expect(row(rows, "Hot Vmp vs startup").status).toBe("warning");
        expect(row(rows, "Hot Vmp vs MPPT min").status).toBe("warning");
        expect(row(rows, "Cold Voc (").status).toBe("valid");

        const over = checkRows({
            ...base,
            flags: { isVmpOk: true, isIscOverRating: true },
            issues: [{ code: "iscRating", severity: "error", message: "" }],
        });
        expect(row(over, "Hot Isc").status).toBe("error");
        expect(row(over, "Hot Imp vs operating").status).toBe("error");
    });

    it("leaves out MPPT-min for battery-referenced chargers, which the engine skips", () => {
        const rows = checkRows({ ...base, controller: { ...base.controller, v_start_vbat_dependent: true }, issues: [], flags: {} });
        expect(row(rows, "Hot Vmp vs MPPT min")).toBeUndefined();
    });
});
