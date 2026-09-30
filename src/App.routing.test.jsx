import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { seedProjectsStore } from "./test/projectFixtures";

// Tiny catalogue, as in App.test.jsx: routing doesn't need the full database.
vi.mock("./data/loadData.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        initialPanels: actual.initialPanels.slice(0, 2),
        initialChargers: actual.initialChargers.slice(0, 2),
    };
});

import { AppStateProvider } from "./context/AppStateContext";
import App from "./App";

let location;
let navigate;
function Probe() {
    location = useLocation();
    navigate = useNavigate();
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

const activeProjectId = () => JSON.parse(localStorage.getItem("solar_projects")).activeProjectId;

describe("URL routing (roadmap 13.3)", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
    });

    it("opens a deep link to the controllers library", async () => {
        renderAt("/library/controllers");
        expect(await screen.findByRole("heading", { name: /PV Controllers Database/i })).toBeInTheDocument();
    });

    it("opens a deep link to an array tab", async () => {
        renderAt("/p/proj_home/s/sys_barn/a/A2/layout");
        expect(await screen.findByRole("heading", { name: /^Barn roof$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Layout$/ })).toHaveClass("border-blue-600");
    });

    it("switches to the project named in the URL", async () => {
        renderAt("/p/proj_van/s/sys_van/a/V1/overview");
        expect(await screen.findByRole("heading", { name: /^Van roof$/i })).toBeInTheDocument();
        await waitFor(() => expect(activeProjectId()).toBe("proj_van"));
    });

    it("updates the URL on navigation and supports Back and Forward", async () => {
        renderAt("/");
        await userEvent.click(await screen.findByRole("button", { name: /^panels$/i }));
        expect(location.pathname).toBe("/library/panels");

        await userEvent.click(screen.getByRole("button", { name: /^South roof$/ }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/overview");
        await userEvent.click(screen.getByRole("button", { name: /^Panel Selector$/ }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/panel");

        act(() => navigate(-1));
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/overview"));
        act(() => navigate(-1));
        await waitFor(() => expect(location.pathname).toBe("/library/panels"));
        expect(screen.getByRole("heading", { name: /Solar Panels Database/i })).toBeInTheDocument();
        act(() => navigate(1));
        await waitFor(() => expect(screen.getByRole("heading", { name: /^South roof$/i })).toBeInTheDocument());
    });

    it("reopens an array on the tab the user last used", async () => {
        renderAt("/p/proj_home/s/sys_house/a/A1/panel");
        await screen.findByRole("heading", { name: /^South roof$/i });
        await userEvent.click(screen.getByRole("button", { name: /^system summary$/i }));
        expect(location.pathname).toBe("/p/proj_home/summary");
        await userEvent.click(screen.getByRole("button", { name: /^South roof$/ }));
        expect(location.pathname).toBe("/p/proj_home/s/sys_house/a/A1/panel");
    });

    it("replaces stale and unknown URLs with the canonical one", async () => {
        renderAt("/p/proj_home/s/sys_house/a/A2/layout");
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_barn/a/A2/layout"));

        act(() => navigate("/p/proj_home/s/sys_barn/a/deleted/overview"));
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home/s/sys_barn"));
        expect(screen.getByRole("heading", { name: /System Summary/i })).toBeInTheDocument();

        act(() => navigate("/p/nobody/summary"));
        await waitFor(() => expect(location.pathname).toBe("/p/proj_home"));
    });

    it("links About & legal sections by hash", async () => {
        renderAt("/");
        await userEvent.click(await screen.findByRole("button", { name: /^Privacy$/ }));
        expect(location.pathname).toBe("/about");
        expect(location.hash).toBe("#privacy");
    });
});
