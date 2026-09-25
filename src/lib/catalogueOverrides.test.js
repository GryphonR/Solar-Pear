import { describe, it, expect } from "vitest";
import {
    diffCatalogue,
    applyCatalogue,
    migrateLegacyCatalogue,
    sanitizeCatalogueDiff,
    loadCatalogueFromStorage,
    CATALOGUE_OVERRIDES_KEY,
} from "./catalogueOverrides";

const bundled = [
    { model: "A", name: "Panel A", price: 100, active: true, priceCheckedAt: "2026-08-01", specs: [1, 2] },
    { model: "B", name: "Panel B", price: 120, active: true, priceCheckedAt: "2026-08-01" },
];

describe("diffCatalogue / applyCatalogue", () => {
    it("stores nothing when the catalogue is untouched", () => {
        expect(diffCatalogue(bundled, bundled, "model")).toEqual({ overrides: {}, custom: [], removed: [] });
    });

    it("stores only changed fields, custom items and removals, and round-trips", () => {
        const current = [
            { ...bundled[0], price: 90 },
            { model: "MINE", name: "My panel", price: 50 },
        ];
        const diff = diffCatalogue(current, bundled, "model");
        expect(diff).toEqual({
            overrides: { A: { price: 90 } },
            custom: [{ model: "MINE", name: "My panel", price: 50 }],
            removed: ["B"],
        });
        expect(applyCatalogue(bundled, diff, "model")).toEqual(current);
    });

    it("lets refreshed bundled prices through when the user never edited them", () => {
        const diff = diffCatalogue(bundled, bundled, "model");
        const refreshed = [{ ...bundled[0], price: 80, priceCheckedAt: "2026-09-20" }, bundled[1]];
        expect(applyCatalogue(refreshed, diff, "model")[0].price).toBe(80);
    });

    it("keeps a user's price edit across catalogue refreshes", () => {
        const diff = diffCatalogue([{ ...bundled[0], price: 70 }, bundled[1]], bundled, "model");
        const refreshed = [{ ...bundled[0], price: 80, priceCheckedAt: "2026-09-20" }, bundled[1]];
        const merged = applyCatalogue(refreshed, diff, "model");
        expect(merged[0].price).toBe(70);
        expect(merged[0].priceCheckedAt).toBe("2026-09-20");
    });

    it("drops overrides for items no longer bundled and custom items that now clash with bundled ids", () => {
        const diff = { overrides: { GONE: { price: 1 } }, custom: [{ model: "A", price: 1 }], removed: [] };
        expect(applyCatalogue(bundled, diff, "model")).toEqual(bundled);
    });

    it("works with controllers keyed by id", () => {
        const ctrl = [{ id: "c1", price: 10, notes: "x" }];
        const diff = diffCatalogue([{ id: "c1", price: 12, notes: "x" }], ctrl, "id");
        expect(diff.overrides).toEqual({ c1: { price: 12 } });
    });
});

describe("migrateLegacyCatalogue", () => {
    it("keeps a legacy price edit when the bundle has not been re-priced since the snapshot", () => {
        const saved = [{ ...bundled[0], price: 95 }, bundled[1]];
        const { diff, droppedEdits } = migrateLegacyCatalogue(saved, bundled, "panels");
        expect(diff.overrides).toEqual({ A: { price: 95 } });
        expect(droppedEdits).toBe(0);
    });

    it("drops a legacy price when the bundle was re-priced since the snapshot (stale price)", () => {
        const saved = [{ ...bundled[0], price: 150, priceCheckedAt: "2026-03-01" }, bundled[1]];
        const { diff, droppedEdits } = migrateLegacyCatalogue(saved, bundled, "panels");
        expect(diff.overrides).toEqual({});
        expect(droppedEdits).toBe(1);
    });

    it("drops legacy prices from snapshots without priceCheckedAt", () => {
        const { priceCheckedAt: _unused, ...old } = bundled[0];
        const { droppedEdits } = migrateLegacyCatalogue([{ ...old, price: 1 }], bundled, "panels");
        expect(droppedEdits).toBe(1);
    });

    it("keeps active and GSE edits, ignores non-editable spec differences, keeps custom items", () => {
        const saved = [
            { ...bundled[0], active: false, gseCompatibility: "None", name: "Old name" },
            { model: "MINE", name: "Mine", price: 5 },
        ];
        const { diff } = migrateLegacyCatalogue(saved, bundled, "panels");
        expect(diff.overrides).toEqual({ A: { active: false, gseCompatibility: "None" } });
        expect(diff.custom).toEqual([{ model: "MINE", name: "Mine", price: 5 }]);
        expect(diff.removed).toEqual([]);
    });

    it("drops legacy controller notes differences", () => {
        const ctrl = [{ id: "c1", price: 10, notes: "new", active: true, priceCheckedAt: "2026-08-01" }];
        const saved = [{ ...ctrl[0], notes: "old AI note", active: false }];
        const { diff, droppedEdits } = migrateLegacyCatalogue(saved, ctrl, "chargers");
        expect(diff.overrides).toEqual({ c1: { active: false } });
        expect(droppedEdits).toBe(1);
    });

    it("returns an empty diff for non-array input", () => {
        expect(migrateLegacyCatalogue(null, bundled, "panels").diff).toEqual({ overrides: {}, custom: [], removed: [] });
    });
});

describe("sanitizeCatalogueDiff", () => {
    it("rejects non-objects and cleans bad members", () => {
        expect(sanitizeCatalogueDiff(null)).toBeNull();
        expect(sanitizeCatalogueDiff([])).toBeNull();
        expect(sanitizeCatalogueDiff({ overrides: [], custom: [1, { model: "x" }], removed: ["a", 2] })).toEqual({
            overrides: {},
            custom: [{ model: "x" }],
            removed: ["a"],
        });
    });
});

describe("loadCatalogueFromStorage (storage v1 → v2)", () => {
    const makeStorage = (init = {}) => {
        const m = new Map(Object.entries(init));
        return {
            getItem: (k) => (m.has(k) ? m.get(k) : null),
            setItem: (k, v) => m.set(k, String(v)),
            removeItem: (k) => m.delete(k),
            dump: () => Object.fromEntries(m),
        };
    };

    it("returns the bundled catalogue for a fresh visitor", () => {
        const r = loadCatalogueFromStorage(bundled, [], makeStorage());
        expect(r.panels).toEqual(bundled);
        expect(r.migrated).toBe(false);
    });

    it("migrates legacy keys once, removes them, and reports dropped stale prices", () => {
        const storage = makeStorage({
            solar_panels: JSON.stringify([
                { ...bundled[0], price: 150, priceCheckedAt: "2026-03-01" }, // stale snapshot
                { ...bundled[1], active: false },
            ]),
        });
        const r = loadCatalogueFromStorage(bundled, [], storage);
        expect(r.migrated).toBe(true);
        expect(r.droppedEdits).toBe(1);
        expect(r.panels[0].price).toBe(100);
        expect(r.panels[1].active).toBe(false);
        const dump = storage.dump();
        expect(dump.solar_panels).toBeUndefined();
        expect(JSON.parse(dump[CATALOGUE_OVERRIDES_KEY]).panels.overrides).toEqual({ B: { active: false } });
        expect(dump.solar_storage_version).toBe("2");
        // Second load reads the new format.
        expect(loadCatalogueFromStorage(bundled, [], storage).migrated).toBe(false);
    });
});
