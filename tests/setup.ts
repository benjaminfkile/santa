import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// docs/site.md section 22.1. Provide the VITE_ values so env.ts loads
// cleanly for every test file. Individual tests may still vi.mock the
// module directly when they need a specific value.
const defaults: Record<string, string> = {
  VITE_ENV: "preview",
  VITE_CDN_BASE_URL: "https://cdn.example",
  VITE_HUB_URL: "wss://hub.example/hub",
  VITE_HUB_CHANNEL_PREFIX: "wmsfo-api-dev",
  VITE_API_BASE_URL: "https://api.example",
  VITE_COGNITO_AUTHORITY: "https://cognito.example/authority",
  VITE_COGNITO_DOMAIN: "https://cognito.example",
  VITE_COGNITO_CLIENT_ID: "clientid",
  VITE_GOOGLE_MAPS_KEY: "maps-key",
  VITE_ANALYTICS_ID: "",
  VITE_ANALYTICS_ORIGINS: "",
};

for (const [k, v] of Object.entries(defaults)) {
  vi.stubEnv(k, v);
}
