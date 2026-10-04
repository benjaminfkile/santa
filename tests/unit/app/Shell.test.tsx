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
        icon: null,
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
    expect(brand.getAttribute("aria-label")).toBe("WMSFO Test");
  });

  it("hides the site name when it would not fit on one line and keeps it as the link's name", () => {
    seed(makeContent());
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get");
    const client = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    scroll.mockImplementation(function (this: HTMLElement) { return this.dataset.testid === "brand-name" ? 300 : 0; });
    client.mockImplementation(function (this: HTMLElement) { return this.dataset.testid === "brand-name" ? 120 : 0; });
    try {
      const { getByTestId, getByRole } = renderShell();
      const name = getByTestId("brand-name");
      expect(name.getAttribute("data-fit")).toBe("no");
      const brand = getByTestId("site-header").querySelector('a[href="/"]')!;
      expect(getByRole("link", { name: "WMSFO Test" })).toBe(brand);
    } finally {
      scroll.mockRestore();
      client.mockRestore();
    }
  });

  it("marks the site name as fitting when it sits on one line", () => {
    seed(makeContent());
    const { getByTestId } = renderShell();
    expect(getByTestId("brand-name").getAttribute("data-fit")).toBe("yes");
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

describe("Shell sticky header", () => {
  it("pins the header to the top of the viewport while the page scrolls", () => {
    const css = readFileSync(resolve(__dirname, "..", "..", "..", "src", "app", "Shell.module.css"), "utf8");
    const rule = /\.siteHeader \{([^}]*)\}/.exec(css)![1].replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rule).toMatch(/position: sticky;/);
    expect(rule).toMatch(/top: 0;/);
    expect(rule).toMatch(/z-index: 10;/);
    // A transform or filter would make the header the fixed panel's
    // containing block and pull the panel out of the viewport corner.
    expect(rule).not.toMatch(/transform|filter|contain:/);
    expect(rule).not.toMatch(/position: (fixed|absolute)/);
  });

});

describe("Shell menu panel", () => {
  const css = (): string =>
    readFileSync(resolve(__dirname, "..", "..", "..", "src", "app", "Shell.module.css"), "utf8");

  function panelOf(getByLabelText: (t: string) => HTMLElement): HTMLElement {
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

  it("anchors the panel to the top right corner, capped in width and scrollable", () => {
    const rule = /\.panel \{([^}]*)\}/.exec(css())![1];
    expect(rule).toMatch(/position: fixed;/);
    expect(rule).toMatch(/top: var\(--space-2\);/);
    expect(rule).toMatch(/right: var\(--space-2\);/);
    expect(rule).not.toMatch(/left:/);
    expect(rule).toMatch(/width: 180px;/);
    expect(rule).toMatch(/max-width: calc\(100vw - /);
    expect(rule).toMatch(/max-height: calc\(100dvh - /);
    expect(rule).toMatch(/overflow-y: auto;/);
    expect(rule).toMatch(/border-radius: var\(--radius-md\);/);
    expect(rule).toMatch(/box-shadow: var\(--shadow-raised\);/);
    const row = /\.row \{([^}]*)\}/.exec(css())![1];
    expect(row).toMatch(/min-height: 65px;/);
    expect(row).toMatch(/background: var\(--panel-2\);/);
    expect(row).toMatch(/border-radius: var\(--radius-md\);/);
  });

  it("hides the menu button while the panel is open and shows it again on close", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const button = getByLabelText("Menu");
    expect(button.getAttribute("data-panel-open")).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("data-panel-open")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("data-panel-open")).toBeNull();
    expect(css()).toMatch(/\.menuButton\[data-panel-open="true"\] \{ visibility: hidden; \}/);
  });

  it("slides in from the right on open and out to the right on close, then hides", () => {
    stubReducedMotion(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = panelOf(getByLabelText);
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-motion")).toBe("none");

    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(false);
    expect(nav.getAttribute("data-panel")).toBe("open");
    expect(nav.getAttribute("data-motion")).toBe("in");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav.getAttribute("data-panel")).toBe("closing");
    expect(nav.hidden).toBe(false);
    expect(nav.getAttribute("data-motion")).toBe("out");

    fireEvent.animationEnd(nav);
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-panel")).toBe("closed");
  });

  it("finishes the close on a timer when no animationend arrives", () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = panelOf(getByLabelText);
    fireEvent.click(getByLabelText("Menu"));
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(nav.hidden).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(nav.hidden).toBe(true);
  });

  it("slides from the right with the legacy 0.5 s ease both ways, removed under reduced motion", () => {
    const ease = "500ms cubic-bezier\\(0\\.25, 0\\.46, 0\\.45, 0\\.94\\) both";
    expect(css()).toMatch(new RegExp(`\\.panelIn \\{ animation: panelIn ${ease}; \\}`));
    expect(css()).toMatch(new RegExp(`\\.panelOut \\{ animation: panelOut ${ease}; \\}`));
    expect(css()).toMatch(/@keyframes panelIn \{\s*from \{ transform: translateX\(calc\(100% \+ var\(--space-2\)\)\); \}\s*to \{ transform: translateX\(0\); \}/);
    expect(css()).toMatch(/@keyframes panelOut \{\s*from \{ transform: translateX\(0\); \}\s*to \{ transform: translateX\(calc\(100% \+ var\(--space-2\)\)\); \}/);
    expect(css()).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.panelIn,\s*\.panelOut \{ animation: none; \}/);
  });

  it("collapses the slide under reduced motion: opening and closing are instant", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = panelOf(getByLabelText);
    fireEvent.click(getByLabelText("Menu"));
    expect(nav.hidden).toBe(false);
    expect(nav.getAttribute("data-motion")).toBe("none");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-panel")).toBe("closed");
    expect(nav.getAttribute("data-motion")).toBe("none");
  });

  it("closes on a tap or click outside the open panel and returns focus to the menu button", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText, getByTestId } = renderShell();
    const nav = panelOf(getByLabelText);
    const button = getByLabelText("Menu");
    fireEvent.click(button);
    fireEvent.mouseDown(nav);
    expect(nav.hidden).toBe(false);
    fireEvent.mouseDown(getByTestId("site-footer"));
    expect(nav.hidden).toBe(true);
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(nav.hidden).toBe(false);
    fireEvent.touchStart(document.body);
    expect(nav.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
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

  it("closes when any row is chosen and returns focus to the menu button", () => {
    stubReducedMotion(true);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = panelOf(getByLabelText);
    const button = getByLabelText("Menu");
    const count = nav.querySelectorAll("a, button").length;
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i += 1) {
      fireEvent.click(button);
      expect(nav.hidden).toBe(false);
      const item = nav.querySelectorAll<HTMLElement>("a, button")[i];
      fireEvent.click(item);
      expect(nav.hidden).toBe(true);
      expect(document.activeElement).toBe(button);
    }
  });

  it("closes on Escape and returns focus to the menu button", () => {
    stubReducedMotion(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const nav = panelOf(getByLabelText);
    const button = getByLabelText("Menu");
    fireEvent.click(button);
    expect(nav.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav.getAttribute("data-panel")).toBe("closing");
    expect(document.activeElement).toBe(button);
    fireEvent.animationEnd(nav);
    expect(nav.hidden).toBe(true);
  });

  it("renders one row per destination with an icon slot, filled where the destination has an icon", () => {
    stubReducedMotion(true);
    const content = makeContent();
    content.settings.navExtraLinks = [
      { label: "Donate", href: "https://donate.example", icon: { source: "library", id: "gift" }, newTab: true },
      { label: "Plain", href: "/plain", icon: null, newTab: false },
    ] as typeof content.settings.navExtraLinks;
    seed(content);
    const { getByLabelText } = renderShell();
    const nav = panelOf(getByLabelText);
    const rows = Array.from(nav.querySelectorAll<HTMLElement>("li > a, li > button"));
    // Home, the two extra links, and Sign in.
    expect(rows.map((r) => r.textContent)).toEqual(["Track Santa", "Donate", "Plain", "Sign in"]);
    for (const row of rows) {
      const slot = row.querySelector('[data-testid="panel-row-icon"]');
      expect(slot).not.toBeNull();
      expect(row.firstElementChild).toBe(slot);
    }
    const [home, donate, plain] = rows;
    expect(donate.querySelector('[data-testid="panel-row-icon"]')!.childElementCount).toBe(1);
    expect(donate.querySelector('[data-testid="panel-row-icon"] svg, [data-testid="panel-row-icon"] img')).not.toBeNull();
    expect(plain.querySelector('[data-testid="panel-row-icon"]')!.childElementCount).toBe(0);
    expect(home.querySelector('[data-testid="panel-row-icon"]')!.childElementCount).toBe(0);
    expect(donate.getAttribute("target")).toBe("_blank");
    expect(plain.getAttribute("href")).toBe("/plain");
    expect(css()).toMatch(/\.rowIcon \{[^}]*flex: none;[^}]*width: 24px;/);
  });
});

describe("Shell menu panel at the desktop breakpoint", () => {
  // A matchMedia stub whose desktop query can be flipped, calling the
  // listeners the shell registered on it.
  function stubViewport(initialDesktop: boolean) {
    let desktop = initialDesktop;
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      const isDesktop = query === "(min-width: 761px)";
      return {
        get matches() {
          return isDesktop ? desktop : false;
        },
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
          if (isDesktop) listeners.add(fn);
        },
        removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
          if (isDesktop) listeners.delete(fn);
        },
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    });
    return {
      listeners,
      widen() {
        desktop = true;
        act(() => {
          for (const fn of Array.from(listeners)) fn({ matches: true } as MediaQueryListEvent);
        });
      },
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the open panel at once when the viewport crosses into desktop and releases the lock", () => {
    const viewport = stubViewport(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const button = getByLabelText("Menu");
    const nav = document.getElementById(button.getAttribute("aria-controls")!)!;
    const overflowBefore = document.body.style.overflow;
    fireEvent.click(button);
    expect(nav.getAttribute("data-panel")).toBe("open");
    expect(nav.getAttribute("data-motion")).toBe("in");
    expect(button.getAttribute("data-panel-open")).toBe("true");
    expect(viewport.listeners.size).toBe(1);

    viewport.widen();
    // Closed with no exit slide.
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-panel")).toBe("closed");
    expect(nav.getAttribute("data-motion")).toBe("none");
    // Nothing the open panel held survives: the button is no longer hidden,
    // the listener is gone, Tab is not trapped, the body scroll is untouched.
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("data-panel-open")).toBeNull();
    expect(viewport.listeners.size).toBe(0);
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    expect(document.body.style.overflow).toBe(overflowBefore);
    // An outside press after the crossing does nothing.
    fireEvent.mouseDown(document.body);
    expect(nav.getAttribute("data-panel")).toBe("closed");
  });

  it("cuts a closing slide short when the viewport crosses into desktop", () => {
    const viewport = stubViewport(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const button = getByLabelText("Menu");
    const nav = document.getElementById(button.getAttribute("aria-controls")!)!;
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav.getAttribute("data-panel")).toBe("closing");
    viewport.widen();
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute("data-panel")).toBe("closed");
  });

  it("listens for the breakpoint only while the panel is open", () => {
    const viewport = stubViewport(false);
    seed(makeContent());
    const { getByLabelText } = renderShell();
    expect(viewport.listeners.size).toBe(0);
    fireEvent.click(getByLabelText("Menu"));
    expect(viewport.listeners.size).toBe(1);
  });
});

describe("Shell menu panel row icons", () => {
  function stubReducedMotion(): void {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
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
  });

  function withDestinations(): ContentDocument {
    const content = makeContent();
    content.pages[0].icon = { source: "library", id: "sleigh" };
    content.pages.push(
      { ...content.pages[0], id: 2, slug: "about", title: "About", navLabel: "About", navPosition: 1, role: "none", icon: { source: "media", id: "m-about", display: { sizePx: 96 } } },
      { ...content.pages[0], id: 3, slug: "faq", title: "FAQ", navLabel: "FAQ", navPosition: 2, role: "none", icon: null },
    );
    content.settings.navExtraLinks = [
      { label: "Donate", href: "https://donate.example", icon: { source: "library", id: "gift" }, newTab: true },
      { label: "Plain", href: "/plain", icon: null, newTab: false },
    ] as typeof content.settings.navExtraLinks;
    return content;
  }

  const media = { "m-about": { url: "https://cdn/about.svg", kind: "svg" } };

  function rowsOf(button: HTMLElement): HTMLElement[] {
    const nav = document.getElementById(button.getAttribute("aria-controls")!)!;
    return Array.from(nav.querySelectorAll<HTMLElement>("li > a, li > button"));
  }

  const slot = (row: HTMLElement): HTMLElement =>
    row.querySelector<HTMLElement>('[data-testid="panel-row-icon"]')!;

  it("draws library icons inline and media icons through <img>, at the slot size", () => {
    stubReducedMotion();
    seed(withDestinations(), false, media);
    const { getByLabelText } = renderShell();
    const rows = rowsOf(getByLabelText("Menu"));
    expect(rows.map((r) => r.textContent)).toEqual(["Track Santa", "About", "FAQ", "Donate", "Plain", "Sign in"]);
    const [home, about, , donate] = rows;

    const homeIcon = slot(home).querySelector("svg")!;
    expect(homeIcon.getAttribute("data-icon-id")).toBe("sleigh");
    expect(homeIcon.getAttribute("width")).toBe("24");
    expect(slot(donate).querySelector("svg")!.getAttribute("data-icon-id")).toBe("gift");

    const img = slot(about).querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn/about.svg");
    expect(img.getAttribute("alt")).toBe("");
    // The display size is not applied: every row icon is 24 px.
    expect(img.getAttribute("width")).toBe("24");
    expect(slot(about).querySelector('[data-display="icon"]')).toBeNull();
  });

  it("keeps an empty slot first in rows without an icon, so every label aligns", () => {
    stubReducedMotion();
    seed(withDestinations(), false, media);
    const { getByLabelText } = renderShell();
    const rows = rowsOf(getByLabelText("Menu"));
    for (const row of rows) expect(row.firstElementChild).toBe(slot(row));
    const faq = rows[2];
    const plain = rows[4];
    expect(slot(faq).childElementCount).toBe(0);
    expect(slot(plain).childElementCount).toBe(0);
  });

  it("leaves the slot empty when a media icon does not resolve", () => {
    stubReducedMotion();
    seed(withDestinations());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getByLabelText } = renderShell();
    const about = rowsOf(getByLabelText("Menu"))[1];
    expect(slot(about).childElementCount).toBe(0);
    expect(about.firstElementChild).toBe(slot(about));
    warn.mockRestore();
  });

  it("draws a bundled library icon on the sign in row", () => {
    stubReducedMotion();
    seed(makeContent());
    const { getByLabelText } = renderShell();
    const signIn = rowsOf(getByLabelText("Menu")).at(-1)!;
    expect(signIn.textContent).toBe("Sign in");
    const icon = slot(signIn).querySelector("svg")!;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("data-icon-source")).toBe("library");
    expect(icon.getAttribute("data-icon-id")).toBe("gift-tag");
    expect(icon.getAttribute("width")).toBe("24");
  });

  it("sizes every row icon to the 24 px slot in the stylesheet", () => {
    const css = readFileSync(resolve(__dirname, "..", "..", "..", "src", "app", "Shell.module.css"), "utf8");
    expect(css).toMatch(/\.rowIcon svg,\s*\.rowIcon img \{[^}]*width: 24px;[^}]*height: 24px;[^}]*object-fit: contain;/);
  });

  it("keeps the desktop nav and its measuring copy text only", () => {
    stubReducedMotion();
    seed(withDestinations(), false, media);
    const { getByRole, getByTestId } = renderShell();
    const inline = getByRole("navigation", { name: "Pages" });
    expect(inline.textContent).toContain("About");
    expect(inline.textContent).toContain("Donate");
    expect(inline.querySelectorAll("a svg, a img")).toHaveLength(0);
    expect(getByTestId("nav-measure").querySelectorAll("a svg, a img")).toHaveLength(0);
    const links = Array.from(inline.querySelectorAll("a")).map((a) => a.textContent);
    expect(links).toContain("Track Santa");
  });
});
