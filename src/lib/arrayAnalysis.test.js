import { describe, it, expect } from "vitest";
import { isCompatibleFormat, analyzeArray } from "./arrayAnalysis";

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
        expect(isCompatibleFormat(array, { gseCompatibility: "Both" })).toBe(
            true
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
});

