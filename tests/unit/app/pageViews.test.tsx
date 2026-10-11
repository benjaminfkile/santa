// docs/site.md section 16. The shell mounts the page-view hook: with the
// bundle switch on, the id set and the origin listed, rendering any route
// loads gtag once and sends one page_view for the route's path; with the
// switch off nothing loads.

import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const ID = "G-TEST000000";

function content(analyticsEnabled: boolean) {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO Test",
      tagline: null,
      homeNavLabel: "Track Santa",
      logo: null,
      favicon: null,
      theme: { snowDefault: false, lightsDefault: false },
      navExtraLinks: [],
      footerLinks: [],
      footerText: null,
      contactEmail: null,
      donateUrl: null,
      analyticsEnabled,
    },
    pages: [],
  };
}

async function renderAt(path: string, analyticsEnabled: boolean) {
  vi.stubEnv("VITE_ANALYTICS_ID", ID);
  vi.stubEnv("VITE_ANALYTICS_ORIGINS", window.location.origin);
  vi.resetModules();
  const { Shell } = await import("../../../src/app/Shell");
  const { AuthProvider } = await import("../../../src/auth/AuthProvider");
  const { store } = await import("../../../src/store/useStore");
  const { initialStore } = await import("../../../src/store/types");
  const { resetAnalyticsForTests } = await import("../../../src/lib/analytics");
  resetAnalyticsForTests();
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        content: content(analyticsEnabled) as unknown,
        media: {},
        icons: {},
        event: { statusId: 1, trackerBbox: {}, trackerMap: null },
        trackerThemes: [],
      },
      snapshotUrl: "https://cdn/snap.json",
    } as never);
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Shell>
          <div>body</div>
        </Shell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function pageViews(): unknown[] {
  return (window.dataLayer ?? [])
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((args) => args[0] === "event" && args[1] === "page_view")
    .map((args) => args[2]);
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.head.querySelectorAll('script[src*="googletagmanager"]').forEach((s) => s.remove());
});

describe("Shell page views", () => {
  it("loads gtag and sends a page_view when the bundle switch is on", async () => {
    await renderAt("/route?x=1", true);
    expect(document.head.querySelector('script[src*="googletagmanager"]')).not.toBeNull();
    expect(pageViews()).toEqual([{ page_path: "/route?x=1", send_to: ID }]);
  });

  it("loads nothing when the bundle switch is off", async () => {
    await renderAt("/route", false);
    expect(document.head.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(pageViews()).toEqual([]);
  });
});
