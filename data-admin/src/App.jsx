import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import SchemaPage from "./pages/SchemaPage.jsx";
import BrowsePanels from "./pages/BrowsePanels.jsx";
import BrowseControllers from "./pages/BrowseControllers.jsx";
import LogsPage from "./pages/LogsPage.jsx";
import SerperPage from "./pages/SerperPage.jsx";

function NavItem({ to, children }) {
    return (
        <NavLink to={to} className={({ isActive }) => (isActive ? "active" : "")}>
            {children}
        </NavLink>
    );
}

export default function App() {
    return (
        <div className="layout">
            <nav className="sidebar">
                <h1>Data admin</h1>
                <NavItem to="/">Dashboard</NavItem>
                <NavItem to="/schema">Schema</NavItem>
                <NavItem to="/panels">Panels</NavItem>
                <NavItem to="/controllers">Controllers</NavItem>
                <NavItem to="/logs">Logs</NavItem>
                <NavItem to="/serper">Serper sites</NavItem>
            </nav>
            <main className="content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/schema" element={<SchemaPage />} />
                    <Route path="/panels" element={<BrowsePanels />} />
                    <Route path="/controllers" element={<BrowseControllers />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/serper" element={<SerperPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}
