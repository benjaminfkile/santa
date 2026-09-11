// docs/site.md section 7.7. Structural test that the shell renders the
// header bar, menu button, and footer with the class names the wireframes
// and downstream tests select. Also verifies the collapsed live-page shell
// omits the footer and the boxed menu button remains addressable.

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
  it("renders the header bar, menu button, and footer with the wireframe class names", () => {
    seed(makeContent());
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <Shell>
            <div data-testid="page-body">body</div>
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );

    const header = container.querySelector("header.site-header");
    expect(header).not.toBeNull();
    expect(header?.classList.contains("site-header--collapsed")).toBe(false);

    const brand = container.querySelector(".site-header__brand");
    expect(brand?.textContent).toContain("WMSFO Test");

    const menuButton = container.querySelector("button.site-header__menu-button");
    expect(menuButton).not.toBeNull();
    expect(menuButton?.getAttribute("aria-controls")).not.toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");

    const nav = container.querySelector("nav.site-header__nav");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Site");

    const footer = container.querySelector("footer.site-footer");
    expect(footer).not.toBeNull();
    const footerLinks = container.querySelectorAll("footer.site-footer .site-footer__links a");
    expect(footerLinks.length).toBeGreaterThan(0);
    expect(container.querySelector(".site-footer__text")?.textContent).toContain("Footer text");
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
    const skip = container.querySelector("a.skip-link");
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute("href")).toBe("#main");
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
    expect(container.querySelector(".site-header__theme-chip")).toBeNull();
  });

  it("collapses the header and omits the footer on the live map page", () => {
    seed(makeContent(), true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Shell>
            <main id="main" data-page-role="live">
              <div className="map-section" />
            </main>
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    const header = container.querySelector("header.site-header");
    expect(header?.classList.contains("site-header--collapsed")).toBe(true);
    expect(container.querySelector("button.site-header__menu-button")).not.toBeNull();
    // Brand and sign-in link are hidden when collapsed.
    expect(container.querySelector(".site-header__brand")).toBeNull();
    // Footer is omitted so the map keeps the viewport.
    expect(container.querySelector("footer.site-footer")).toBeNull();
  });
});
