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
                screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)
            ).toBeInTheDocument();
        });
    });

    it("navigates to Array Config and shows array configuration view", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /array config/i })
        );
        expect(
            screen.getByRole("heading", { name: /Array Configuration & Areas/i })
        ).toBeInTheDocument();
    });

    it("navigates to PV Controllers and shows controllers database", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
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
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /^panels$/i }));
        expect(
            screen.getByRole("heading", { name: /Solar Panels Database/i })
        ).toBeInTheDocument();
    });

    it("navigates to System Summary and shows summary view", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /system summary/i })
        );
        expect(
            screen.getByRole("heading", { name: /System Summary/i })
        ).toBeInTheDocument();
    });

    it(
        "opens Add Panel modal from Panels tab and shows form",
        async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
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
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
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

    it("opens Add Array modal from Array Config tab", async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole("button", { name: /array config/i })
        );
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: /Array Configuration & Areas/i })
            ).toBeInTheDocument();
        });

        const addArrayButton = screen.getByRole("button", {
            name: /add array/i,
        });
        await userEvent.click(addArrayButton);

        expect(
            screen.getByRole("heading", { name: /Add Physical Array/i })
        ).toBeInTheDocument();
    });

    it(
        "prevents submit when adding a panel with duplicate Model ID and keeps modal open",
        async () => {
        renderApp();
        await waitFor(() => {
            expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
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
                expect(screen.getByText(/Intelligent Pairing for roofs, panels, and controllers/i)).toBeInTheDocument();
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
        10000
    );
});
