import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { registerSchemaRoutes } from "./routes/schemaRoutes.mjs";
import { registerDataRoutes } from "./routes/dataRoutes.mjs";
import { registerCheckRoutes } from "./routes/checkRoutes.mjs";
import { registerLogRoutes } from "./routes/logRoutes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DATA_ADMIN_PORT) || 3847;
const HOST = "127.0.0.1";
/** When set, PUT/POST /api routes require Authorization: Bearer or X-Admin-Token. */
const ADMIN_TOKEN = process.env.DATA_ADMIN_TOKEN || "";

const app = express();
app.use(express.json({ limit: "20mb" }));

app.use((req, res, next) => {
    const host = (req.hostname || req.headers.host?.split(":")[0] || "").toLowerCase();
    if (host && host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
        return res.status(403).send("Forbidden: use localhost only");
    }
    next();
});

/**
 * Mutating-route auth: when DATA_ADMIN_TOKEN is set, require matching Bearer or X-Admin-Token.
 * When unset, localhost-only binding remains the sole gate (see HOST above).
 */
app.use((req, res, next) => {
    if (req.method !== "PUT" && req.method !== "POST") return next();
    if (!req.path.startsWith("/api") && !req.originalUrl?.startsWith("/api")) return next();

    if (!ADMIN_TOKEN) return next();

    const auth = req.headers.authorization || "";
    const bearer =
        typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")
            ? auth.slice(7).trim()
            : "";
    const headerToken = typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "";
    const provided = bearer || headerToken;

    if (!provided || provided !== ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized: valid admin token required" });
    }
    next();
});

registerSchemaRoutes(app);
registerDataRoutes(app);
registerCheckRoutes(app);
registerLogRoutes(app);

async function start() {
    if (!ADMIN_TOKEN) {
        console.warn(
            "[data-admin] DATA_ADMIN_TOKEN is unset — mutating routes are open to localhost. Set DATA_ADMIN_TOKEN (and VITE_DATA_ADMIN_TOKEN for the UI) to require auth."
        );
    }

    if (process.env.NODE_ENV === "production") {
        const dist = path.join(__dirname, "dist");
        app.use(express.static(dist));
        app.use((req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            if (req.path.startsWith("/api")) return next();
            res.sendFile(path.join(dist, "index.html"));
        });
    } else {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "custom",
            root: path.join(__dirname, "src"),
            configFile: path.join(__dirname, "vite.config.js"),
        });
        app.use(vite.middlewares);
        app.use(async (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            if (req.originalUrl.startsWith("/api")) return next();
            try {
                const url = req.originalUrl;
                let template = await fs.readFile(path.join(__dirname, "src", "index.html"), "utf-8");
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ "Content-Type": "text/html" }).end(template);
            } catch (e) {
                vite.ssrFixStacktrace(e);
                next(e);
            }
        });
    }

    app.listen(PORT, HOST, () => {
        console.log(`Data admin listening on http://${HOST}:${PORT}`);
    });
}

start().catch(console.error);
