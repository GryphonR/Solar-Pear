import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { seedProjectsStore } from "../test/projectFixtures";

// A few ordinary panels keep the layout search quick.
vi.mock("../data/loadData.js", async (importOriginal) => {
    const actual = await importOriginal();
    const panels = actual.initialPanels.filter((p) => p.active !== false && !p.flexible && Number(p.height) > 1500 && Number(p.height) < 2000).slice(0, 3);
    return { ...actual, initialPanels: panels };
});

let small = false;
vi.mock("../hooks/useIsSmallScreen", () => ({ MIN_DESKTOP_LAYOUT_WIDTH: 960, useIsSmallScreen: () => small }));

import { AppStateProvider } from "../context/AppStateContext";
import App from "../App";
import LayoutPlanner from "./planner/LayoutPlanner";

function renderAt(path) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AppStateProvider>
                <App />
            </AppStateProvider>
        </MemoryRouter>
    );
}

const stored = () => JSON.parse(localStorage.getItem("solar_projects"));
const southRoof = () => stored().projects[0].arrays.find((a) => a.id === "A1");
const LAYOUT = "/p/proj_home/s/sys_house/a/A1/layout";

async function describeRoof(user) {
    const start = await screen.findByRole("button", { name: "Add the width to continue" });
    expect(start).toBeDisabled();
    await user.type(screen.getByLabelText("Width in metres"), "6");
    await user.type(screen.getByLabelText("Length up the slope in metres"), "4.2");
    await user.click(screen.getByRole("button", { name: "See which panels fit" }));
    return screen.findByText("IF YOU USE THIS LAYOUT");
}

describe("layout planner (roadmap 13.8)", () => {
    beforeEach(() => {
        small = false;
        localStorage.clear();
        localStorage.setItem("solar_projects", JSON.stringify(seedProjectsStore()));
        localStorage.setItem("solar_ui", "next");
    });

    it("starts from three measurements and previews without changing the design", async () => {
        const user = userEvent.setup();
        renderAt(LAYOUT);
        await describeRoof(user);

        // Layouts are grouped by grid; the first group is open with its best panel previewed.
        const layouts = screen.getByRole("list", { name: "Layouts" });
        const group = within(layouts).getAllByRole("button", { expanded: true })[0];
        expect(group).toHaveTextContent(/^\d+ panels · (portrait|landscape)/);
        expect(group).toHaveTextContent(/Panels [\d,–]+ × [\d,–]+ mm · \d+ panels? fits?/);
        expect(group).toHaveTextContent("Previewing");
        const panels = within(layouts).getByRole("list", { name: /^Panels for / });
        expect(within(panels).getAllByRole("button", { pressed: true })).toHaveLength(1);
        expect(screen.getByText(/^Not checked: the array has no controller yet/)).toBeInTheDocument();
        // The drawing is saved, the layout isn't.
        await waitFor(() => expect(southRoof().planner?.roofPolygon).toHaveLength(4));
        expect(southRoof()).toMatchObject({ count: 1, panel: "" });
    });

    it("leaves a slot empty, applies the layout, and undoes it from the toast", async () => {
        const user = userEvent.setup();
        renderAt(LAYOUT);
        await describeRoof(user);

        const slots = screen.getAllByRole("button", { name: /Leave this slot empty$/ });
        await user.click(slots[0]);
        expect(await screen.findByText("(1 left empty)")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Put a panel back$/ })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Use this layout" }));
        await waitFor(() => expect(southRoof().count).toBe(slots.length - 1));
        expect(southRoof().panel).not.toBe("");
        await waitFor(() => expect(southRoof().planner.applied.rects_m).toHaveLength(slots.length - 1));
        expect(screen.getByText(/^Applied now: /)).toBeInTheDocument();

        await user.click(screen.getByText("Undo", { selector: "button" }));
        await waitFor(() => expect(southRoof()).toMatchObject({ count: 1, panel: "" }));
    });

    it("undoes and redoes drawing changes", async () => {
        const user = userEvent.setup();
        renderAt(LAYOUT);
        await describeRoof(user);

        const width = screen.getByLabelText("Roof width in metres");
        await user.clear(width);
        await user.type(width, "8{Enter}");
        await waitFor(() => expect(screen.getByLabelText(/^Roof drawing: 8\.00 m wide/)).toBeInTheDocument());
        await user.click(screen.getByRole("button", { name: "Undo" }));
        expect(screen.getByLabelText(/^Roof drawing: 6\.00 m wide/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Redo" }));
        expect(screen.getByLabelText(/^Roof drawing: 8\.00 m wide/)).toBeInTheDocument();
    });

    it("sets the panel count by hand from the skip link", async () => {
        const user = userEvent.setup();
        renderAt(LAYOUT);
        await user.click(await screen.findByRole("button", { name: "Skip, I know how many panels" }));
        const count = screen.getByLabelText("Number of panels");
        await user.clear(count);
        await user.type(count, "9");
        await user.click(screen.getByRole("button", { name: "Save panel count" }));
        await waitFor(() => expect(southRoof().count).toBe(9));
        expect(southRoof().planner).toBeFalsy();
    });

    it("shows the roof view only on a phone", async () => {
        small = true;
        const store = seedProjectsStore();
        store.projects[0].arrays[0].planner = {
            roofInput: { mode: "actual", x_m: 6, y_m: 4 },
            roofPolygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4 },
                { x: 0, y: 4 },
            ],
            applied: { id: "x_portrait", rects_m: [{ x: 0.3, y: 0.3, w: 1.1, h: 1.7 }], emptyRects: [] },
        };
        localStorage.setItem("solar_projects", JSON.stringify(store));
        render(
            <MemoryRouter initialEntries={[LAYOUT]}>
                <AppStateProvider>
                    <LayoutPlanner arrayId="A1" />
                </AppStateProvider>
            </MemoryRouter>
        );
        expect(await screen.findByRole("img", { name: /^Roof drawing: 6\.00 m wide.*1 panel$/ })).toBeInTheDocument();
        expect(screen.getByText("1 panel on this roof")).toBeInTheDocument();
        expect(screen.getByText(/needs a larger screen/)).toBeInTheDocument();
        expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Leave this slot empty$/ })).not.toBeInTheDocument();
    });
});
