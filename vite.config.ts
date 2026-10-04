import { defineConfig, type Plugin } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// docs/site.md section 21.1 (build) and section 22.1 (tests).

// The CSP names the Cognito IdP host, whose region is taken from the pool
// id at build time. A small plugin exposes it to index.html as
// %COGNITO_IDP_URL% so no environment value is written into the repo.
function cognitoIdpPlugin(): Plugin {
  let poolId = "";
  return {
    name: "wmsfo-cognito-idp",
    configResolved(config) {
      poolId = loadEnv(config.mode, config.root, "VITE_").VITE_COGNITO_USER_POOL_ID
        ?? process.env.VITE_COGNITO_USER_POOL_ID
        ?? "";
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const region = poolId.split("_")[0] ?? "";
        const url = region === "" ? "" : `https://cognito-idp.${region}.amazonaws.com`;
        return html.replaceAll("%COGNITO_IDP_URL%", url);
      },
    },
  };
}

// The route map fetches its tiles and glyphs from VITE_ROUTE_BASEMAP_URL.
// A small plugin exposes that URL's origin to the CSP as
// %ROUTE_BASEMAP_ORIGIN% (empty when the variable is unset).
function routeBasemapOriginPlugin(): Plugin {
  let base = "";
  return {
    name: "wmsfo-route-basemap-origin",
    configResolved(config) {
      base = loadEnv(config.mode, config.root, "VITE_").VITE_ROUTE_BASEMAP_URL
        ?? process.env.VITE_ROUTE_BASEMAP_URL
        ?? "";
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        let origin = "";
        try {
          origin = base === "" ? "" : new URL(base).origin;
        } catch {
          origin = "";
        }
        return html.replaceAll("%ROUTE_BASEMAP_ORIGIN%", origin);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), cognitoIdpPlugin(), routeBasemapOriginPlugin()],
  // amazon-cognito-identity-js pulls in the Node buffer shim, which reads
  // `global` at module load; the browser has only globalThis.
  define: { global: "globalThis" },
  build: {
    target: "es2020",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "signalr", test: /@microsoft[\\/]signalr/, priority: 20 },
            { name: "auth", test: /amazon-cognito-identity-js|[\\/]src[\\/]auth[\\/]cognito|[\\/]src[\\/]pages[\\/]Auth[\\/]/, priority: 20 },
            // Pin the colour-scheme module (and its inputs), the shared
            // Santa pin image module, and the directions link helper to a
            // shared "theme" chunk so both the map chunk and the index
            // chunk import from it rather than each other. Priority higher
            // than the map rule.
            { name: "theme", test: /[\\/]src[\\/]content[\\/]theme[\\/]colorScheme|[\\/]src[\\/]lib[\\/](storage|directions)|[\\/]src[\\/]map[\\/]santa(Pin\.ts|-pin\.png)/, priority: 30 },
            { name: "map", test: /@googlemaps[\\/]js-api-loader|[\\/]src[\\/]map[\\/]/, priority: 20 },
            { name: "alerts", test: /[\\/]src[\\/]pages[\\/]Alerts[\\/]/, priority: 20 },
            { name: "routemap", test: /[\\/]maplibre-gl[\\/]|[\\/]pmtiles[\\/]|@protomaps[\\/]basemaps|[\\/]src[\\/]routeMap[\\/]/, priority: 20 },
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
