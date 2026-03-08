import { describe, it, expect } from "vitest";
import {
    extractUserNotes,
    migrateArrays,
    migrateSelectionsAndSiteControllers,
    mergeChargers,
    mergePanels,
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
});

describe("mergeChargers", () => {
    const initialChargers = [
        { id: "C1", name: "Base", price: 100, notes: "init", active: true },
    ];

    it("returns initial chargers when nothing saved", () => {
        expect(mergeChargers(initialChargers, {})).toEqual(initialChargers);
    });

    it("merges saved chargers over initial ones", () => {
        const savedChargersJson = JSON.stringify([
            { id: "C1", price: 150, notes: "updated", active: false },
        ]);
        const merged = mergeChargers(initialChargers, { savedChargersJson });
        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({
            id: "C1",
            price: 150,
            notes: "updated",
            active: false,
        });
    });

    it("merges legacy mppts/inverters data to override price/notes", () => {
        const savedMpptsJson = JSON.stringify([
            { id: "C1", price: 200, notes: "mppt" },
        ]);
        const mergedFromMppts = mergeChargers(initialChargers, {
            savedMpptsJson,
            savedInvertersJson: null,
            savedChargersJson: null,
        });
        expect(mergedFromMppts[0]).toMatchObject({
            id: "C1",
            price: 200,
            notes: "mppt",
        });

        const savedInvertersJson = JSON.stringify([
            { id: "C1", price: 220, notes: "inv" },
        ]);
        const mergedFromInverters = mergeChargers(initialChargers, {
            savedMpptsJson: null,
            savedInvertersJson,
            savedChargersJson: null,
        });
        expect(mergedFromInverters[0]).toMatchObject({
            id: "C1",
            price: 220,
            notes: "inv",
        });
    });
});

describe("mergePanels", () => {
    const initialPanels = [
        {
            model: "P1",
            name: "Panel 1",
            price: 100,
            gseCompatibility: "Both",
            active: true,
        },
        { model: "P2", name: "Panel 2", price: 90, active: true },
    ];

    it("returns initial panels when nothing saved", () => {
        expect(mergePanels(initialPanels, null)).toEqual(initialPanels);
    });

    it("overlays price/active/gseCompatibility for existing panels", () => {
        const savedPanelsJson = JSON.stringify([
            {
                model: "P1",
                price: 150,
                active: false,
                gseCompatibility: "Portrait Only",
            },
        ]);
        const merged = mergePanels(initialPanels, savedPanelsJson);
        const p1 = merged.find((p) => p.model === "P1");
        expect(p1.price).toBe(150);
        expect(p1.active).toBe(false);
        expect(p1.gseCompatibility).toBe("Portrait Only");
    });

    it("keeps initial panels that are not in saved list", () => {
        const savedPanelsJson = JSON.stringify([
            { model: "P1", price: 150, active: true },
        ]);
        const merged = mergePanels(initialPanels, savedPanelsJson);
        expect(merged.find((p) => p.model === "P2")).toBeDefined();
    });
});

