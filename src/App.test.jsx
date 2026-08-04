import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateProvider } from "./context/AppStateContext";
import App from "./App";

function renderApp() {
    return render(
        <AppStateProvider>
            <App />
        </AppStateProvider>
    );
}

function clearAppStorage() {
    const keys = [
        "user_notes",
        "solar_arrays",
        "solar_site_controllers",
        // Legacy migration key (read-only for app, but cleared for isolation).
        "solar_selections",
        "solar_chargers",
        "solar_panels",
        "solar_hide_heavy_panels",
        "solar_hide_marginal_panels",
        "solar_system_voltage",
        "solar_system_type",
        "solar_filter_eps",
        "solar_filter_house_backup",
        "solar_areas",
    ];
    keys.forEach((k) => localStorage.removeItem(k));
}

describe("App UI flows", () => {
    beforeEach(() => {
        clearAppStorage();
    });

    it("renders without crashing and shows Guide by default", async () => {
        renderApp();
        await waitFor(() => {
            expect(
                screen.getByText(/Free roofspace, panel, and controller matching/i)
            ).toBeInTheDocument();
        });
    });

    it("navigates to PV Controllers and shows controllers database", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /pv controllers/i })
        );
        expect(
            screen.getByRole("heading", { name: /PV Controllers Database/i })
        ).toBeInTheDocument();
    });

    it("navigates to Panels and shows panels database", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /^panels$/i }));
        expect(
            screen.getByRole("heading", { name: /Solar Panels Database/i })
        ).toBeInTheDocument();
    });

    it("navigates to System Summary and shows summary view", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        // Exact match: the Guide also offers a shortcut to the summary, so a loose
        // pattern would match both that and the sidebar button.
        await userEvent.click(
            screen.getByRole("button", { name: /^system summary$/i })
        );
        expect(
            screen.getByRole("heading", { name: /System Summary/i })
        ).toBeInTheDocument();
    });

    it("Guide roof route opens the Layout tab of the seeded array", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /draw the roof/i }));

        expect(screen.getByRole("heading", { name: /^Array 1$/i })).toBeInTheDocument();
        // The planner stays mounted while hidden, so assert the Layout tab is the selected one
        // rather than merely that planner markup exists.
        expect(screen.getByRole("button", { name: /^Layout$/ })).toHaveClass("border-blue-600");
    });

    it("Guide panel route opens the Panel Selector tab of the seeded array", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /choose a panel/i }));

        expect(
            screen.getByRole("heading", { name: /Compatible Panels Explorer/i })
        ).toBeInTheDocument();
    });

    it("Guide controller route opens the Controller Selector tab of the seeded array", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /choose a controller/i }));

        expect(
            screen.getByRole("heading", { name: /Add New PV Controller from Database/i })
        ).toBeInTheDocument();
    });

    it("Guide progress pills show panel and controller outstanding on a fresh project", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        // Nothing is selected on a fresh project, so the pills carry no chosen-item detail.
        expect(screen.getByRole("button", { name: /^Panel$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Controller$/i })).toBeInTheDocument();
    });

    it("navigates from the sidebar to the Guide to Panels page", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /^Guide to Panels$/i }));

        expect(
            screen.getByRole("heading", { name: /^Guide to panels$/i })
        ).toBeInTheDocument();
        // Each cell architecture the page explains should have its own card.
        for (const tech of [/^PERC$/, /^TOPCon$/, /^HJT$/, /^Back-contact$/]) {
            expect(screen.getByRole("heading", { name: tech })).toBeInTheDocument();
        }
        // Doping alone is not an architecture, so it must not appear as a group.
        expect(
            screen.queryByRole("heading", { name: /architecture unspecified/i })
        ).not.toBeInTheDocument();
        // Panel-adjacent topics the page also covers.
        for (const topic of [
            /Why you might want thicker or thinner glass/i,
            /Optimisers and module-level electronics/i,
        ]) {
            expect(screen.getByRole("heading", { name: topic })).toBeInTheDocument();
        }
    });

    it("navigates from the sidebar to the Guide to Controllers page", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /^Guide to Controllers$/i }));

        expect(
            screen.getByRole("heading", { name: /^Guide to controllers$/i })
        ).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /PWM and MPPT/i })).toBeInTheDocument();
    });

    it("reaches the panels guide from the main Guide page and back again", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        // The launchpad card and the sidebar entry share a name, so scope to the card's wording.
        await userEvent.click(
            screen.getByRole("button", { name: /Guide to panels Mono and poly/i })
        );
        expect(screen.getByRole("heading", { name: /^Guide to panels$/i })).toBeInTheDocument();

        // And the page offers a route back to the compatibility explainer.
        await userEvent.click(
            screen.getByRole("button", { name: /See the three compatibility checks/i })
        );
        expect(
            screen.getByRole("heading", { name: /The three checks that decide compatibility/i })
        ).toBeInTheDocument();
    });

    it(
        "opens Add Panel modal from Panels tab and shows form",
        async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /^panels$/i }));
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: /Solar Panels Database/i })
            ).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /add panel/i })
        );
        expect(
            screen.getByRole("heading", { name: /Add Custom Solar Panel/i })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /Add Panel to Database/i })
        ).toBeInTheDocument();
        },
        10000
    );

    it("opens Confirm modal on Reset click; Cancel closes it", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        const resetButton = screen.getByTitle(
            /reset all settings to factory defaults/i
        );
        await userEvent.click(resetButton);

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: /Reset Application/i })
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(/permanently lost/i)
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
        await waitFor(() => {
            expect(
                screen.queryByRole("heading", { name: /Reset Application/i })
            ).not.toBeInTheDocument();
        });
    });

    it("opens Add Array modal from sidebar area action", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        const addArrayButton = screen.getByRole("button", {
            name: /add array/i,
        });
        await userEvent.click(addArrayButton);

        expect(
            screen.getByRole("heading", { name: /Add Physical Array/i })
        ).toBeInTheDocument();
    });

    it("opens Edit Array modal from sidebar array edit action", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /edit array array 1/i })
        );

        expect(
            screen.getByRole("heading", { name: /Edit Physical Array/i })
        ).toBeInTheDocument();
    });

    it("opens Edit Area modal from sidebar area edit action", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /edit area house/i })
        );

        expect(
            screen.getByRole("heading", { name: /Edit Area/i })
        ).toBeInTheDocument();
    });

    it("keeps focus on area name input while typing in Edit Area modal", async () => {
        const user = userEvent.setup();
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /edit area house/i }));
        const dialog = screen.getByRole("dialog", { name: /Edit Area/i });
        const input = within(dialog).getByPlaceholderText(/outbuilding/i);
        await user.click(input);
        await user.keyboard("xyz");
        expect(input).toHaveValue("Housexyz");
        expect(document.activeElement).toBe(input);
    });

    it(
        "prevents submit when adding a panel with duplicate Model ID and keeps modal open",
        async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /^panels$/i }));
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /Solar Panels Database/i })).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole("button", { name: /add panel/i }));
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /Add Custom Solar Panel/i })).toBeInTheDocument();
        });

        const dialog = screen.getByRole("dialog");
        const modelIdInput = within(dialog).getByLabelText(/Model ID \(Unique\)/i);
        fireEvent.change(modelIdInput, { target: { value: "TSM-430NEG9R.28" } });

        const addButton = screen.getByRole("button", { name: /Add Panel to Database/i });
        expect(addButton).toBeDisabled();
        expect(screen.getByRole("heading", { name: /Add Custom Solar Panel/i })).toBeInTheDocument();
        },
        10000
    );

    it(
        "prevents submit when adding a controller with duplicate Model ID and keeps modal open",
        async () => {
            renderApp();
            await waitFor(() => {
                expect(screen.getByText(/Free roofspace, panel, and controller matching/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole("button", { name: /pv controllers/i }));
            await waitFor(() => {
                expect(screen.getByRole("heading", { name: /PV Controllers Database/i })).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole("button", { name: /add controller/i }));
            await waitFor(() => {
                expect(screen.getByRole("heading", { name: /Add Custom PV Controller/i })).toBeInTheDocument();
            });

            const dialog = screen.getByRole("dialog");
            const modelIdInput = within(dialog).getByLabelText(/Model ID \(Unique\)/i);
            fireEvent.change(modelIdInput, { target: { value: "ss75_15" } });

            const addButton = screen.getByRole("button", { name: /Add Controller to Database/i });
            expect(addButton).toBeDisabled();
            expect(screen.getByRole("heading", { name: /Add Custom PV Controller/i })).toBeInTheDocument();
        },
        20000
    );
});
