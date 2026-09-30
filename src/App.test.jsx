import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { seedProjectsStore } from "./test/projectFixtures";

// App UI flows only need a tiny catalogue. Rendering the full panels/controllers DB
// makes Testing Library role queries too slow for the default timeouts in CI.
vi.mock("./data/loadData.js", async (importOriginal) => {
    const actual = await importOriginal();
    const duplicatePanel = actual.initialPanels.find((p) => p.model === "TSM-430NEG9R.28") || actual.initialPanels[0];
    const otherPanel = actual.initialPanels.find((p) => p.model !== duplicatePanel.model);
    const duplicateCharger = actual.initialChargers.find((c) => c.id === "ss75_15") || actual.initialChargers[0];
    const otherCharger = actual.initialChargers.find((c) => c.id !== duplicateCharger.id);
    return { ...actual, initialPanels: [duplicatePanel, otherPanel], initialChargers: [duplicateCharger, otherCharger] };
});

import { AppStateProvider } from "./context/AppStateContext";
import App from "./App";

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

const openMore = async () => userEvent.click(await screen.findByRole("button", { name: /^More: / }));

describe("App UI flows (roadmap 13.9: the shell is the only UI)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
    });

    it("opens the chooser on a first visit", async () => {
        localStorage.clear();
        renderAt("/");
        expect(await screen.findByRole("heading", { name: "What are you building?" })).toBeInTheDocument();
    });

    it("tidies away the retired UI flag", async () => {
        localStorage.setItem("solar_ui", "old");
        localStorage.setItem("solar_hide_incompatible_controllers", "true");
        renderAt("/p/proj_home");
        await screen.findByRole("heading", { level: 1, name: "Hawthorn Cottage" });
        expect(localStorage.getItem("solar_ui")).toBeNull();
        expect(localStorage.getItem("solar_hide_incompatible_controllers")).toBeNull();
    });

    it("reaches both Library tables from the top bar", async () => {
        renderAt("/p/proj_home");
        await userEvent.click(await screen.findByRole("link", { name: "Library" }));
        expect(await screen.findByRole("heading", { name: /Solar Panels Database/i })).toBeInTheDocument();
        cleanup();
        renderAt("/library/controllers");
        expect(await screen.findByRole("heading", { name: /PV Controllers Database/i })).toBeInTheDocument();
    });

    it("shows the summary with the results disclaimer (roadmap 6.1)", async () => {
        renderAt("/p/proj_home/summary");
        expect(await screen.findByRole("heading", { name: /System Summary/i })).toBeInTheDocument();
        expect(screen.getByText(/Checks component compatibility only/i)).toBeInTheDocument();
    });

    it("routes from the How Solar Pear works guide to the array's layout and panel tabs and the controllers", async () => {
        renderAt("/learn/guide");
        expect(await screen.findByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /draw the roof/i }));
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/layout"));

        cleanup();
        renderAt("/learn/guide");
        await userEvent.click((await screen.findAllByRole("button", { name: /choose a panel/i }))[0]);
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/panel"));

        cleanup();
        renderAt("/learn/guide");
        await userEvent.click((await screen.findAllByRole("button", { name: /choose a controller/i }))[0]);
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_house/controllers"));
    });

    it("opens the methodology and About & legal pages from the menu (roadmap 6.5)", async () => {
        renderAt("/p/proj_home");
        await openMore();
        await userEvent.click(screen.getByRole("menuitem", { name: "How we check" }));
        expect(await screen.findByRole("heading", { name: /how we check compatibility/i })).toBeInTheDocument();
        expect(screen.getByText("Controller maximum voltage")).toBeInTheDocument();

        await openMore();
        await userEvent.click(screen.getByRole("menuitem", { name: /About, disclosures and privacy/ }));
        for (const heading of [/^Disclaimer$/, /^Affiliate links$/, /^Privacy$/, /^Terms of use$/]) {
            expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
        }
    });

    it("shows the Guide to panels and the Guide to controllers under Learn", async () => {
        renderAt("/learn/panels");
        for (const tech of [/^PERC$/, /^TOPCon$/, /^HJT$/, /^Back-contact$/]) {
            expect(await screen.findByRole("heading", { name: tech })).toBeInTheDocument();
        }
        expect(screen.queryByRole("heading", { name: /architecture unspecified/i })).not.toBeInTheDocument();
        for (const topic of [/Why you might want thicker or thinner glass/i, /Optimisers and module-level electronics/i]) {
            expect(screen.getByRole("heading", { name: topic })).toBeInTheDocument();
        }
        await userEvent.click(screen.getByRole("button", { name: /See the three compatibility checks/i }));
        expect(await screen.findByRole("heading", { name: /The three checks that decide compatibility/i })).toBeInTheDocument();

        cleanup();
        renderAt("/learn/controllers");
        expect(await screen.findByRole("heading", { name: /PWM and MPPT/i })).toBeInTheDocument();
    });

    it("asks before resetting everything; Cancel keeps the design", async () => {
        renderAt("/p/proj_home");
        await openMore();
        await userEvent.click(screen.getByRole("menuitem", { name: /Reset everything/ }));
        expect(await screen.findByRole("heading", { name: /Reset Application/i })).toBeInTheDocument();
        expect(screen.getByText(/permanently lost/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
        await waitFor(() => expect(screen.queryByRole("heading", { name: /Reset Application/i })).not.toBeInTheDocument());
        expect(JSON.parse(localStorage.getItem("solar_projects")).projects[0].name).toBe("Hawthorn Cottage");
    });

    it("edits an array and a system from the sidebar pencils", async () => {
        const user = userEvent.setup();
        renderAt("/p/proj_home/s/sys_house");
        await user.click(await screen.findByRole("button", { name: /Edit array South roof/i }));
        expect(screen.getByRole("heading", { name: /Edit Physical Array/i })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /^Cancel$/ }));

        await user.click(screen.getByRole("button", { name: /Rename or delete system House/i }));
        const dialog = screen.getByRole("dialog", { name: /Edit System/i });
        const input = within(dialog).getByPlaceholderText(/outbuilding/i);
        await user.click(input);
        await user.keyboard("xyz");
        expect(input).toHaveValue("Housexyz");
        expect(document.activeElement).toBe(input);
    });

    it("won't add a custom panel or controller whose model ID already exists", async () => {
        renderAt("/library/panels");
        await userEvent.click(await screen.findByRole("button", { name: /add panel/i }));
        let dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/Model ID \(Unique\)/i), { target: { value: "TSM-430NEG9R.28" } });
        expect(screen.getByRole("button", { name: /Add Panel to Database/i })).toBeDisabled();

        cleanup();
        renderAt("/library/controllers");
        await userEvent.click((await screen.findAllByRole("button", { name: /add controller/i })).at(-1));
        dialog = await screen.findByRole("dialog", { name: /Add Custom PV Controller/i });
        fireEvent.change(within(dialog).getByLabelText(/Model ID \(Unique\)/i), { target: { value: "ss75_15" } });
        expect(within(dialog).getByRole("button", { name: /Add Controller to Database/i })).toBeDisabled();
    });
});
