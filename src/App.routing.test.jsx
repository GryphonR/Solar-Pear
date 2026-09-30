import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router";

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

describe("URL routing (roadmap 13.3)", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("opens a deep link to the controllers library", async () => {
        renderAt("/library/controllers");
        expect(await screen.findByRole("heading", { name: /PV Controllers Database/i })).toBeInTheDocument();
    });

    it("opens a deep link to an array tab", async () => {
        renderAt("/p/local/s/House/a/A1/layout");
        expect(await screen.findByRole("heading", { name: /^Array 1$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Layout$/ })).toHaveClass("border-blue-600");
    });

    it("updates the URL on navigation and supports Back and Forward", async () => {
        renderAt("/");
        await userEvent.click(await screen.findByRole("button", { name: /^panels$/i }));
        expect(location.pathname).toBe("/library/panels");

        await userEvent.click(screen.getByRole("button", { name: /^Array 1$/ }));
        expect(location.pathname).toBe("/p/local/s/House/a/A1/overview");
        await userEvent.click(screen.getByRole("button", { name: /^Panel Selector$/ }));
        expect(location.pathname).toBe("/p/local/s/House/a/A1/panel");

        act(() => navigate(-1));
        await waitFor(() => expect(location.pathname).toBe("/p/local/s/House/a/A1/overview"));
        act(() => navigate(-1));
        await waitFor(() => expect(location.pathname).toBe("/library/panels"));
        expect(screen.getByRole("heading", { name: /Solar Panels Database/i })).toBeInTheDocument();
        act(() => navigate(1));
        await waitFor(() => expect(screen.getByRole("heading", { name: /^Array 1$/i })).toBeInTheDocument());
    });

    it("reopens an array on the tab the user last used", async () => {
        renderAt("/p/local/s/House/a/A1/panel");
        await screen.findByRole("heading", { name: /^Array 1$/i });
        await userEvent.click(screen.getByRole("button", { name: /^system summary$/i }));
        await userEvent.click(screen.getByRole("button", { name: /^Array 1$/ }));
        expect(location.pathname).toBe("/p/local/s/House/a/A1/panel");
    });

    it("replaces stale and unknown URLs with the canonical one", async () => {
        renderAt("/p/local/s/Old%20area/a/A1/layout");
        await waitFor(() => expect(location.pathname).toBe("/p/local/s/House/a/A1/layout"));

        act(() => navigate("/p/local/s/House/a/deleted/overview"));
        await waitFor(() => expect(location.pathname).toBe("/p/local/summary"));
        expect(screen.getByRole("heading", { name: /System Summary/i })).toBeInTheDocument();
    });

    it("links About & legal sections by hash", async () => {
        renderAt("/");
        await userEvent.click(await screen.findByRole("button", { name: /^Privacy$/ }));
        expect(location.pathname).toBe("/about");
        expect(location.hash).toBe("#privacy");
    });
});
