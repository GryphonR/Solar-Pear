import { describe, it, expect } from "vitest";
import { TABS, buildPath, isSamePath, parsePath, resolveRoute, routeToTab, tabToPath } from "./routes";
import { seedProjectsStore } from "../test/projectFixtures";

const store = seedProjectsStore();
const home = store.projects[0];

describe("routes (roadmap 13.3)", () => {
    it("round-trips every route shape through buildPath and parsePath", () => {
        const routes = [
            { view: "about" },
            { view: "learn", slug: null },
            { view: "learn", slug: "methodology" },
            { view: "library", section: "controllers" },
            { view: "project", projectId: "proj_home" },
            { view: "summary", projectId: "proj_home" },
            { view: "system", projectId: "proj_home", systemId: "sys_barn", tab: "setup" },
            { view: "system", projectId: "proj_home", systemId: "sys_barn", tab: "overview" },
            { view: "array", projectId: "proj_home", systemId: "sys_house", arrayId: "A1", tab: "panel" },
        ];
        for (const route of routes) expect(parsePath(buildPath(route))).toEqual(route);
        expect(buildPath({ view: "system", projectId: "p", systemId: "s", tab: "overview" })).toBe("/p/p/s/s");
        expect(parsePath("/")).toEqual({ view: "home" });
        expect(parsePath("/nope")).toBeNull();
        expect(parsePath("/learn/nope")).toBeNull();
    });

    it("maps old UI tabs to paths and back", () => {
        const fixed = [
            TABS.guidePanels,
            TABS.guideControllers,
            TABS.methodology,
            TABS.about,
            TABS.libraryPanels,
            TABS.libraryControllers,
            TABS.guide,
        ];
        for (const tab of fixed) {
            const path = tabToPath(tab, { project: home });
            expect(routeToTab(resolveRoute(path, store).route).tab).toBe(tab);
        }
        expect(tabToPath(TABS.summary, { project: home })).toBe("/p/proj_home/summary");
        expect(tabToPath("A2", { project: home, contentTab: "panels" })).toBe("/p/proj_home/s/sys_barn/a/A2/panel");
        expect(routeToTab(parsePath("/p/proj_home/s/sys_barn/a/A2/panel"))).toEqual({ tab: "A2", contentTab: "panels" });
        expect(tabToPath("gone", { project: home })).toBe("/p/proj_home/summary");
    });

    it("shows the summary for project and system screens in the old UI", () => {
        for (const path of ["/p/proj_home", "/p/proj_home/s/sys_house", "/p/proj_home/s/sys_house/bom"]) {
            expect(routeToTab(parsePath(path)).tab).toBe(TABS.summary);
        }
        expect(routeToTab(parsePath("/")).tab).toBe(TABS.guide);
        expect(routeToTab(parsePath("/learn")).tab).toBe(TABS.guide);
    });

    it("keeps valid routes, and corrects an array's system", () => {
        expect(resolveRoute("/p/proj_home/s/sys_barn/a/A2/layout", store).canonicalPath).toBe("/p/proj_home/s/sys_barn/a/A2/layout");
        expect(resolveRoute("/p/proj_home/s/sys_house/a/A2/layout", store).canonicalPath).toBe("/p/proj_home/s/sys_barn/a/A2/layout");
        expect(resolveRoute("/p/proj_home/s/sys_barn/a/A2", store).canonicalPath).toBe("/p/proj_home/s/sys_barn/a/A2/overview");
        expect(resolveRoute("/p/proj_van/s/sys_van/a/V1/overview", store).route.projectId).toBe("proj_van");
    });

    it("falls back to the nearest thing that still exists", () => {
        expect(resolveRoute("/p/proj_home/s/sys_barn/a/gone/panel", store).canonicalPath).toBe("/p/proj_home/s/sys_barn");
        expect(resolveRoute("/p/proj_home/s/gone/a/gone", store).canonicalPath).toBe("/p/proj_home");
        expect(resolveRoute("/p/proj_home/s/gone/controllers", store).canonicalPath).toBe("/p/proj_home");
        expect(resolveRoute("/p/unknown/summary", store).canonicalPath).toBe("/p/proj_home");
        expect(resolveRoute("/no/such/page", store).canonicalPath).toBe("/");
        expect(resolveRoute("/library", store).canonicalPath).toBe("/library/panels");
        expect(resolveRoute("/library/panels/", store).canonicalPath).toBe("/library/panels");
    });

    it("compares paths ignoring encoding and trailing slashes", () => {
        expect(isSamePath("/p/a%20b/summary", "/p/a b/summary/")).toBe(true);
        expect(isSamePath("/p/a/summary", "/p/b/summary")).toBe(false);
    });
});
