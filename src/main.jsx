import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppStateProvider } from "./context/AppStateContext";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        {/* History URLs (roadmap 13.3). GitHub Pages serves 404.html, a copy of index.html, for deep links. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppStateProvider>
                <App />
            </AppStateProvider>
        </BrowserRouter>
    </React.StrictMode>
);
