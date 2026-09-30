import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { seedProjectsStore } from "../test/projectFixtures";

// One two-port unit, so the phone port cards have a used port and a free one.
vi.mock("../data/loadData.js", async (importOriginal) => {
    const actual = await importOriginal();
    const twoPort = actual.initialChargers.find((c) => Number(c.trackers) === 2 && c.type === "hybrid_inverter");
    return { ...actual, initialPanels: actual.initialPanels.slice(0, 2), initialChargers: [twoPort] };
});

import { AppStateProvider } from "../context/AppStateContext";
import App from "../App";
import { initialChargers, initialPanels } from "../data/loadData.js";

let location;
function Probe() {
    location = useLocation();
    return null;
}

function renderAt(path) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AppStateProvider>
                <App />
                <Probe />
            </AppStateProvider>
        </MemoryRouter>
    );
}

const setWidth = (w) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: w });
};

describe("tablet and phone layouts (roadmap 13.9)", () => {
    const initialWidth = window.innerWidth;
    beforeEach(() => {
        localStorage.clear();
        const store = seedProjectsStore();
        const [hybrid] = initialChargers;
        const home = store.projects[0];
        home.siteControllers = [{ id: "sc_1", modelId: hybrid.id, name: hybrid.name, systemId: "sys_house" }];
        Object.assign(home.arrays[0], { count: 8, panel: initialPanels[0].model, controllerInstanceId: "sc_1", controllerMppt: 1 });
        localStorage.setItem("solar_projects", JSON.stringify(store));
    });
    afterEach(() => setWidth(initialWidth));

    it("puts the sidebar in a drawer on tablets, closed again by navigating", async () => {
        setWidth(800);
        renderAt("/p/proj_home");
        expect(await screen.findByRole("heading", { level: 1, name: "Hawthorn Cottage" })).toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Project" })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
        const drawer = screen.getByRole("dialog", { name: "Navigation" });
        await userEvent.click(within(drawer).getByRole("link", { name: /^House/ }));
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_house"));
        expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
        await userEvent.keyboard("{Escape}");
        expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    });

    it("keeps the sidebar in place on desktops", async () => {
        setWidth(1280);
        renderAt("/p/proj_home");
        expect(await screen.findByRole("navigation", { name: "Project" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open navigation" })).not.toBeInTheDocument();
    });

    it("on phones: Library and Learn in the menu, the diagram as a list, ports as cards", async () => {
        setWidth(375);
        renderAt("/p/proj_home/s/sys_house");
        await screen.findByRole("heading", { level: 1, name: "House" });
        expect(screen.queryByRole("link", { name: "Library" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /^More: / }));
        expect(screen.getByRole("menuitem", { name: "Library" })).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");

        expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("list", { name: "System in power-flow order" })).toBeInTheDocument();

        await userEvent.click(screen.getByRole("tab", { name: "Controllers" }));
        const ports = await screen.findByRole("list", { name: /ports$/ });
        expect(within(ports).getAllByRole("listitem")).toHaveLength(2);
        expect(within(ports).getByRole("link", { name: "South roof" })).toBeInTheDocument();
        expect(within(ports).getByText("Free")).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows the panel list as cards on phones", async () => {
        setWidth(375);
        renderAt("/p/proj_home/s/sys_house/a/A1/panel");
        const list = await screen.findByRole("list", { name: "Panels" });
        expect(within(list).getByText("Selected")).toBeInTheDocument(); // South roof's panel
        expect(screen.getByRole("combobox", { name: /Sort by/ })).toBeInTheDocument();
    });
});
