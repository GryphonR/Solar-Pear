import React from "react";
import ReactDOM from "react-dom/client";
import { AppStateProvider } from "./context/AppStateContext";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <AppStateProvider>
            <App />
        </AppStateProvider>
    </React.StrictMode>
);
