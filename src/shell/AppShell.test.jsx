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

describe("new app shell behind ?ui=next (roadmap 13.4)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
        localStorage.setItem("solar_ui", "next");
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
        const dialog = screen.getByRole("dialog", { name: "New project" });
        await userEvent.clear(within(dialog).getByRole("textbox"));
        await userEvent.type(within(dialog).getByRole("textbox"), "Shed");
        await userEvent.click(within(dialog).getByRole("button", { name: "Create project" }));
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

    it("leaves the classic UI unchanged when the flag is off", async () => {
        localStorage.setItem("solar_ui", "old");
        renderAt("/");
        expect(await screen.findByRole("button", { name: /^system summary$/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Project overview" })).not.toBeInTheDocument();
    });
});
