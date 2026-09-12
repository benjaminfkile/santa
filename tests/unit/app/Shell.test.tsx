// docs/site.md section 7.7 and S16f. Structural test that the shell
// renders the header bar, menu button, and footer. After the CSS module
// conversion the class names are hashed, so this test addresses each
// element by role, test id, or aria attribute.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Shell } from "../../../src/app/Shell";
import { AuthProvider } from "../../../src/auth/AuthProvider";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { ContentDocument } from "../../../src/contracts";

function makeContent(): ContentDocument {
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
      footerLinks: [
        { label: "Facebook", href: "https://facebook.example", icon: null, newTab: true },
      ],
      footerText: "Footer text (settings.footerText)",
      contactEmail: null,
      donateUrl: null,
      analyticsEnabled: false,
    },
    pages: [
      {
        id: 1,
        slug: "planned",
        title: "planned",
        navLabel: null,
        navPosition: 0,
        role: "planned",
        sections: [
          {
            id: 100,
            kind: "hero",
            presentation: {
              width: "wide",
              align: "center",
              background: { kind: "none" },
              spacing: "normal",
              iconBefore: null,
              iconAfter: null,
              anchor: null,
            },
            data: { title: "hi", tagline: null, icon: null, links: [], height: "tall" },
            items: [],
          },
        ],
      },
    ],
  };
}

function seed(content: ContentDocument, mapFirst: boolean = false) {
  const page = content.pages[0];
  if (mapFirst) {
    page.role = "live";
    page.sections[0].kind = "map";
  }
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        content: content as unknown,
        media: {},
        icons: {},
        event: { statusId: mapFirst ? 3 : 1 },
      },
      snapshotUrl: "https://cdn/snap.json",
      live: {
        schemaVersion: 1,
        eventId: 1,
        eventStatusId: mapFirst ? 3 : 1,
        pollIntervalMs: 5000,
        snapshotUrl: "https://cdn/snap.json",
        cookieTally: {},
        seq: null,
        lat: null,
        lng: null,
        speedMps: null,
        altitudeM: null,
        headingDeg: null,
        accuracyM: null,
        recordedAt: null,
        receivedAt: null,
        publishedAt: "2024-12-24T00:00:00Z",
      },
    });
  });
}

beforeEach(() => {
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("Shell structure", () => {
  it("renders the header bar, menu button, and footer", () => {
    seed(makeContent());
    const { container, getByTestId, getByLabelText } = render(
      <MemoryRouter>
        <AuthProvider>
          <Shell>
            <div data-testid="page-body">body</div>
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );

    const header = getByTestId("site-header");
    expect(header.tagName).toBe("HEADER");
    expect(header.dataset.collapsed).toBeUndefined();
    expect(header.textContent).toContain("WMSFO Test");

    const menuButton = getByLabelText("Menu");
    expect(menuButton.tagName).toBe("BUTTON");
    expect(menuButton.getAttribute("aria-controls")).not.toBeNull();
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");

    const nav = container.querySelector('nav[aria-label="Site"]');
    expect(nav).not.toBeNull();

    const footer = getByTestId("site-footer");
    expect(footer.tagName).toBe("FOOTER");
    expect(footer.querySelectorAll("a").length).toBeGreaterThan(0);
    expect(footer.textContent).toContain("Footer text");
  });

  it("renders the visually-hidden skip link before the header", () => {
    seed(makeContent());
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <Shell>
            <div />
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    const skip = container.querySelector('a[href="#main"]');
    expect(skip).not.toBeNull();
  });

  it("renders the theme toggle and the Follow system entry, and no legacy chips", () => {
    seed(makeContent());
    const { container, getByTestId } = render(
      <MemoryRouter>
        <AuthProvider>
          <Shell>
            <div />
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    const toggle = getByTestId("theme-toggle");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-label")).toMatch(/Switch to (light|dark) mode/);
    const followSystem = getByTestId("follow-system");
    expect(followSystem).not.toBeNull();
    // Legacy accent/surface/font chips are gone.
    expect(container.querySelector('[data-testid="theme-controls"]')).toBeNull();
  });

  it("shows the Snow and Lights switches in the menu drawer with aria-pressed", () => {
    seed(makeContent());
    const { getByTestId } = render(
      <MemoryRouter>
        <AuthProvider>
          <Shell>
            <div />
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    const snow = getByTestId("menu-snow-toggle");
    expect(snow.tagName).toBe("BUTTON");
    expect(snow.getAttribute("aria-pressed")).toBe("false");
    expect(snow.textContent).toBe("Snow");
    const lights = getByTestId("menu-lights-toggle");
    expect(lights.tagName).toBe("BUTTON");
    expect(lights.getAttribute("aria-pressed")).toBe("false");
    expect(lights.textContent).toBe("Lights");
  });

  it("renders the LightsLayer inside the <header> element", () => {
    // Turn lights on by default so the string of bulbs mounts.
    const content = makeContent();
    content.settings.theme = { snowDefault: false, lightsDefault: true };
    seed(content);
    const { getByTestId, queryByTestId } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Shell>
            <div />
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    const header = getByTestId("site-header");
    const lights = queryByTestId("site-lights");
    expect(lights).not.toBeNull();
    expect(header.contains(lights)).toBe(true);
  });

  it("collapses the header and omits the footer on the live map page", () => {
    seed(makeContent(), true);
    const { getByTestId, queryByTestId, queryByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Shell>
            <main id="main" data-page-role="live">
              <div data-testid="map-placeholder" />
            </main>
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    const header = getByTestId("site-header");
    expect(header.dataset.collapsed).toBe("true");
    // Brand text is hidden when collapsed.
    expect(queryByText("WMSFO Test")).toBeNull();
    // Footer is omitted so the map keeps the viewport.
    expect(queryByTestId("site-footer")).toBeNull();
  });
});
