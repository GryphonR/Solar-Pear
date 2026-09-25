import { describe, it, expect } from "vitest";
import {
    applyReplacements,
    extractUserNotes,
    migrateArrays,
    migrateSelectionsAndSiteControllers,
} from "./migration";

describe("extractUserNotes", () => {
    it("returns empty object when no notes", () => {
        expect(extractUserNotes(null)).toEqual({});
    });

    it("parses valid JSON", () => {
        const notes = { a: "note" };
        expect(extractUserNotes(JSON.stringify(notes))).toEqual(notes);
    });

    it("handles invalid JSON gracefully", () => {
        expect(extractUserNotes("{not-json")).toEqual({});
    });
});

describe("migrateArrays", () => {
    const initialArrays = [
        { id: "A1", name: "Array 1", area: "House", mounting: "On Roof" },
    ];

    it("falls back to initial arrays when nothing saved", () => {
        expect(migrateArrays(null, initialArrays)).toEqual(initialArrays);
    });

    it("applies defaults for missing fields on saved arrays", () => {
        const saved = JSON.stringify([
            { id: "garage1", name: "Garage Array", area: "" },
        ]);
        const result = migrateArrays(saved, initialArrays)[0];
        expect(result.format).toBe("Portrait");
        expect(result.mounting).toBe("In-Roof (GSE)");
        expect(result.maxPanelHeight).toBe("");
        expect(result.maxPanelWidth).toBe("");
        expect(result.maxPanelWeight).toBe("");
        expect(result.area).toBe("Garage");
    });
});

describe("migrateSelectionsAndSiteControllers", () => {
    const initialArrays = [{ id: "A1", area: "House" }];
    const initialSelections = {
        A1: { panel: "P1", controller: "LEGACY_CONTROLLER" },
    };
    const initialChargers = [
        {
            id: "LEGACY_CONTROLLER",
            name: "Legacy Controller",
            manufacturer: "Victron",
        },
    ];

    it("returns initial selections and empty controllers when no saved data", () => {
        const { selections, siteControllers } = migrateSelectionsAndSiteControllers(
            {
                savedSelectionsJson: null,
                savedSiteControllersJson: null,
                savedArraysJson: null,
                initialArrays,
                initialSelections,
                initialChargers,
            }
        );
        expect(selections).toEqual(initialSelections);
        expect(siteControllers).toEqual([]);
    });

    it("migrates legacy controller string ids to instances with mppt indices", () => {
        const savedSelections = JSON.stringify({
            A1: { panel: "P1", controller: "LEGACY_CONTROLLER" },
        });
        const { selections, siteControllers } = migrateSelectionsAndSiteControllers(
            {
                savedSelectionsJson: savedSelections,
                savedSiteControllersJson: null,
                savedArraysJson: JSON.stringify(initialArrays),
                initialArrays,
                initialSelections,
                initialChargers,
            }
        );

        const sel = selections.A1;
        expect(sel.panel).toBe("P1");
        expect(sel.controllerInstanceId).toBeDefined();
        expect(sel.controllerMppt).toBe(1);
        expect(siteControllers.length).toBe(1);
        expect(siteControllers[0].modelId).toBe("LEGACY_CONTROLLER");
        expect(siteControllers[0].area).toBe("House");
    });

    it("creates one shared instance when two arrays use the same legacy controller with enough trackers", () => {
        const twoArrays = [
            { id: "A1", area: "House" },
            { id: "A2", area: "House" },
        ];
        const savedSelections = JSON.stringify({
            A1: { panel: "P1", controller: "LEGACY_CONTROLLER" },
            A2: { panel: "P2", controller: "LEGACY_CONTROLLER" },
        });
        const { selections, siteControllers } = migrateSelectionsAndSiteControllers({
            savedSelectionsJson: savedSelections,
            savedSiteControllersJson: null,
            savedArraysJson: JSON.stringify(twoArrays),
            initialArrays: twoArrays,
            initialSelections: {},
            initialChargers: [
                { id: "LEGACY_CONTROLLER", name: "Legacy", manufacturer: "X", trackers: 2 },
            ],
        });

        expect(siteControllers).toHaveLength(1);
        expect(selections.A1.controllerInstanceId).toBe(selections.A2.controllerInstanceId);
        expect(selections.A1.controllerMppt).toBe(1);
        expect(selections.A2.controllerMppt).toBe(2);
    });

    it("spawns another instance when legacy MPPT count exceeds trackers", () => {
        const twoArrays = [
            { id: "A1", area: "House" },
            { id: "A2", area: "House" },
        ];
        const savedSelections = JSON.stringify({
            A1: { panel: "P1", controller: "LEGACY_CONTROLLER" },
            A2: { panel: "P2", controller: "LEGACY_CONTROLLER" },
        });
        const { selections, siteControllers } = migrateSelectionsAndSiteControllers({
            savedSelectionsJson: savedSelections,
            savedSiteControllersJson: null,
            savedArraysJson: JSON.stringify(twoArrays),
            initialArrays: twoArrays,
            initialSelections: {},
            initialChargers: [
                { id: "LEGACY_CONTROLLER", name: "Legacy", manufacturer: "X", trackers: 1 },
            ],
        });

        expect(siteControllers).toHaveLength(2);
        expect(selections.A1.controllerInstanceId).not.toBe(selections.A2.controllerInstanceId);
        expect(selections.A1.controllerMppt).toBe(1);
        expect(selections.A2.controllerMppt).toBe(1);
    });
});

describe("applyReplacements", () => {
    const catalogue = { panelModels: new Set(["NEW", "C"]), controllerIds: new Set(["ctrl2"]) };

    it("remaps discontinued panels and controllers to existing successors, following chains", () => {
        const result = applyReplacements(
            {
                arrays: [
                    { id: "A1", panel: "OLD" },
                    { id: "A2", panel: "A" },
                    { id: "A3", panel: "NEW" },
                    { id: "A4", panel: "OLD" },
                ],
                siteControllers: [{ id: "I1", modelId: "ctrl1" }],
            },
            { panels: { OLD: "NEW", A: "B", B: "C" }, controllers: { ctrl1: "ctrl2" } },
            catalogue
        );
        expect(result.arrays.map((a) => a.panel)).toEqual(["NEW", "C", "NEW", "NEW"]);
        expect(result.siteControllers[0].modelId).toBe("ctrl2");
        expect(result.changes).toEqual([
            { kind: "panel", from: "OLD", to: "NEW" },
            { kind: "panel", from: "A", to: "C" },
            { kind: "controller", from: "ctrl1", to: "ctrl2" },
        ]);
    });

    it("leaves ids alone when the successor does not exist or the item is still listed", () => {
        const design = { arrays: [{ id: "A1", panel: "X" }, { id: "A2", panel: "C" }], siteControllers: [] };
        const result = applyReplacements(design, { panels: { X: "MISSING", C: "NEW" } }, catalogue);
        expect(result.arrays).toEqual(design.arrays);
        expect(result.changes).toEqual([]);
    });

    it("does not loop on cycles", () => {
        const result = applyReplacements(
            { arrays: [{ id: "A1", panel: "P" }], siteControllers: [] },
            { panels: { P: "Q", Q: "P" } },
            catalogue
        );
        expect(result.changes).toEqual([]);
    });
});
