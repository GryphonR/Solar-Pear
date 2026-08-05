import { describe, expect, it } from "vitest";
import {
    NO_SERIES_KEY,
    panelSeriesKey,
    pushPanelSeriesUniformityIssues,
    pushDesignNotesUniformityIssues,
} from "./panelSeriesShared.mjs";

describe("panelSeriesKey", () => {
    it("buckets blank/missing panel-series under the sentinel", () => {
        expect(panelSeriesKey({ "panel-series": "" })).toBe(NO_SERIES_KEY);
        expect(panelSeriesKey({})).toBe(NO_SERIES_KEY);
        expect(panelSeriesKey({ "panel-series": "Vertex S+" })).toBe("Vertex S+");
    });
});

describe("pushPanelSeriesUniformityIssues", () => {
    it("flags a shared physical field that differs within a series", () => {
        const issues = [];
        pushPanelSeriesUniformityIssues(
            "trina.json",
            [
                { model: "a", "panel-series": "Vertex S+", height: 1700 },
                { model: "b", "panel-series": "Vertex S+", height: 1800 },
            ],
            issues
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].kind).toBe("series_spec_mismatch");
        expect(issues[0].field).toBe("height");
    });

    it("does not flag a single-member series", () => {
        const issues = [];
        pushPanelSeriesUniformityIssues(
            "trina.json",
            [{ model: "a", "panel-series": "Vertex S+", height: 1700 }],
            issues
        );
        expect(issues).toHaveLength(0);
    });
});

describe("pushDesignNotesUniformityIssues", () => {
    it("flags design notes that differ within a real series", () => {
        const issues = [];
        pushDesignNotesUniformityIssues(
            "trina.json",
            [
                { model: "a", "panel-series": "Vertex S+", notes: "Series note." },
                { model: "b", "panel-series": "Vertex S+", notes: "Different text." },
            ],
            issues
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].kind).toBe("design_notes_mismatch");
        expect(issues[0].series).toBe("Vertex S+");
        expect(issues[0].variants.map((v) => v.model)).toEqual(["a", "b"]);
    });

    it("does not flag a series whose panels share identical notes", () => {
        const issues = [];
        pushDesignNotesUniformityIssues(
            "trina.json",
            [
                { model: "a", "panel-series": "Vertex S+", notes: "Shared note." },
                { model: "b", "panel-series": "Vertex S+", notes: "Shared note." },
            ],
            issues
        );
        expect(issues).toHaveLength(0);
    });

    it("excludes the (no series) bucket entirely, even with mismatched notes", () => {
        const issues = [];
        pushDesignNotesUniformityIssues(
            "voltacon.json",
            [
                { model: "a", "panel-series": "", notes: "One-off note A." },
                { model: "b", "panel-series": "", notes: "One-off note B." },
            ],
            issues
        );
        expect(issues).toHaveLength(0);
    });

    it("does not flag a single-member series", () => {
        const issues = [];
        pushDesignNotesUniformityIssues(
            "trina.json",
            [{ model: "a", "panel-series": "Vertex S+", notes: "Solo note." }],
            issues
        );
        expect(issues).toHaveLength(0);
    });
});
