import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
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

const stored = () => JSON.parse(localStorage.getItem("solar_projects"));

describe("first run and the chooser (roadmap 13.5)", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("opens the chooser on first run and sets up a system from the preset", async () => {
        renderAt("/");
        expect(await screen.findByRole("heading", { name: "What are you building?" })).toBeInTheDocument();
        // No plug-in tile (D11).
        expect(screen.queryByText(/plug-in|balcony/i)).not.toBeInTheDocument();
        const start = screen.getByRole("button", { name: /to start$/ });
        expect(start).toBeDisabled();
        await userEvent.click(screen.getByRole("radio", { name: /House with battery/ }));
        expect(location.pathname).toBe("/"); // choosing a tile only selects it
        await userEvent.click(screen.getByRole("button", { name: /^Start design: House with battery/ }));

        await waitFor(() => expect(location.pathname).toMatch(/^\/p\/proj_[0-9a-f]+\/s\/sys_[0-9a-f]+$/));
        expect(screen.getByRole("heading", { level: 1, name: "House" })).toBeInTheDocument();
        const store = stored();
        expect(store.projects).toHaveLength(1); // replaces the untouched starter project
        expect(store.projects[0].systems[0].settings).toMatchObject({
            installType: "static",
            gridMode: "hybrid",
            systemType: "grid-connected",
            systemVoltage: 48,
        });
    });

    it("can be skipped, keeping the name typed", async () => {
        renderAt("/");
        const input = await screen.findByRole("textbox", { name: "Project name" });
        await userEvent.clear(input);
        await userEvent.type(input, "Allotment");
        await userEvent.click(screen.getByRole("radio", { name: /Blank system/ }));
        await userEvent.click(screen.getByRole("button", { name: "Start design: Blank system" }));
        expect(await screen.findByRole("heading", { level: 1, name: "Allotment" })).toBeInTheDocument();
    });

    it("sends returning users to their last project, and New project to the chooser", async () => {
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
        renderAt("/");
        expect(await screen.findByRole("heading", { level: 1, name: "Hawthorn Cottage" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Hawthorn Cottage/ }));
        await userEvent.click(screen.getByRole("menuitem", { name: "New project" }));
        expect(location.pathname).toBe("/new");
        await userEvent.click(screen.getByRole("radio", { name: /Van, boat or caravan/ }));
        await userEvent.click(screen.getByRole("button", { name: /^Start design/ }));
        await waitFor(() => expect(stored().projects).toHaveLength(3));
        expect(stored().projects[2].systems[0]).toMatchObject({ name: "Van", settings: { systemVoltage: 12, systemType: "dc-charger" } });
    });
});

describe("System Setup (roadmap 13.5)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
    });

    it("edits the system's settings, reports the re-check and can undo", async () => {
        renderAt("/p/proj_home/s/sys_house/setup");
        const low = await screen.findByRole("spinbutton", { name: "Design low in degrees Celsius" });
        fireEvent.change(low, { target: { value: "-12" } });
        fireEvent.blur(low);

        const toast = await screen.findByRole("alert");
        expect(toast).toHaveTextContent("Design low set to -12 °C. No arrays to re-check yet.");
        expect(stored().projects[0].systems[0].settings.designLowC).toBe(-12);
        expect(screen.getByText("OVERRIDDEN")).toBeInTheDocument();

        await userEvent.click(within(toast).getByRole("button", { name: "Undo" }));
        await waitFor(() => expect(stored().projects[0].systems[0].settings.designLowC).toBe(-10));

        await userEvent.click(screen.getByRole("radio", { name: "24 V" }));
        await waitFor(() => expect(stored().projects[0].systems[0].settings.systemVoltage).toBe(24));
        // Other systems keep their own values.
        expect(stored().projects[0].systems[1].settings.systemVoltage ?? null).toBeNull();
    });

    it("only shows system settings on the array page, with a link to Setup", async () => {
        renderAt("/p/proj_home/s/sys_house/a/A1/overview");
        const summary = await screen.findByTestId("system-settings-summary");
        expect(within(summary).getByRole("link", { name: "Edit in System Setup" })).toHaveAttribute(
            "href",
            "/p/proj_home/s/sys_house/setup"
        );
        expect(screen.queryByTestId("design-conditions")).not.toBeInTheDocument();
        expect(screen.queryByRole("spinbutton", { name: /Coldest cell temperature/ })).not.toBeInTheDocument();
    });

    it("copies the project's default temperatures into new systems", async () => {
        renderAt("/p/proj_home");
        const defaults = await screen.findByRole("region", { name: "Project defaults" });
        await userEvent.click(within(defaults).getByRole("button", { name: "Edit" }));
        const low = within(defaults).getByRole("spinbutton", { name: /Design low/ });
        await userEvent.clear(low);
        await userEvent.type(low, "-15");
        await userEvent.click(within(defaults).getByRole("button", { name: "Save defaults" }));
        await waitFor(() => expect(stored().projects[0].defaults).toMatchObject({ designLowC: -15 }));

        await userEvent.click(within(screen.getByRole("navigation", { name: "Project" })).getByRole("button", { name: "Add system" }));
        await userEvent.type(screen.getByPlaceholderText(/Outbuilding/), "Workshop");
        await userEvent.click(screen.getByRole("button", { name: "Save System" }));
        await waitFor(() => expect(stored().projects[0].systems).toHaveLength(3));
        expect(stored().projects[0].systems[2].settings.designLowC).toBe(-15);
        // Existing systems keep theirs.
        expect(stored().projects[0].systems[0].settings.designLowC ?? -10).toBe(-10);
    });
});
