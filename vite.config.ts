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

export default defineConfig({
  plugins: [react(), cognitoIdpPlugin()],
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
            // Santa pin image module, the renderer choice, the directions link helper, the
            // analytics module, and the number format to a shared "theme"
            // chunk so both the map chunk and the index chunk import from it
            // rather than each other.
            // Priority higher than the map rule. A shared helper left out of
            // this list lands in whichever chunk reaches it first: lib/number
            // went into the map chunk and made index import the whole map,
            // which chunk.test.ts catches only against a fresh build.
            { name: "theme", test: /[\\/]src[\\/]content[\\/]theme[\\/]colorScheme|[\\/]src[\\/]lib[\\/](storage|directions|number|analytics)|[\\/]src[\\/]map[\\/](santa(Pin\.ts|-pin\.png)|renderer\.ts)/, priority: 30 },
            { name: "map", test: /@googlemaps[\\/]js-api-loader|[\\/]src[\\/]map[\\/]/, priority: 20 },
            { name: "alerts", test: /[\\/]src[\\/]pages[\\/]Alerts[\\/]/, priority: 20 },
            // MapLibre, PMTiles, and the host modules that import them at
            // run time, so the host chunk reaches them through import() alone.
            { name: "routemap", test: /[\\/]node_modules[\\/](maplibre-gl|pmtiles)[\\/]|[\\/]src[\\/]mapHost[\\/](handle|maplibreController|userLocation|places|routeLayers|themeStyle)\.ts$|[\\/]src[\\/]mapHost[\\/]maplibre\.css$/, priority: 15 },
            { name: "tracker-maplibre", test: /[\\/]src[\\/]mapHost[\\/](?!(handle|maplibreController|userLocation|places|routeLayers|themeStyle)\.ts$|maplibre\.css$)/, priority: 20 },
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
