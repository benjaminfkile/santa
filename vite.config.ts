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
        codeSplitting: {
          groups: [
            { name: "signalr", test: /@microsoft[\\/]signalr/, priority: 20 },
            { name: "auth", test: /oidc-client-ts|[\\/]src[\\/]auth[\\/]userManager|[\\/]src[\\/]auth[\\/]AuthCallback/, priority: 20 },
            { name: "map", test: /@googlemaps[\\/]js-api-loader|[\\/]src[\\/]map[\\/]/, priority: 20 },
            { name: "alerts", test: /[\\/]src[\\/]pages[\\/]Alerts[\\/]/, priority: 20 },
          ],
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
