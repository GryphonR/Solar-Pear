import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
    base: process.env.BASE_PATH || "/",
    plugins: [react(), tailwindcss()],
    test: {
        environment: "jsdom",
        setupFiles: "./src/test/setupTests.js",
        globals: true,
        coverage: {
            provider: "v8",
            reportsDirectory: "coverage",
        },
    },
});
