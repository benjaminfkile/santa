// docs/site.md section 16. Analytics gating: id present, origins list
// includes window.location.origin, all three conditions required.

import { describe, it, expect, beforeEach, vi } from "vitest";

const ORIGIN = "https://site.example";

beforeEach(async () => {
  vi.resetModules();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { origin: ORIGIN, pathname: "/", search: "" } as Location,
  });
  const { resetAnalyticsForTests } = await import("../../../src/lib/analytics");
  resetAnalyticsForTests();
  document.head.innerHTML = "";
});

async function loadWithEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) vi.stubEnv(k, v);
  vi.resetModules();
  return (await import("../../../src/lib/analytics")).initAnalytics;
}

describe("initAnalytics", () => {
  it("returns false when ANALYTICS_ID is empty", async () => {
    const initAnalytics = await loadWithEnv({ VITE_ANALYTICS_ID: "", VITE_ANALYTICS_ORIGINS: ORIGIN });
    expect(initAnalytics()).toBe(false);
    expect(document.head.querySelector("script")).toBeNull();
  });

  it("returns false when the origin is not in the list", async () => {
    const initAnalytics = await loadWithEnv({
      VITE_ANALYTICS_ID: "G-XYZ",
      VITE_ANALYTICS_ORIGINS: "https://other.example",
    });
    expect(initAnalytics()).toBe(false);
    expect(document.head.querySelector("script")).toBeNull();
  });

  it("initializes when id is set and the origin is in the list", async () => {
    const initAnalytics = await loadWithEnv({
      VITE_ANALYTICS_ID: "G-XYZ",
      VITE_ANALYTICS_ORIGINS: `${ORIGIN},https://also.example`,
    });
    expect(initAnalytics()).toBe(true);
    const script = document.head.querySelector("script");
    expect(script?.getAttribute("src")).toContain("gtag/js?id=G-XYZ");
    expect(typeof window.gtag).toBe("function");
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });

  it("is idempotent when called twice", async () => {
    const initAnalytics = await loadWithEnv({
      VITE_ANALYTICS_ID: "G-XYZ",
      VITE_ANALYTICS_ORIGINS: ORIGIN,
    });
    expect(initAnalytics()).toBe(true);
    expect(initAnalytics()).toBe(true);
    expect(document.head.querySelectorAll("script").length).toBe(1);
  });
});
