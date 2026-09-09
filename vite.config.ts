import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// docs/site.md section 21.1 (build) and section 22.1 (tests).
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@microsoft/signalr")) return "signalr";
          if (id.includes("oidc-client-ts")) return "auth";
          if (id.includes("@googlemaps/js-api-loader")) return "map";
          if (id.includes("/src/map/")) return "map";
          if (id.includes("/src/pages/Alerts/")) return "alerts";
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    css: false,
  },
});
