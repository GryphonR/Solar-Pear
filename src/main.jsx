import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppStateProvider } from "./context/AppStateContext";
import App from "./App.jsx";
import DesignKit from "./views/DesignKit.jsx";
import { getUiMode } from "./lib/uiFlag";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./index.css";

// `?ui=kit` shows the UX overhaul component gallery (roadmap 13.1). Everything else is the app.
const kit = getUiMode() === "kit";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        {/* History URLs (roadmap 13.3). GitHub Pages serves 404.html, a copy of index.html, for deep links. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            {kit ? (
                <DesignKit />
            ) : (
                <AppStateProvider>
                    <App />
                </AppStateProvider>
            )}
        </BrowserRouter>
    </React.StrictMode>
);
