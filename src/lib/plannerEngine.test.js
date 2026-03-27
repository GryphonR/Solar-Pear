import { describe, it, expect } from "vitest";
import { computePlannerLayouts, dropSmallestPanelsByFootprint, projectedToTrueY_m } from "./plannerEngine";

describe("projectedToTrueY_m", () => {
    it("converts projected Y using tilt (trueY = projectedY / cos(tilt))", () => {
        const trueY = projectedToTrueY_m(4, 30);
        expect(trueY).toBeCloseTo(4 / Math.cos((30 * Math.PI) / 180), 6);
    });
});

describe("dropSmallestPanelsByFootprint", () => {
    const p = (model, w, h, power = 100) => ({ model, name: model, width: w, height: h, power, active: true });

    it("returns input unchanged when count is 0", () => {
        const panels = [p("A", 1000, 1000), p("B", 500, 500)];
        expect(dropSmallestPanelsByFootprint(panels, 0)).toEqual(panels);
    });

    it("returns input unchanged when at most n panels", () => {
        const panels = [p("A", 100, 100), p("B", 200, 200), p("C", 300, 300)];
        expect(dropSmallestPanelsByFootprint(panels, 3)).toEqual(panels);
    });

    it("drops the 3 smallest footprints by mm²", () => {
        const panels = [
            p("tiny", 100, 100),
            p("s1", 200, 200),
            p("s2", 200, 200, 50),
            p("m", 1000, 500),
            p("l", 1000, 1800),
            p("xl", 1300, 2000),
        ];
        const out = dropSmallestPanelsByFootprint(panels, 3);
        expect(out).toHaveLength(3);
        expect(out.map((x) => x.model)).toEqual(["m", "l", "xl"]);
    });
});

describe("computePlannerLayouts", () => {
    const roofRect = (w_m, h_m) => [
        { x: 0, y: 0 },
        { x: w_m, y: 0 },
        { x: w_m, y: h_m },
        { x: 0, y: h_m },
    ];

    it("respects gap spacing when computing grid placement", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 400,
                width: 1000,
                height: 1000,
                active: true,
            },
        ];

        const resNoGap = computePlannerLayouts({
            roofPolygon_m: roofRect(2, 1),
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });
        expect(resNoGap.ranked[0].count).toBe(2);

        const resWithGap = computePlannerLayouts({
            roofPolygon_m: roofRect(2, 1),
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 100 },
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });
        expect(resWithGap.ranked[0].count).toBe(1);
    });

    it("either orientation evaluates portrait and landscape (not portrait-only)", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 400,
                width: 600,
                height: 1200,
                active: true,
            },
        ];
        const roof = roofRect(3, 2);
        const portraitOnly = computePlannerLayouts({
            roofPolygon_m: roof,
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });
        const either = computePlannerLayouts({
            roofPolygon_m: roof,
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "either", topN: 5, includeInactivePanels: false },
        });
        const orientations = new Set(either.ranked.map((r) => r.orientation));
        expect(orientations.has("portrait")).toBe(true);
        expect(orientations.has("landscape")).toBe(true);
        expect(either.ranked.length).toBeGreaterThanOrEqual(portraitOnly.ranked.length);
    });

    it("mixed orientation option matches either (same ranked ids)", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 400,
                width: 600,
                height: 1200,
                active: true,
            },
        ];
        const roof = roofRect(3, 2);
        const either = computePlannerLayouts({
            roofPolygon_m: roof,
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "either", topN: 5, includeInactivePanels: false },
        });
        const mixed = computePlannerLayouts({
            roofPolygon_m: roof,
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "mixed", topN: 5, includeInactivePanels: false },
        });
        const idsEither = either.ranked.map((r) => r.id).join(",");
        const idsMixed = mixed.ranked.map((r) => r.id).join(",");
        expect(idsMixed).toBe(idsEither);
    });

    it("blocks placement inside exclusion rectangles", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 400,
                width: 1000,
                height: 1000,
                active: true,
            },
        ];

        const res = computePlannerLayouts({
            roofPolygon_m: roofRect(2, 1),
            exclusions_m: [{ id: "E1", x: 1, y: 0, w: 1, h: 1 }],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });

        expect(res.ranked[0].count).toBe(1);
    });

    it("adapts grid offset to improve packing around exclusions", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 400,
                width: 1000,
                height: 1000,
                active: true,
            },
        ];

        // 4.2m x 1m roof fits 4 panels in a row with no gap.
        // A narrow exclusion around x=1m can block TWO panels for a naive origin at x=0,
        // but shifting the grid origin can reduce that to ONE blocked panel.
        const res = computePlannerLayouts({
            roofPolygon_m: roofRect(4.2, 1),
            exclusions_m: [{ id: "E1", x: 0.95, y: 0, w: 0.2, h: 1 }],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });

        expect(res.ranked[0].count).toBe(3);
    });

    it("swaps width/height for landscape orientation", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 450,
                width: 1100,
                height: 1700,
                active: true,
            },
        ];

        const res = computePlannerLayouts({
            roofPolygon_m: roofRect(2, 1.2),
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "both", topN: 5, includeInactivePanels: false },
        });

        const best = res.ranked[0];
        expect(best.orientation).toBe("landscape");
        expect(best.count).toBe(1);
    });

    it("orientation 'either' tries portrait and landscape (same as 'both' for the fitter)", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 450,
                width: 1100,
                height: 1700,
                active: true,
            },
        ];

        const res = computePlannerLayouts({
            roofPolygon_m: roofRect(2, 1.2),
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "either", topN: 5, includeInactivePanels: false },
        });

        expect(res.ranked.length).toBeGreaterThan(0);
        const orientations = new Set(res.ranked.map((r) => r.orientation));
        expect(orientations.has("portrait")).toBe(true);
        expect(orientations.has("landscape")).toBe(true);
    });

    it("enforces edge setback against angled edges (distance-to-edge)", () => {
        const panelsData = [
            {
                model: "P1",
                name: "Panel 1",
                power: 400,
                width: 1000,
                height: 1000,
                active: true,
            },
        ];

        // Right triangle with angled hypotenuse x+y=2.
        // A 1x1 panel at (0,0) has a corner at (1,1) exactly on the angled edge.
        const roofPolygon_m = [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: 2 },
        ];

        const resNoSetback = computePlannerLayouts({
            roofPolygon_m,
            exclusions_m: [],
            spacing: { edge_mm: 0, gap_mm: 0 },
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });
        expect(resNoSetback.ranked[0].count).toBe(1);

        const resWithSetback = computePlannerLayouts({
            roofPolygon_m,
            exclusions_m: [],
            spacing: { edge_mm: 200, gap_mm: 0 }, // 0.2m
            panelsData,
            options: { orientation: "portrait", topN: 5, includeInactivePanels: false },
        });
        // With a 0.2m setback, the 1x1 panel can't fit fully.
        expect(resWithSetback.ranked[0].count).toBe(0);
    });
});

