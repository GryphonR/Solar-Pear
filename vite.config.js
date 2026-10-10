import { copyFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * GitHub Pages has no SPA fallback, so a deep link such as /library/panels would 404. Pages serves
 * 404.html for unknown paths; making it a copy of index.html lets the router take over (roadmap 13.3).
 */
function spaFallback() {
    let outDir;
    return {
        name: "spa-404-fallback",
        apply: "build",
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        async closeBundle() {
            await copyFile(path.join(outDir, "index.html"), path.join(outDir, "404.html"));
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    base: process.env.BASE_PATH || "/",
    plugins: [react(), tailwindcss(), spaFallback()],
    test: {
        environment: "jsdom",
        setupFiles: "./src/test/setupTests.js",
        globals: true,
        // The shell UI tests render whole pages and run close to the 5 s default
        // when the full suite runs in parallel on a busy machine or CI runner.
        testTimeout: 20000,
        coverage: {
            provider: "v8",
            reportsDirectory: "coverage",
        },
    },
});
