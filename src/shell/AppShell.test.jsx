import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { seedProjectsStore } from "../test/projectFixtures";

vi.mock("../data/loadData.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        initialPanels: actual.initialPanels.slice(0, 2),
        initialChargers: actual.initialChargers.slice(0, 2),
    };
});

import { AppStateProvider } from "../context/AppStateContext";
import App from "../App";

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

const sidebar = () => screen.getByRole("navigation", { name: "Project" });

describe("app shell (roadmap 13.4)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
    });

    it("opens the active project from / and shows its systems and what is left to do", async () => {
        renderAt("/");
        expect(await screen.findByRole("heading", { level: 1, name: "Hawthorn Cottage" })).toBeInTheDocument();
        expect(location.pathname).toBe("/p/proj_home");
        const toResolve = screen.getByRole("region", { name: "To resolve" });
        expect(within(toResolve).getByText(/House › South roof:/)).toBeInTheDocument();
        expect(within(toResolve).getAllByText(/choose a panel and a controller/)).toHaveLength(2);
        // Unfinished arrays are "not set", never OK.
        expect(within(sidebar()).getAllByText("1 to finish")).toHaveLength(2);
    });

    it("reaches systems and arrays through the sidebar tree, with a breadcrumb", async () => {
        renderAt("/p/proj_home");
        await userEvent.click(await within(sidebar()).findByRole("link", { name: /^Barn/ }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_barn");
        await userEvent.click(within(sidebar()).getByRole("link", { name: /Barn roof/ }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_barn/a/A2/overview");
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        expect(within(crumbs).getByRole("link", { name: "Hawthorn Cottage" })).toHaveAttribute("href", "/p/proj_home");
        expect(within(crumbs).getByRole("link", { name: "Barn" })).toHaveAttribute("href", "/p/proj_home/s/sys_barn");
        expect(screen.getByRole("heading", { name: /^Barn roof$/ })).toBeInTheDocument();
    });

    it("reaches the catalogue as Library and the guides as Learn", async () => {
        renderAt("/p/proj_home");
        await userEvent.click(await screen.findByRole("link", { name: "Library" }));
        expect(screen.getByRole("heading", { name: /Solar Panels Database/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("tab", { name: "Controllers" }));
        expect(screen.getByRole("heading", { name: /PV Controllers Database/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("link", { name: "Learn" }));
        await userEvent.click(screen.getByRole("link", { name: /How we check compatibility/ }));
        expect(location.pathname).toBe("/learn/methodology");
        expect(screen.getByRole("heading", { name: /how we check compatibility/i })).toBeInTheDocument();
    });

    it("creates, switches and deletes projects from the project switcher", async () => {
        renderAt("/p/proj_home");
        const switcher = await screen.findByRole("button", { name: /Hawthorn Cottage/ });
        await userEvent.click(switcher);
        await userEvent.click(screen.getByRole("menuitem", { name: "New project" }));
        // New project opens the chooser (13.5); a blank start keeps the typed name.
        const name = await screen.findByRole("textbox", { name: "Project name" });
        await userEvent.clear(name);
        await userEvent.type(name, "Shed");
        await userEvent.click(screen.getByRole("radio", { name: /Blank system/ }));
        await userEvent.click(screen.getByRole("button", { name: "Start design: Blank system" }));
        expect(await screen.findByRole("heading", { level: 1, name: "Shed" })).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /Shed/ }));
        await userEvent.click(screen.getByRole("menuitemradio", { name: /Van/ }));
        await waitFor(() => expect(location.pathname).toBe("/p/proj_van"));
        expect(screen.getByRole("heading", { level: 1, name: "Van" })).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /^Van/ }));
        await userEvent.click(screen.getByRole("menuitem", { name: /Delete project/ }));
        await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
        await waitFor(() => expect(JSON.parse(localStorage.getItem("solar_projects")).projects.map((p) => p.name)).not.toContain("Van"));
        expect(location.pathname).not.toBe("/p/proj_van");
    });

    it("goes back to the chooser after deleting the last project", async () => {
        const store = JSON.parse(localStorage.getItem("solar_projects"));
        store.projects = store.projects.filter((p) => p.id === "proj_home");
        localStorage.setItem("solar_projects", JSON.stringify(store));
        renderAt("/p/proj_home");
        await userEvent.click(await screen.findByRole("button", { name: /Hawthorn Cottage/ }));
        await userEvent.click(screen.getByRole("menuitem", { name: /Delete project/ }));
        await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
        expect(await screen.findByRole("heading", { name: "What are you building?" })).toBeInTheDocument();
        expect(location.pathname).toBe("/");
        // Choosing replaces the fresh starter project rather than adding a second one.
        await userEvent.click(screen.getByRole("radio", { name: /Van, boat or caravan/ }));
        await userEvent.click(screen.getByRole("button", { name: /^Start design/ }));
        await waitFor(() => expect(JSON.parse(localStorage.getItem("solar_projects")).projects).toHaveLength(1));
    });
});
