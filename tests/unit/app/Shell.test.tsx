// docs/site.md section 7.7 and S16f. Structural test that the shell
// renders the header bar, menu button, and footer. After the CSS module
// conversion the class names are hashed, so this test addresses each
// element by role, test id, or aria attribute.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

function seed(content: ContentDocument, mapFirst: boolean = false, media: Record<string, unknown> = {}) {
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
        media,
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

  it("renders the theme picker with Light, Dark, and System, and no legacy chips", () => {
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
    expect(toggle.getAttribute("aria-haspopup")).toBe("menu");
    act(() => {
      toggle.click();
    });
    const menu = getByTestId("theme-menu");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(getByTestId("theme-light").textContent).toBe("Light");
    expect(getByTestId("theme-dark").textContent).toBe("Dark");
    expect(getByTestId("theme-system").textContent).toBe("System");
    expect(getByTestId("theme-system").getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-testid="follow-system"]')).toBeNull();
    expect(container.querySelector('[data-testid="footer-lights-toggle"]')).toBeNull();
    // Legacy accent/surface/font chips are gone.
    expect(container.querySelector('[data-testid="theme-controls"]')).toBeNull();
  });

  it("renders no snow control in the menu drawer or the footer, and no Lights switch", () => {
    seed(makeContent());
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <MemoryRouter>
        <AuthProvider>
          <Shell>
            <div />
          </Shell>
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.click(getByLabelText("Menu"));
    const drawer = getByLabelText("Menu").getAttribute("aria-controls")!;
    const nav = document.getElementById(drawer)!;
    expect(nav.hidden).toBe(false);
    expect(queryByTestId("menu-snow-toggle")).toBeNull();
    expect(queryByTestId("footer-snow-toggle")).toBeNull();
    expect(queryByTestId("menu-lights-toggle")).toBeNull();
    expect(nav.textContent).not.toMatch(/snow/i);
    expect(getByTestId("site-footer").textContent).not.toMatch(/snow/i);
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

  it("renders only the page while the event is live: no header, no footer, the scroll lock on html", () => {
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
    expect(getByTestId("map-placeholder")).not.toBeNull();
    expect(queryByTestId("site-header")).toBeNull();
    expect(queryByText("WMSFO Test")).toBeNull();
    expect(queryByTestId("site-footer")).toBeNull();
    expect(document.documentElement.getAttribute("data-takeover")).toBe("live");
  });

  it("keeps the preview banner floating over the live takeover", () => {
    seed(makeContent(), true);
    act(() => {
      store.setState({ preview: { content: null, media: {}, icons: {} } as never });
    });
    const { getByTestId, queryByTestId } = render(
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
    expect(getByTestId("map-placeholder")).not.toBeNull();
    expect(queryByTestId("site-header")).toBeNull();
    expect(getByTestId("preview-banner")).not.toBeNull();
    expect(document.documentElement.getAttribute("data-takeover")).toBe("live");
  });
});

const LOGO_MEDIA = {
  "logo-1": { url: "https://cdn/logo.svg", kind: "svg", width: 400, height: 100, alt: "Asset alt", variants: {} },
};

function renderShell() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Shell>
          <div>body</div>
        </Shell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Shell brand logo", () => {
  it("shows the built-in mark and the site name without logoMedia", () => {
    seed(makeContent());
    const { getByTestId, queryByTestId } = renderShell();
    const brand = getByTestId("site-header").querySelector('a[href="/"]')!;
    expect(queryByTestId("brand-logo")).toBeNull();
    expect(brand.querySelector('svg[aria-label="WMSFO"]')).not.toBeNull();
    expect(brand.textContent).toBe("WMSFO Test");
    expect(brand.getAttribute("aria-label")).toBeNull();
  });

  it("shows the logo in place of the mark, then the site name, with logoMedia", () => {
    const content = makeContent();
    content.settings.logoMedia = { mediaId: "logo-1", alt: null };
    seed(content, false, LOGO_MEDIA);
    const { getByTestId } = renderShell();
    const brand = getByTestId("site-header").querySelector('a[href="/"]')!;
    const logo = getByTestId("brand-logo");
    expect(brand.contains(logo)).toBe(true);
    expect(logo.querySelector("img")?.getAttribute("src")).toBe("https://cdn/logo.svg");
    expect(brand.querySelector('svg[aria-label="WMSFO"]')).toBeNull();
    expect(brand.textContent).toBe("WMSFO Test");
  });

  it("hides the site name when headerShowsSiteName is false and keeps it as the link's name", () => {
    const content = makeContent();
    content.settings.logoMedia = { mediaId: "logo-1", alt: null };
    content.settings.headerShowsSiteName = false;
    seed(content, false, LOGO_MEDIA);
    const { getByTestId, getByRole } = renderShell();
    const brand = getByTestId("site-header").querySelector('a[href="/"]')!;
    expect(brand.textContent).toBe("");
    expect(getByTestId("brand-logo")).not.toBeNull();
    expect(getByRole("link", { name: "WMSFO Test" })).toBe(brand);
  });

  it("keeps the site name when headerShowsSiteName is false but no logo is set", () => {
    const content = makeContent();
    content.settings.headerShowsSiteName = false;
    seed(content);
    const { getByTestId } = renderShell();
    const brand = getByTestId("site-header").querySelector('a[href="/"]')!;
    expect(brand.textContent).toBe("WMSFO Test");
    expect(brand.querySelector('svg[aria-label="WMSFO"]')).not.toBeNull();
  });

  it("sizes the header logo 32 px tall, 28 px below 640 px", () => {
    const css = readFileSync(resolve(__dirname, "..", "..", "..", "src", "app", "Shell.module.css"), "utf8");
    expect(css).toMatch(/\.brandLogo \{ height: 32px; \}/);
    expect(css).toMatch(/@media \(max-width: 639px\) \{\s*\.brandLogo \{ height: 28px; \}/);
  });
});

describe("Shell menu drawer", () => {
  function drawerOf(getByLabelText: (t: string) => HTMLElement): HTMLElement {
    return document.getElementById(getByLabelText("Menu").getAttribute("aria-controls")!)!;
  }

  function stubReducedMotion(reduce: boolean): void {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: reduce && query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("slides in from the left on open and out to the right on close, then hides", () => {
    stubReducedMotion(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = drawerOf(getByLabelText);
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-motion")).toBe("none");

    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(false);
    expect(nav.getAttribute("data-drawer")).toBe("open");
    expect(nav.getAttribute("data-motion")).toBe("in");

    fireEvent.click(getByLabelText("Menu"));
    expect(nav.getAttribute("data-drawer")).toBe("closing");
    expect(nav.hidden).toBe(false);
    expect(nav.getAttribute("data-motion")).toBe("out");

    fireEvent.animationEnd(nav);
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-drawer")).toBe("closed");
  });

  it("finishes the close on a timer when no animationend arrives", () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = drawerOf(getByLabelText);
    fireEvent.click(getByLabelText("Menu"));
    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(nav.hidden).toBe(true);
  });

  it("maps the in and out slides to distinct classes and keyframes, removed under reduced motion", () => {
    const css = readFileSync(resolve(__dirname, "..", "..", "..", "src", "app", "Shell.module.css"), "utf8");
    expect(css).toMatch(/\.navIn \{ animation: drawerIn /);
    expect(css).toMatch(/\.navOut \{ animation: drawerOut /);
    expect(css).toMatch(/@keyframes drawerIn \{\s*from \{ transform: translateX\(-/);
    expect(css).toMatch(/@keyframes drawerOut \{\s*from \{ transform: translateX\(0\);[^}]*\}\s*to \{ transform: translateX\(\d/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.navIn,\s*\.navOut \{ animation: none; \}/);
  });

  it("collapses the transition classes under reduced motion and closes at once", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = drawerOf(getByLabelText);
    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(false);
    expect(nav.getAttribute("data-motion")).toBe("none");
    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-drawer")).toBe("closed");
    expect(nav.getAttribute("data-motion")).toBe("none");
  });

  it("closes on a tap or click outside the open drawer", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText, getByTestId } = renderShell();
    const nav = drawerOf(getByLabelText);
    fireEvent.click(getByLabelText("Menu"));
    fireEvent.mouseDown(nav);
    expect(nav.hidden).toBe(false);
    fireEvent.mouseDown(getByTestId("site-footer"));
    expect(nav.hidden).toBe(true);

    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(false);
    fireEvent.touchStart(document.body);
    expect(nav.hidden).toBe(true);
  });

  it("registers its outside touch listener as passive", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const add = vi.spyOn(document, "addEventListener");
    const { getByLabelText } = renderShell();
    fireEvent.click(getByLabelText("Menu"));
    const touch = add.mock.calls.filter(([type]) => type === "touchstart");
    expect(touch.length).toBeGreaterThan(0);
    for (const call of touch) expect(call[2]).toMatchObject({ passive: true });
  });

  it("closes when any menu item is chosen", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = drawerOf(getByLabelText);
    const count = nav.querySelectorAll("a, button").length;
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i += 1) {
      fireEvent.click(getByLabelText("Menu"));
      expect(nav.hidden).toBe(false);
      const item = nav.querySelectorAll<HTMLElement>("a, button")[i];
      fireEvent.click(item);
      expect(nav.hidden).toBe(true);
    }
  });

  it("closes on Escape and returns focus to the menu button", () => {
    stubReducedMotion(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = drawerOf(getByLabelText);
    const button = getByLabelText("Menu");
    fireEvent.click(button);
    expect(nav.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav.getAttribute("data-drawer")).toBe("closing");
    expect(document.activeElement).toBe(button);
    fireEvent.animationEnd(nav);
    expect(nav.hidden).toBe(true);
  });
});
