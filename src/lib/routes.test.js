import { describe, it, expect } from "vitest";
import { LOCAL_PROJECT_ID, TABS, arrayPath, isSamePath, resolvePath, tabToPath } from "./routes";

const arrays = [
    { id: "A1", area: "House" },
    { id: "array_2", area: "Barn roof" },
];
const base = `/p/${LOCAL_PROJECT_ID}`;

describe("routes (roadmap 13.3)", () => {
    it("maps every fixed view to a path and back", () => {
        for (const tab of Object.values(TABS)) {
            const path = tabToPath(tab);
            expect(resolvePath(path, arrays)).toEqual({ tab, contentTab: null, canonicalPath: path });
        }
        expect(tabToPath(TABS.guide)).toBe("/");
        expect(tabToPath(TABS.summary)).toBe(`${base}/summary`);
        expect(tabToPath(TABS.libraryPanels)).toBe("/library/panels");
        expect(tabToPath(TABS.guidePanels)).toBe("/learn/panels");
    });

    it("maps array pages, using `panel` for the Panel Selector", () => {
        expect(tabToPath("A1", { arraysData: arrays })).toBe(`${base}/s/House/a/A1/overview`);
        expect(tabToPath("A1", { arraysData: arrays, contentTab: "panels" })).toBe(`${base}/s/House/a/A1/panel`);
        expect(resolvePath(`${base}/s/House/a/A1/panel`, arrays)).toEqual({
            tab: "A1",
            contentTab: "panels",
            canonicalPath: `${base}/s/House/a/A1/panel`,
        });
        for (const contentTab of ["overview", "layout", "panels", "controllers"]) {
            const path = arrayPath(arrays[0], contentTab);
            expect(resolvePath(path, arrays).contentTab).toBe(contentTab);
        }
    });

    it("encodes area names and accepts the encoded or decoded form", () => {
        const path = tabToPath("array_2", { arraysData: arrays, contentTab: "layout" });
        expect(path).toBe(`${base}/s/Barn%20roof/a/array_2/layout`);
        expect(resolvePath(path, arrays).tab).toBe("array_2");
        expect(isSamePath(path, `${base}/s/Barn roof/a/array_2/layout/`)).toBe(true);
        expect(isSamePath(path, `${base}/s/Barn roof/a/array_2/panel`)).toBe(false);
    });

    it("resolves arrays by id, so a renamed area redirects to the canonical path", () => {
        const route = resolvePath(`${base}/s/Old%20name/a/A1/layout`, arrays);
        expect(route.tab).toBe("A1");
        expect(route.canonicalPath).toBe(`${base}/s/House/a/A1/layout`);
    });

    it("defaults a missing or unknown array tab to the overview", () => {
        expect(resolvePath(`${base}/s/House/a/A1`, arrays).canonicalPath).toBe(`${base}/s/House/a/A1/overview`);
        expect(resolvePath(`${base}/s/House/a/A1/nope`, arrays).contentTab).toBe("overview");
    });

    it("sends deleted arrays and not-yet-built project and system screens to the summary", () => {
        for (const path of [
            `${base}/s/House/a/gone/overview`,
            base,
            `${base}/s/House`,
            `${base}/s/House/setup`,
            "/p/someone-else/summary",
        ]) {
            expect(resolvePath(path, arrays)).toMatchObject({ tab: TABS.summary, canonicalPath: `${base}/summary` });
        }
        expect(tabToPath("gone", { arraysData: arrays })).toBe(`${base}/summary`);
    });

    it("sends aliases and unknown paths to their canonical page", () => {
        expect(resolvePath("/learn/guide", arrays)).toMatchObject({ tab: TABS.guide, canonicalPath: "/" });
        expect(resolvePath("/library", arrays)).toMatchObject({ tab: TABS.libraryPanels });
        expect(resolvePath("/library/panels/", arrays).canonicalPath).toBe("/library/panels");
        expect(resolvePath("/no/such/page", arrays)).toMatchObject({ tab: TABS.guide, canonicalPath: "/" });
    });
});
