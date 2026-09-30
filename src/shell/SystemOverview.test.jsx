import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { seedProjectsStore } from "../test/projectFixtures";

// One two-port unit, so the diagram has a used port and a free one.
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

const stored = () => JSON.parse(localStorage.getItem("solar_projects"));
const [hybrid] = initialChargers;

/** House: South roof on MPPT 1 of a hybrid with a panel, plus West roof waiting with no port. */
function seed() {
    const store = seedProjectsStore();
    const home = store.projects[0];
    home.siteControllers = [{ id: "sc_1", modelId: hybrid.id, name: hybrid.name, systemId: "sys_house" }];
    Object.assign(home.arrays[0], { count: 8, panel: initialPanels[0].model, controllerInstanceId: "sc_1", controllerMppt: 1 });
    home.arrays.push({ ...home.arrays[1], id: "A3", name: "West roof", systemId: "sys_house" });
    return store;
}

describe("system overview single line diagram (roadmap 13.7)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seed()));
        localStorage.setItem("solar_ui", "next");
    });

    it("draws the system in power-flow order, reachable by keyboard", async () => {
        renderAt("/p/proj_home/s/sys_house");
        const sld = await screen.findByTestId("sld");
        const focusable = [...sld.querySelectorAll("a, button, select, [tabindex='0']")].map((el) => el.getAttribute("aria-label") || el.textContent.trim());
        expect(focusable[0]).toMatch(/^South roof: /);
        expect(focusable[1]).toMatch(/^South roof to MPPT 1: /);
        expect(focusable[2]).toMatch(/^DC isolator/);
        expect(focusable[3]).toBe("Assign to MPPT 2");
        expect(focusable[4]).toBe(hybrid.name);
        const westAt = focusable.findIndex((t) => /Choose a panel/.test(t));
        expect(westAt).toBeGreaterThan(4);
        expect(screen.getByText("Checked at -10 °C cold · 65 °C cell")).toBeInTheDocument();
    });

    it("assigns a waiting array to a free port from the diagram", async () => {
        renderAt("/p/proj_home/s/sys_house");
        const sld = await screen.findByTestId("sld");
        await userEvent.selectOptions(within(sld).getByRole("combobox", { name: "Assign West roof" }), `${hybrid.name} MPPT 2`);
        await waitFor(() => expect(stored().projects[0].arrays.find((a) => a.id === "A3")).toMatchObject({ controllerInstanceId: "sc_1", controllerMppt: 2 }));
    });

    it("has a list view with the same content, and lists issues with a fix", async () => {
        renderAt("/p/proj_home/s/sys_house");
        await screen.findByTestId("sld");
        await userEvent.click(screen.getByRole("button", { name: "List" }));
        const list = screen.getByRole("list", { name: "System in power-flow order" });
        const rows = within(list).getAllByRole("listitem");
        expect(rows[0]).toHaveTextContent(/South roof/);
        expect(rows[1]).toHaveTextContent(/Voc \d+ \/ \d+ V/);
        expect(rows[1]).toHaveTextContent(/at -10 °C \/ 65 °C/);

        const issues = screen.getByRole("region", { name: "Issues" });
        const west = within(issues).getByText("West roof").closest("article");
        expect(west).toHaveTextContent("No panel or controller yet");
        await userEvent.click(within(west).getByRole("link", { name: "Choose a panel" }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A3/panel");
    });

    it("shows an empty system as placeholders with a next step", async () => {
        renderAt("/p/proj_home/s/sys_barn");
        const sld = await screen.findByTestId("sld");
        expect(within(sld).getByText("No controller yet")).toBeInTheDocument();
        expect(within(sld).getByRole("link", { name: "Choose a panel →" })).toBeInTheDocument();
    });
});
