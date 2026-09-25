import { describe, it, expect } from "vitest";
import {
    evaluateElectrical,
    evaluateControllerPower,
    evaluatePhysicalFit,
    analyzeArray,
    getCurrentClipLimit,
    controllerUnitsForArray,
    panelPassesControllerLimits,
    resolveDesignConditions,
    coldVocFactor,
} from "./arrayAnalysis";

// A typical 400 W half-cell module (values in line with mainstream 108-cell datasheets).
const PANEL_400 = {
    model: "P400",
    name: "Test 400W",
    power: 400,
    voc: 37.5,
    vmp: 31.5,
    isc: 13.7,
    imp: 12.7,
    tempCoefVoc: -0.25,
    tempCoefPmax: -0.29,
    tempCoefIsc: 0.045,
    maxSystemVoltage: 1500,
    maxSeriesFuse: 25,
    price: 100,
    gseCompatibility: "Both",
};

// Victron SmartSolar 100/30-style charger after the roadmap 1.3 data split.
const CHARGER_100_30 = {
    id: "ss100_30",
    name: "SmartSolar MPPT 100/30",
    type: "charger",
    maxV: 100,
    maxIsc: 35,
    maxOperatingI: 0,
    maxChargeCurrent: 30,
    mpptRangeMin: 15,
    mpptRangeMax: 95,
    startupV: 5,
    v_start_vbat_dependent: true,
    systemVoltages: [12, 24],
    MaxDCPower: 880,
    price: 150,
};

const HYBRID = {
    id: "hyb",
    name: "Hybrid 3.6kW",
    type: "hybrid_inverter",
    maxV: 580,
    maxIsc: 20,
    maxOperatingI: 15,
    maxChargeCurrent: 0,
    mpptRangeMin: 120,
    mpptRangeMax: 550,
    startupV: 80,
    systemVoltages: [48],
    MaxDCPower: 5200,
    price: 900,
};

const MICRO = {
    id: "micro",
    name: "IQ8M-style micro",
    type: "microinverter",
    maxV: 60,
    maxIsc: 20,
    maxOperatingI: 12,
    maxChargeCurrent: 0,
    mpptRangeMin: 33,
    mpptRangeMax: 45,
    startupV: 22,
    trackers: 1,
    MaxDCPower: 480,
    MaxACPower: 330,
    price: 140,
};

const codes = (r) => r.issues.map((i) => i.code);

describe("evaluateElectrical: reference designs", () => {
    it("2 × 400 W in series on a 100/30 at -10 °C: cold Voc 81.6 V, passes", () => {
        const r = evaluateElectrical(PANEL_400, CHARGER_100_30, { count: 2, parallelStrings: 1, systemVoltage: 12 });
        expect(r.seriesLength).toBe(2);
        expect(r.coldVoc).toBeCloseTo(2 * 37.5 * 1.0875, 3);
        expect(r.hardOk).toBe(true);
        expect(r.flags.isVocWarn).toBe(false);
        expect(r.issues).toEqual([]);
    });

    it("3 × 400 W in series on a 100/30 exceeds 100 V and is an error", () => {
        const r = evaluateElectrical(PANEL_400, CHARGER_100_30, { count: 3, parallelStrings: 1, systemVoltage: 12 });
        expect(r.flags.isVocOk).toBe(false);
        expect(r.hardOk).toBe(false);
        expect(codes(r)).toContain("voc");
    });

    it("a colder design temperature raises cold Voc", () => {
        const mild = evaluateElectrical(PANEL_400, null, { count: 2 });
        const cold = evaluateElectrical(PANEL_400, null, { count: 2, conditions: { coldTempC: -20 } });
        expect(cold.coldVoc).toBeGreaterThan(mild.coldVoc);
        expect(cold.coldVoc).toBeCloseTo(2 * 37.5 * (1 + (-45 * -0.25) / 100), 3);
    });

    it("messages state the design temperature in use", () => {
        const r = evaluateElectrical(PANEL_400, CHARGER_100_30, {
            count: 3,
            conditions: { coldTempC: -15 },
        });
        expect(r.issues.find((i) => i.code === "voc").message).toContain("-15°C");
    });

    it("flags hot Vmp below the MPPT range on an inverter (not below startup)", () => {
        // 3 panels: hot Vmp ≈ 3 × 31.5 × 0.884 = 83.5 V → above 80 V startup, below 120 V MPPT min.
        const r = evaluateElectrical(PANEL_400, HYBRID, { count: 3, parallelStrings: 1 });
        expect(r.flags.isVmpOk).toBe(true);
        expect(r.flags.isBelowMpptMin).toBe(true);
        expect(codes(r)).toContain("mpptMin");
    });

    it("does not apply mpptRangeMin to battery-referenced chargers (startup covers it)", () => {
        const r = evaluateElectrical(PANEL_400, { ...CHARGER_100_30, mpptRangeMin: 90 }, { count: 2, systemVoltage: 12 });
        expect(r.flags.isBelowMpptMin).toBe(false);
    });

    it("flags cold Vmp above the MPPT maximum when Voc still passes", () => {
        const ctrl = { ...HYBRID, maxV: 150, mpptRangeMax: 100, mpptRangeMin: 0, startupV: 0 };
        // 3 panels: cold Vmp ≈ 3 × 31.5 × 1.1015 = 104 V > 100; cold Voc ≈ 122 V < 150.
        const r = evaluateElectrical(PANEL_400, ctrl, { count: 3 });
        expect(r.flags.isVocOk).toBe(true);
        expect(r.flags.isAboveMpptMax).toBe(true);
        expect(r.issues.find((i) => i.code === "mpptMax").severity).toBe("warning");
    });

    it("errors when cold Voc exceeds the panel's max system voltage", () => {
        const ctrl = { ...HYBRID, maxV: 1100, mpptRangeMax: 1000 };
        const panel = { ...PANEL_400, maxSystemVoltage: 1000 };
        // 25 in series: cold Voc ≈ 1019.5 V → below 1100 V controller, above 1000 V panel rating.
        const r = evaluateElectrical(panel, ctrl, { count: 25 });
        expect(r.flags.isVocOk).toBe(true);
        expect(r.flags.isPanelSystemVoltageOk).toBe(false);
        expect(r.hardOk).toBe(false);
    });

    it("notes string fuses for 3+ parallel strings, sized between 1.5 × Isc and the series fuse rating", () => {
        const r = evaluateElectrical(PANEL_400, null, { count: 6, parallelStrings: 3 });
        const fuse = r.issues.find((i) => i.code === "stringFuses");
        expect(fuse.severity).toBe("info");
        expect(fuse.message).toContain("21A");
        expect(fuse.message).toContain("25A");
    });

    it("warns when no fuse size fits between 1.5 × Isc and the series fuse rating", () => {
        const r = evaluateElectrical({ ...PANEL_400, maxSeriesFuse: 20 }, null, { count: 6, parallelStrings: 3 });
        expect(r.issues.find((i) => i.code === "stringFuses").severity).toBe("warning");
    });

    it("does not ask for fuses with two parallel strings", () => {
        const r = evaluateElectrical(PANEL_400, null, { count: 4, parallelStrings: 2 });
        expect(r.flags.needsStringFuses).toBe(false);
    });

    it("flags Isc above the controller's short-circuit rating separately from clipping", () => {
        // 2P: Isc hot ≈ 27.9 A > 20 A rating.
        const r = evaluateElectrical(PANEL_400, HYBRID, { count: 20, parallelStrings: 2 });
        expect(r.flags.isIscOverRating).toBe(true);
        const issue = r.issues.find((i) => i.code === "iscRating");
        expect(issue.severity).toBe("error"); // roadmap decision D1
        expect(r.hardOk).toBe(false);
        expect(issue.message).toContain("short-circuit");
        expect(codes(r)).not.toContain("currentClip");
    });

    it("downgrades the Isc rating check to a warning for self-limiting inputs", () => {
        const r = evaluateElectrical(PANEL_400, { ...HYBRID, iscSelfLimiting: true }, { count: 20, parallelStrings: 2 });
        expect(r.issues.find((i) => i.code === "iscRating").severity).toBe("warning");
        expect(r.hardOk).toBe(true);
    });

    it("picks the parallel wiring that keeps Isc within the rating", () => {
        // 2 panels on a 20 A input: 1S2P puts ~27.9 A in; 2S1P is the only passing wiring.
        const ctrl = { ...HYBRID, maxV: 600 };
        expect(panelPassesControllerLimits({ count: 2, parallelStrings: 2 }, PANEL_400, ctrl)).toBe(false);
        expect(panelPassesControllerLimits({ count: 2, parallelStrings: 1 }, PANEL_400, ctrl)).toBe(true);
    });

    it("strict-current mode applies the 1.25 irradiance factor to the Isc rating check", () => {
        const ctrl = { ...HYBRID, maxIsc: 15, maxOperatingI: 15 };
        const normal = evaluateElectrical(PANEL_400, ctrl, { count: 10 });
        const strict = evaluateElectrical(PANEL_400, ctrl, { count: 10, conditions: { strictCurrent: true } });
        expect(normal.flags.isIscOverRating).toBe(false);
        expect(strict.flags.isIscOverRating).toBe(true);
    });

    it("uses operating current (Imp) for clipping, not short-circuit current", () => {
        // Imp hot ≈ 12.93 A; Isc hot ≈ 13.95 A. A 13 A operating limit clips neither.
        const ctrl = { ...HYBRID, maxIsc: 20, maxOperatingI: 13 };
        const r = evaluateElectrical(PANEL_400, ctrl, { count: 10 });
        expect(r.flags.isCurrentClipping).toBe(false);
        const r2 = evaluateElectrical(PANEL_400, { ...ctrl, maxOperatingI: 12 }, { count: 10 });
        expect(r2.flags.isCurrentClipping).toBe(true);
    });
});

describe("getCurrentClipLimit", () => {
    it("prefers PV operating current, then Isc, else unknown", () => {
        expect(getCurrentClipLimit({ maxOperatingI: 15, maxIsc: 20 })).toBe(15);
        expect(getCurrentClipLimit({ maxOperatingI: 0, maxIsc: 35 })).toBe(35);
        expect(getCurrentClipLimit({ maxOperatingI: 0, maxIsc: 0 })).toBe(Infinity);
    });

    it("never uses the battery charge current", () => {
        expect(getCurrentClipLimit(CHARGER_100_30)).toBe(35);
    });
});

describe("evaluateControllerPower", () => {
    it("1 kW on a 100/30 at 12 V is a warning: about 432 W deliverable", () => {
        const r = evaluateControllerPower(CHARGER_100_30, 1000, { systemVoltage: 12 });
        expect(r.basis).toBe("charge");
        expect(r.limitW).toBe(432);
        expect(r.issue.severity).toBe("warning");
        expect(r.issue.message).toContain("57%");
    });

    it("mild overpanelling (≤130%) is info only", () => {
        const r = evaluateControllerPower(CHARGER_100_30, 500, { systemVoltage: 12 });
        expect(r.issue.severity).toBe("info");
    });

    it("the same array at 24 V is within the limit", () => {
        const r = evaluateControllerPower(CHARGER_100_30, 800, { systemVoltage: 24 });
        expect(r.issue).toBeNull();
    });

    it("assumes the lowest supported battery voltage when none is selected, and says so", () => {
        const r = evaluateControllerPower(CHARGER_100_30, 1000, {});
        expect(r.batteryV).toBe(12);
        expect(r.issue.message).toContain("assuming a 12V battery");
    });

    it("inverters are checked against max PV (DC) input power", () => {
        expect(evaluateControllerPower(HYBRID, 5000).issue).toBeNull();
        const r = evaluateControllerPower(HYBRID, 6000, { arrayCount: 2 });
        expect(r.basis).toBe("dc");
        expect(r.issue.severity).toBe("warning");
        expect(r.issue.message).toContain("2 arrays");
    });

    it("skips microinverters (checked per panel)", () => {
        expect(evaluateControllerPower(MICRO, 4000).issue).toBeNull();
    });
});

describe("microinverters", () => {
    it("checks each panel on its own input, ignoring series wiring", () => {
        const r = evaluateElectrical(PANEL_400, MICRO, { count: 10, parallelStrings: 1 });
        expect(r.isMicro).toBe(true);
        expect(r.seriesLength).toBe(1);
        expect(r.coldVoc).toBeCloseTo(37.5 * 1.0875, 3);
        expect(r.hardOk).toBe(true);
    });

    it("reports AC clipping as info when panel power exceeds micro AC output", () => {
        const r = evaluateElectrical({ ...PANEL_400, imp: 11 }, MICRO, { count: 10 });
        const clip = r.issues.find((i) => i.code === "microAcClip");
        expect(clip.severity).toBe("info");
    });

    it("warns when the panel exceeds the micro's max module power", () => {
        const r = evaluateElectrical({ ...PANEL_400, power: 500, imp: 11 }, MICRO, { count: 1 });
        expect(codes(r)).toContain("microModulePower");
    });

    it("needs one unit per panel (or per panelsPerUnit)", () => {
        expect(controllerUnitsForArray(MICRO, 10)).toBe(10);
        expect(controllerUnitsForArray({ ...MICRO, panelsPerUnit: 2 }, 5)).toBe(3);
        expect(controllerUnitsForArray(HYBRID, 10)).toBe(1);
    });

    it("flags a low-Vmp panel that falls below the micro's MPPT window when hot", () => {
        // 31.5 V Vmp × 0.884 at 65 °C = 27.8 V, below the 33 V MPPT minimum.
        const r = evaluateElectrical({ ...PANEL_400, imp: 11 }, MICRO, { count: 1 });
        expect(codes(r)).toContain("mpptMin");
    });

    it("analyzeArray costs one micro per panel and passes a 10-panel array", () => {
        // Higher-voltage module that sits inside the 33–45 V window hot (35.4 V) and cold (44.1 V).
        const panel = { ...PANEL_400, power: 430, voc: 48, vmp: 40, isc: 11.1, imp: 10.75 };
        const result = analyzeArray("A1", {
            arraysData: [{ id: "A1", name: "Roof", area: "House", count: 10, parallelStrings: 1, mounting: "On Roof" }],
            panelsData: [panel],
            chargersData: [MICRO],
            siteControllers: [{ id: "I1", modelId: "micro", area: "House", name: "Micros" }],
            selections: { A1: { panel: "P400", controllerInstanceId: "I1", controllerMppt: 1 } },
        });
        expect(result.issues.map((i) => i.code)).toEqual(["microAcClip"]);
        expect(result.status).toBe("valid");
        expect(result.controllerUnits).toBe(10);
        expect(result.cost).toBe(10 * 100 + 10 * 140);
    });
});

describe("analyzeArray controller power across shared instances", () => {
    it("sums every array on the same controller instance", () => {
        const arraysData = [
            { id: "A1", name: "East", area: "House", count: 2, parallelStrings: 1, mounting: "On Roof" },
            { id: "A2", name: "West", area: "House", count: 2, parallelStrings: 1, mounting: "On Roof" },
        ];
        const ctrl = { ...CHARGER_100_30, maxChargeCurrent: 50, trackers: 2 };
        const result = analyzeArray("A1", {
            arraysData,
            panelsData: [PANEL_400],
            chargersData: [ctrl],
            siteControllers: [{ id: "I1", modelId: "ss100_30", area: "House", name: "C" }],
            selections: {
                A1: { panel: "P400", controllerInstanceId: "I1", controllerMppt: 1 },
                A2: { panel: "P400", controllerInstanceId: "I1", controllerMppt: 2 },
            },
            systemVoltage: 12,
        });
        // 1600 W on 50 A × 12 V × 1.2 = 720 W.
        expect(result.power.totalWp).toBe(1600);
        expect(result.power.limitW).toBe(720);
        expect(result.status).toBe("warning");
        expect(result.messages.some((m) => m.includes("The 2 arrays on this controller total 1600W"))).toBe(true);
    });
});

describe("single source of truth", () => {
    it("panelPassesControllerLimits agrees with evaluateElectrical.hardOk across wirings", () => {
        for (const count of [1, 2, 3, 4, 6, 12]) {
            for (const p of [1, 2, 3]) {
                if (count % p) continue;
                for (const ctrl of [CHARGER_100_30, HYBRID, MICRO]) {
                    const array = { count, parallelStrings: p };
                    expect(panelPassesControllerLimits(array, PANEL_400, ctrl, 12)).toBe(
                        evaluateElectrical(PANEL_400, ctrl, { count, parallelStrings: p, systemVoltage: 12 }).hardOk
                    );
                }
            }
        }
    });

    it("resolveDesignConditions fills defaults and keeps valid overrides", () => {
        expect(resolveDesignConditions(null)).toEqual({ coldTempC: -10, hotTempC: 65, strictCurrent: false });
        expect(resolveDesignConditions({ coldTempC: -20, hotTempC: "x" })).toEqual({
            coldTempC: -20,
            hotTempC: 65,
            strictCurrent: false,
        });
    });

    it("the fallback Voc coefficient is conservative (-0.30 %/°C)", () => {
        expect(coldVocFactor({})).toBeCloseTo(1.105, 6);
    });

    it("evaluatePhysicalFit reports each physical problem", () => {
        const fit = evaluatePhysicalFit(
            { mounting: "In-Roof (GSE)", format: "Portrait", maxPanelHeight: 1500, maxPanelWeight: 20 },
            { ...PANEL_400, height: 1722, width: 1134, weight: 21, gseCompatibility: "Landscape Only" }
        );
        expect(fit.issues.map((i) => i.code)).toEqual(["format", "size", "weight"]);
    });
});
