import { describe, it, expect } from "vitest";
import {
    isCompatibleFormat,
    analyzeArray,
    panelPassesControllerLimits,
    panelPassesControllerLimitsForLayout,
    getEffectiveMaxPanelWeightKg,
    panelMeetsWeightCap,
    divisorsOf,
    formatWiringLabel,
    bestParallelStringsForController,
    layoutCompatibleWiring,
} from "./arrayAnalysis";

describe("isCompatibleFormat", () => {
    const baseArray = { mounting: "In-Roof (GSE)", format: "Portrait" };

    it("allows any panel on on-roof mounting", () => {
        const array = { ...baseArray, mounting: "On Roof" };
        expect(
            isCompatibleFormat(array, { gseCompatibility: "Portrait Only" })
        ).toBe(true);
        expect(
            isCompatibleFormat(array, { gseCompatibility: "Landscape Only" })
        ).toBe(true);
        expect(isCompatibleFormat(array, { gseCompatibility: "None" })).toBe(
            true
        );
        expect(isCompatibleFormat(array, { gseCompatibility: "Both" })).toBe(
            true
        );
    });

    it("blocks none-compatible panels on in-roof GSE arrays", () => {
        const array = { ...baseArray, mounting: "In-Roof (GSE)" };
        expect(isCompatibleFormat(array, { gseCompatibility: "None" })).toBe(
            false
        );
    });

    it("blocks portrait-only panels on landscape GSE arrays", () => {
        const array = { ...baseArray, format: "Landscape" };
        expect(
            isCompatibleFormat(array, { gseCompatibility: "Portrait Only" })
        ).toBe(false);
        expect(
            isCompatibleFormat(array, { gseCompatibility: "Landscape Only" })
        ).toBe(true);
    });

    it("blocks landscape-only panels on portrait GSE arrays", () => {
        const array = { ...baseArray, format: "Portrait" };
        expect(
            isCompatibleFormat(array, { gseCompatibility: "Landscape Only" })
        ).toBe(false);
        expect(
            isCompatibleFormat(array, { gseCompatibility: "Portrait Only" })
        ).toBe(true);
    });

    it("defaults missing props to safe values", () => {
        // defaults: mounting -> In-Roof (GSE), format -> Portrait, gseCompatibility -> Both
        expect(isCompatibleFormat({}, {})).toBe(true);
    });
});

describe("panelPassesControllerLimits", () => {
    const array = { count: 2, parallelStrings: 1 };
    const panel = {
        voc: 40,
        vmp: 32,
        isc: 10,
        tempCoefVoc: -0.3,
        tempCoefPmax: -0.4,
        tempCoefIsc: 0.05,
    };
    const controller = { maxV: 200, maxIsc: 30, startupV: 5, v_start_vbat_dependent: false };

    it("returns true when controller is null", () => {
        expect(panelPassesControllerLimits(array, panel, null, 48)).toBe(true);
    });

    it("returns true when panel is within limits for a small string", () => {
        expect(panelPassesControllerLimits(array, panel, controller, 48)).toBe(true);
    });
});

describe("divisorsOf / formatWiringLabel", () => {
    it("lists positive divisors in order", () => {
        expect(divisorsOf(12)).toEqual([1, 2, 3, 4, 6, 12]);
        expect(divisorsOf(1)).toEqual([1]);
    });

    it("formats S×P like ParallelStringsSelect", () => {
        expect(formatWiringLabel(12, 2)).toBe("6S2P");
        expect(formatWiringLabel(12, 1)).toBe("12S1P");
    });
});

describe("bestParallelStringsForController / layoutCompatibleWiring", () => {
    const arrayBase = { count: 99, parallelStrings: 1 };
    const panel = {
        voc: 40,
        vmp: 32,
        isc: 6,
        tempCoefVoc: -0.3,
        tempCoefPmax: -0.4,
        tempCoefIsc: 0.05,
    };

    it("returns smallest parallelStrings that passes when one long string exceeds maxV", () => {
        const controller = { maxV: 200, maxIsc: 40, startupV: 5, v_start_vbat_dependent: false };
        // 8S1P: 8*40 cold Voc > 200; 4S2P: ~173V cold — passes
        expect(bestParallelStringsForController(arrayBase, panel, 8, controller, 48)).toBe(2);
        expect(layoutCompatibleWiring(arrayBase, panel, 8, controller, 48)).toBe(true);
    });

    it("returns null when no divisor wiring fits the controller", () => {
        const tight = { maxV: 35, maxIsc: 40, startupV: 5, v_start_vbat_dependent: false };
        expect(bestParallelStringsForController(arrayBase, panel, 4, tight, 48)).toBe(null);
        expect(layoutCompatibleWiring(arrayBase, panel, 4, tight, 48)).toBe(false);
    });
});

describe("panelPassesControllerLimitsForLayout", () => {
    const bigArray = { count: 10, parallelStrings: 1 };
    const panel = {
        voc: 50,
        vmp: 40,
        isc: 10,
        tempCoefVoc: -0.3,
        tempCoefPmax: -0.4,
        tempCoefIsc: 0.05,
    };
    const controller = { maxV: 200, maxIsc: 30, startupV: 5, v_start_vbat_dependent: false };

    it("uses layout count so a panel can pass for a small layout while failing for the saved array count", () => {
        expect(panelPassesControllerLimits(bigArray, panel, controller, 48)).toBe(false);
        expect(
            panelPassesControllerLimitsForLayout(bigArray, panel, 2, controller, 48)
        ).toBe(true);
    });

    it("returns true when a larger layout only fits with more parallel strings", () => {
        const p = {
            voc: 40,
            vmp: 32,
            isc: 6,
            tempCoefVoc: -0.3,
            tempCoefPmax: -0.4,
            tempCoefIsc: 0.05,
        };
        const ctrl = { maxV: 200, maxIsc: 40, startupV: 5, v_start_vbat_dependent: false };
        const arr = { count: 1, parallelStrings: 1 };
        expect(panelPassesControllerLimits({ ...arr, count: 8, parallelStrings: 1 }, p, ctrl, 48)).toBe(
            false
        );
        expect(panelPassesControllerLimitsForLayout(arr, p, 8, ctrl, 48)).toBe(true);
    });

    it("returns false for non-positive layout count", () => {
        expect(
            panelPassesControllerLimitsForLayout(bigArray, panel, 0, controller, 48)
        ).toBe(false);
    });
});

describe("getEffectiveMaxPanelWeightKg / panelMeetsWeightCap", () => {
    it("uses array.maxPanelWeight when set", () => {
        expect(
            getEffectiveMaxPanelWeightKg({ maxPanelWeight: "22" }, false)
        ).toBe(22);
        expect(panelMeetsWeightCap({ weight: 22 }, 22)).toBe(true);
        expect(panelMeetsWeightCap({ weight: 22.1 }, 22)).toBe(false);
    });

    it("uses 25kg cap when hideHeavyPanels and no maxPanelWeight", () => {
        expect(getEffectiveMaxPanelWeightKg({ maxPanelWeight: "" }, true)).toBe(25);
        expect(panelMeetsWeightCap({ weight: 25 }, 25)).toBe(true);
        expect(panelMeetsWeightCap({ weight: 25.1 }, 25)).toBe(false);
    });

    it("has no cap when hideHeavyPanels is false and maxPanelWeight empty", () => {
        expect(getEffectiveMaxPanelWeightKg({ maxPanelWeight: "" }, false)).toBe(null);
        expect(panelMeetsWeightCap({ weight: 100 }, null)).toBe(true);
    });
});

describe("analyzeArray", () => {
    const arraysData = [
        {
            id: "A1",
            name: "Test Array",
            area: "House",
            orientation: "South",
            count: 4,
            format: "Portrait",
            mounting: "In-Roof (GSE)",
        },
    ];

    const panelsData = [
        {
            model: "PANEL_OK",
            name: "Safe Panel",
            power: 400,
            voc: 40,
            vmp: 32,
            isc: 10,
            price: 100,
            gseCompatibility: "Both",
            height: 1700,
            width: 1100,
        },
        {
            model: "PANEL_TALL",
            name: "Too Tall Panel",
            power: 400,
            voc: 40,
            vmp: 32,
            isc: 10,
            price: 100,
            gseCompatibility: "Both",
            height: 2000,
            width: 1100,
        },
    ];

    const chargersData = [
        {
            id: "CHG_SAFE",
            name: "Safe Controller",
            maxV: 200,
            maxIsc: 20,
            startupV: 80,
        },
        {
            id: "CHG_LOW_VOC_LIMIT",
            name: "Low Voltage Limit Controller",
            maxV: 120,
            maxIsc: 20,
            startupV: 80,
        },
        {
            id: "CHG_HIGH_STARTUP",
            name: "High Startup Controller",
            maxV: 200,
            maxIsc: 20,
            startupV: 200,
        },
        {
            id: "CHG_LOW_ISC_LIMIT",
            name: "Low Current Limit Controller",
            maxV: 200,
            maxIsc: 15,
            startupV: 80,
        },
    ];

    const siteControllers = [
        {
            id: "INST_SAFE",
            modelId: "CHG_SAFE",
            area: "House",
            name: "Safe Controller Instance",
        },
    ];

    const baseSelections = {
        A1: {
            panel: "PANEL_OK",
            controllerInstanceId: "INST_SAFE",
            controllerMppt: 1,
        },
    };

    it("returns null for unknown arrayId", () => {
        const result = analyzeArray("UNKNOWN", {
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections: baseSelections,
        });
        expect(result).toBeNull();
    });

    it("returns warning when panel or controller missing", () => {
        const result = analyzeArray("A1", {
            arraysData,
            panelsData,
            chargersData,
            siteControllers: [],
            selections: { A1: { panel: "PANEL_OK" } },
        });
        expect(result.status).toBe("warning");
        expect(result.messages[0]).toMatch(/Please select both a Solar Panel/);
    });

    it("computes safe configuration metrics correctly", () => {
        const result = analyzeArray("A1", {
            arraysData,
            panelsData,
            chargersData,
            siteControllers,
            selections: baseSelections,
        });

        expect(result.status).toBe("valid");
        expect(result.peakPower).toBe(400 * 4);
        expect(result.cost).toBe(100 * 4);
        expect(result.costPerKWp).toBeCloseTo(result.cost / (result.peakPower / 1000));
        // 4 panels in series
        const expectedColdVoc = 40 * 4 * 1.084;
        const expectedHotVmp = 32 * 4 * 0.9;
        expect(result.coldVoc).toBeCloseTo(expectedColdVoc);
        expect(result.hotVmp).toBeCloseTo(expectedHotVmp);
    });

    it("flags Voc over-voltage as fatal", () => {
        const selections = {
            A1: {
                panel: "PANEL_OK",
                controllerInstanceId: "INST_OV",
                controllerMppt: 1,
            },
        };
        const overVoltControllers = [
            ...chargersData,
            {
                id: "CHG_OV",
                name: "Very Low Voc Limit Controller",
                maxV: 100,
                maxIsc: 20,
                startupV: 10,
            },
        ];
        const siteControllersOv = [
            {
                id: "INST_OV",
                modelId: "CHG_OV",
                area: "House",
                name: "OV Controller Instance",
            },
        ];

        const result = analyzeArray("A1", {
            arraysData,
            panelsData,
            chargersData: overVoltControllers,
            siteControllers: siteControllersOv,
            selections,
        });

        expect(result.status).toBe("error");
        expect(
            result.messages.some((m) => m.includes("exceeds PV controller limit"))
        ).toBe(true);
    });

    it("flags Vmp too low as fatal", () => {
        const selections = {
            A1: {
                panel: "PANEL_OK",
                controllerInstanceId: "INST_HS",
                controllerMppt: 1,
            },
        };
        const highStartupControllers = [
            ...chargersData,
            {
                id: "CHG_HS",
                name: "High Startup Controller",
                maxV: 200,
                maxIsc: 20,
                startupV: 500, // well above any possible hotVmp
            },
        ];
        const siteControllersHs = [
            {
                id: "INST_HS",
                modelId: "CHG_HS",
                area: "House",
                name: "HS Controller Instance",
            },
        ];

        const result = analyzeArray("A1", {
            arraysData,
            panelsData,
            chargersData: highStartupControllers,
            siteControllers: siteControllersHs,
            selections,
        });

        expect(result.status).toBe("error");
        expect(
            result.messages.some((m) =>
                m.includes("below PV controller startup threshold")
            )
        ).toBe(true);
    });

    it("flags Isc over current as fatal", () => {
        const selections = {
            A1: {
                panel: "PANEL_OK",
                controllerInstanceId: "INST_LI",
                controllerMppt: 1,
            },
        };
        const lowIscControllers = [
            ...chargersData,
            {
                id: "CHG_LI",
                name: "Low Current Limit Controller",
                maxV: 200,
                maxIsc: 5, // below array Isc of 10A
                startupV: 10,
            },
        ];
        const siteControllersLi = [
            {
                id: "INST_LI",
                modelId: "CHG_LI",
                area: "House",
                name: "LI Controller Instance",
            },
        ];

        const result = analyzeArray("A1", {
            arraysData,
            panelsData,
            chargersData: lowIscControllers,
            siteControllers: siteControllersLi,
            selections,
        });

        expect(result.status).toBe("error");
        expect(
            result.messages.some((m) =>
                m.includes("exceeds PV controller tracker limit")
            )
        ).toBe(true);
    });

    it("flags physical size violations as fatal", () => {
        const arraysWithLimits = [
            {
                ...arraysData[0],
                maxPanelHeight: 1800,
                maxPanelWidth: 1200,
            },
        ];
        const selections = {
            A1: {
                panel: "PANEL_TALL",
                controllerInstanceId: "INST_SAFE",
                controllerMppt: 1,
            },
        };

        const result = analyzeArray("A1", {
            arraysData: arraysWithLimits,
            panelsData,
            chargersData,
            siteControllers,
            selections,
        });

        expect(result.status).toBe("error");
        expect(
            result.messages.some((m) =>
                m.includes("exceeds your specified maximum dimensions")
            )
        ).toBe(true);
    });

    it("includes controller cost in total array cost and splits when shared", () => {
        const chargersWithPrice = [
            { id: "CHG_SAFE", name: "Safe Controller", maxV: 200, maxIsc: 20, startupV: 80, price: 600 },
        ];
        const twoArrays = [
            { ...arraysData[0], id: "A1" },
            { ...arraysData[0], id: "A2", name: "Test Array 2" },
        ];
        const oneArrayUsesController = { A1: { panel: "PANEL_OK", controllerInstanceId: "INST_SAFE", controllerMppt: 1 } };
        const result1 = analyzeArray("A1", {
            arraysData: twoArrays,
            panelsData,
            chargersData: chargersWithPrice,
            siteControllers,
            selections: oneArrayUsesController,
        });
        expect(result1.cost).toBe(100 * 4 + 600);

        const bothArraysShareController = {
            A1: { panel: "PANEL_OK", controllerInstanceId: "INST_SAFE", controllerMppt: 1 },
            A2: { panel: "PANEL_OK", controllerInstanceId: "INST_SAFE", controllerMppt: 2 },
        };
        const result2 = analyzeArray("A1", {
            arraysData: twoArrays,
            panelsData,
            chargersData: chargersWithPrice,
            siteControllers,
            selections: bothArraysShareController,
        });
        expect(result2.cost).toBe(100 * 4 + 300);
    });
});

