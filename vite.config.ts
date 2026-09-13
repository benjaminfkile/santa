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
            // Pin the colour-scheme module (and its inputs) to a shared
            // "theme" chunk so both the map chunk and the index chunk
            // import from it rather than each other. Priority higher than
            // the map rule.
            { name: "theme", test: /[\\/]src[\\/]content[\\/]theme[\\/]colorScheme|[\\/]src[\\/]lib[\\/]storage/, priority: 30 },
            { name: "map", test: /@googlemaps[\\/]js-api-loader|[\\/]src[\\/]map[\\/]/, priority: 20 },
            { name: "alerts", test: /[\\/]src[\\/]pages[\\/]Alerts[\\/]/, priority: 20 },
            { name: "osd", test: /[\\/]openseadragon[\\/]|[\\/]src[\\/]content[\\/]sections[\\/]RoutePreview[\\/]PosterViewer/, priority: 20 },
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
