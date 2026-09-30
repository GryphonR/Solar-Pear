import { describe, it, expect } from "vitest";
import { arrayProgress, arrayStatus, summariseStatuses, systemMeta, totals } from "./designStatus";

const complete = (status) => ({ array: { count: 4 }, panel: {}, controller: {}, status });

describe("designStatus (roadmap 13.4)", () => {
    it("treats an incomplete array as not set, never as a warning or OK", () => {
        expect(arrayStatus({ array: { count: 4 }, panel: {}, controller: null, status: "warning" })).toBe("unset");
        expect(arrayStatus(null)).toBe("unset");
        expect(arrayStatus(complete("warning"))).toBe("warning");
        expect(arrayStatus(complete("error"))).toBe("error");
        expect(arrayStatus(complete("valid"))).toBe("valid");
        expect(arrayStatus(complete("info"))).toBe("valid");
    });

    it("counts filled slots", () => {
        expect(arrayProgress({ array: { count: 4 }, panel: {}, controller: null })).toEqual({
            layout: true,
            panel: true,
            controller: false,
            done: 2,
        });
    });

    it("rolls statuses up worst first, and never shows unfinished work as OK", () => {
        expect(summariseStatuses(["valid", "warning", "unset"]).label).toBe("1 warning");
        expect(summariseStatuses(["error", "error", "warning"])).toMatchObject({ status: "error", label: "2 errors" });
        expect(summariseStatuses(["valid", "unset"])).toMatchObject({ status: "unset", label: "1 to finish" });
        expect(summariseStatuses(["valid", "valid"])).toMatchObject({ status: "valid", label: "OK" });
        expect(summariseStatuses([])).toMatchObject({ status: "unset", label: "No arrays" });
    });

    it("describes a system", () => {
        expect(systemMeta({ systemType: "grid-connected", systemVoltage: 48 }, 3)).toBe("Grid-connected · 48 V · 3 arrays");
        expect(systemMeta({ systemType: "any", systemVoltage: null }, 1)).toBe("1 array");
        expect(systemMeta({ installType: "static", gridMode: "hybrid", systemType: "grid-connected", systemVoltage: 48 }, 2)).toBe(
            "Static · Hybrid · 48 V · 2 arrays"
        );
    });

    it("totals power and known cost", () => {
        expect(totals([{ peakPower: 400, cost: 100 }, { peakPower: 200, cost: 0, costIncomplete: true }])).toEqual({
            peakPower: 600,
            cost: 100,
            costIncomplete: true,
        });
    });
});
