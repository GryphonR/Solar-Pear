import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppStateProvider } from "./context/AppStateContext";
import App from "./App.jsx";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./index.css";

// In development, `?kit` shows the component gallery (roadmap 13.1); it isn't part of the production app.
const DesignKit = import.meta.env.DEV && new URLSearchParams(window.location.search).has("kit") ? React.lazy(() => import("./views/DesignKit.jsx")) : null;

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        {/* History URLs (roadmap 13.3). GitHub Pages serves 404.html, a copy of index.html, for deep links. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            {DesignKit ? (
                <React.Suspense fallback={null}>
                    <DesignKit />
                </React.Suspense>
            ) : (
                <AppStateProvider>
                    <App />
                </AppStateProvider>
            )}
        </BrowserRouter>
    </React.StrictMode>
);
