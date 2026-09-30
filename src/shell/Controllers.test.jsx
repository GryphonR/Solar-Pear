import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { seedProjectsStore } from "../test/projectFixtures";

// A one-port charger and a two-port unit, so ports and replacing can be exercised.
vi.mock("../data/loadData.js", async (importOriginal) => {
    const actual = await importOriginal();
    const onePort = actual.initialChargers.find((c) => c.id === "ss75_15");
    const twoPort = actual.initialChargers.find((c) => Number(c.trackers) === 2 && c.type !== "microinverter");
    return {
        ...actual,
        initialPanels: actual.initialPanels.slice(0, 2),
        initialChargers: [onePort, twoPort],
    };
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
const fullName = (c) => `${c.manufacturer ? `${c.manufacturer} ` : ""}${c.name}`;
const [onePort, twoPort] = initialChargers;

async function addController(model) {
    await userEvent.click(screen.getAllByRole("button", { name: /Add a controller/ })[0]);
    const panel = screen.getByRole("complementary", { name: /Add a controller/ });
    await userEvent.type(within(panel).getByRole("searchbox", { name: "Search controllers" }), model.name);
    await userEvent.click(within(panel).getByRole("button", { name: `Add ${fullName(model)}` }));
}

describe("array hub and system controllers (roadmap 13.6)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
    });

    it("shows the array hub with three slots and no controller tab", async () => {
        renderAt("/p/proj_home/s/sys_house/a/A1/overview");
        const tabs = await screen.findByRole("tablist", { name: "South roof sections" });
        expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Layout", "Panel"]);
        expect(screen.getByRole("button", { name: /Choose a panel/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Add a controller/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Controller Selector/ })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /Choose a panel/ }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/panel");
    });

    it("sends old array controller links to the system's Controllers tab", async () => {
        renderAt("/p/proj_home/s/sys_house/a/A1/controllers");
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_house/controllers"));
    });

    it("adds a controller, assigns a free port, and only removes an empty unit", async () => {
        renderAt("/p/proj_home/s/sys_house/controllers");
        expect(await screen.findByText(/No controllers in House yet/)).toBeInTheDocument();
        expect(screen.getByText("South roof has no port")).toBeInTheDocument();

        await addController(onePort);
        const unit = await screen.findByRole("article", { name: new RegExp(onePort.name) });
        await userEvent.selectOptions(within(unit).getByRole("combobox", { name: "Assign an array to MPPT 1" }), "South roof");
        await waitFor(() => expect(within(unit).getByRole("link", { name: "South roof" })).toBeInTheDocument());
        expect(screen.queryByText("South roof has no port")).not.toBeInTheDocument();

        const remove = within(unit).getByRole("button", { name: "Remove" });
        expect(remove).toBeDisabled();
        await userEvent.click(within(unit).getByRole("button", { name: "Unassign" }));
        await waitFor(() => expect(remove).toBeEnabled());
        await userEvent.click(remove);
        await waitFor(() => expect(stored().projects[0].siteControllers).toHaveLength(0));
    });

    it("replaces a unit and unassigns arrays on ports the new one doesn't have", async () => {
        renderAt("/p/proj_home/s/sys_house/controllers");
        await screen.findByText(/No controllers in House yet/);
        await addController(twoPort);
        const unit = await screen.findByRole("article", { name: new RegExp(twoPort.name) });
        await userEvent.selectOptions(within(unit).getByRole("combobox", { name: "Assign an array to MPPT 2" }), "South roof");
        await waitFor(() => expect(stored().projects[0].arrays[0].controllerMppt).toBe(2));

        await userEvent.click(within(unit).getByRole("button", { name: "Replace…" }));
        const picker = screen.getByRole("complementary", { name: /Replace/ });
        await userEvent.click(within(picker).getByRole("button", { name: `Use ${fullName(onePort)}` }));
        expect(await screen.findByRole("alert")).toHaveTextContent(/1 array was on a port the new unit doesn't have/);
        expect(stored().projects[0].siteControllers[0].modelId).toBe(onePort.id);
        expect(stored().projects[0].arrays[0].controllerInstanceId).toBe("");
    });

    it("filters the picker by the number of MPPT inputs", async () => {
        renderAt("/p/proj_home/s/sys_house/controllers");
        await userEvent.click((await screen.findAllByRole("button", { name: /Add a controller/ }))[0]);
        const panel = screen.getByRole("complementary", { name: /Add a controller/ });
        const listed = () => within(within(panel).getByRole("list", { name: "Controllers" })).queryAllByRole("button", { name: /^Add / }).map((b) => b.getAttribute("aria-label"));
        await userEvent.click(within(panel).getByRole("checkbox", { name: /Include ones that don't fit/ }));
        const showAll = within(panel).queryByRole("button", { name: "Show all" });
        if (showAll) await userEvent.click(showAll); // ignore the system's setup filters for this test
        await userEvent.click(within(panel).getByRole("button", { name: "2 MPPT inputs" }));
        expect(listed()).toEqual([`Add ${fullName(twoPort)}`]);
        await userEvent.click(within(panel).getByRole("button", { name: "1 MPPT input" }));
        expect(listed().sort()).toEqual([`Add ${fullName(onePort)}`, `Add ${fullName(twoPort)}`].sort());
        await userEvent.click(within(panel).getByRole("button", { name: "Any" }));
        expect(within(panel).getByRole("button", { name: "2 MPPT inputs" })).toHaveAttribute("aria-pressed", "false");
    });

    it("adds a controller for a waiting array straight onto its first port", async () => {
        renderAt("/p/proj_home/s/sys_house/controllers");
        await userEvent.click(await screen.findByRole("button", { name: "Add a controller for South roof" }));
        const picker = screen.getByRole("complementary", { name: "Add a controller for South roof" });
        await userEvent.click(within(picker).getByRole("button", { name: `Add ${fullName(onePort)}` }));
        await waitFor(() => expect(stored().projects[0].arrays[0]).toMatchObject({ controllerMppt: 1 }));
        expect(stored().projects[0].arrays[0].controllerInstanceId).toBe(stored().projects[0].siteControllers[0].id);
    });

    it("puts a panel on an array from the Library", async () => {
        renderAt("/library/panels");
        const panel = initialPanels[0];
        await userEvent.click((await screen.findAllByRole("button", { name: `Use ${panel.name} in an array` }))[0]);
        await userEvent.click(screen.getByRole("menuitem", { name: /Barn roof/ }));
        await waitFor(() => expect(stored().projects[0].arrays[1].panel).toBe(panel.model));
    });

    it("adds a controller to a system from the Library", async () => {
        renderAt("/library/controllers");
        await userEvent.click((await screen.findAllByRole("button", { name: `Add ${fullName(onePort)} to a system` }))[0]);
        await userEvent.click(screen.getByRole("menuitem", { name: "Barn" }));
        await waitFor(() => expect(stored().projects[0].siteControllers).toHaveLength(1));
        expect(stored().projects[0].siteControllers[0].systemId).toBe("sys_barn");
    });
});
