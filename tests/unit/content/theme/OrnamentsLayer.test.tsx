// docs/site.md section 7.7 and 22.1. The ornaments layer renders five
// SVG ornaments when the setting is on and the page is not live, none
// otherwise; each sphere carries one of the five --orn-* token colours;
// the layer is dimmed through `--orn-opacity` and its top offset follows
// the shell's `--header-height`; below 640 px the whole layer scales to
// 0.5 through the module's media query; the sway class is absent under
// reduced motion.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrnamentsLayer } from "../../../../src/content/theme/OrnamentsLayer";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_CSS = readFileSync(
  resolve(HERE, "../../../../src/content/theme/OrnamentsLayer.module.css"),
  "utf8",
);
const TOKENS_CSS = readFileSync(
  resolve(HERE, "../../../../src/content/theme/tokens.css"),
  "utf8",
);

function seedLive(eventStatusId: number | null): void {
  act(() => {
    store.setState({
      ...initialStore,
      live: eventStatusId === null
        ? null
        : {
            schemaVersion: 1,
            eventId: 1,
            eventStatusId,
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

function bundleWith(ornaments: boolean): ContentBundle {
  return {
    content: {
      schemaVersion: 1,
      settings: {
        siteName: "WMSFO",
        tagline: null,
        homeNavLabel: "Home",
        logo: null,
        favicon: null,
        theme: { snowDefault: false, lightsDefault: false, ornaments },
        navExtraLinks: [],
        footerLinks: [],
        footerText: null,
        contactEmail: null,
        donateUrl: null,
        analyticsEnabled: false,
      },
      pages: [],
    } as unknown as ContentBundle["content"],
    media: {},
    icons: {},
  };
}

function mockReducedMotion(reduce: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reduce : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  window.localStorage.clear();
  act(() => {
    store.setState({ ...initialStore });
  });
  mockReducedMotion(false);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  act(() => {
    store.setState({ ...initialStore });
  });
  window.matchMedia = originalMatchMedia;
});

describe("OrnamentsLayer", () => {
  it("renders five ornaments when the setting is on and the page is not live", () => {
    seedLive(1);
    const bundle = bundleWith(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    const layer = container.querySelector('[data-testid="ornaments-layer"]');
    expect(layer).not.toBeNull();
    const ornaments = container.querySelectorAll('[data-testid^="ornament-"][data-sway]');
    expect(ornaments).toHaveLength(5);
  });

  it("renders nothing when the setting is off", () => {
    seedLive(1);
    const bundle = bundleWith(false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="ornaments-layer"]')).toBeNull();
  });

  it("renders nothing on the live screen (eventStatusId === 3)", () => {
    seedLive(3);
    const bundle = bundleWith(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="ornaments-layer"]')).toBeNull();
  });

  it("renders nothing when the bundle is null", () => {
    seedLive(1);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={null} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="ornaments-layer"]')).toBeNull();
  });

  it("each sphere carries one of the five --orn-* token colours", () => {
    seedLive(1);
    const bundle = bundleWith(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    const colors = ["red", "green", "blue", "gold", "frost"] as const;
    for (const c of colors) {
      const sphere = container.querySelector(`[data-orn-color="${c}"]`);
      expect(sphere, `expected a sphere with data-orn-color="${c}"`).not.toBeNull();
    }
    const spheres = container.querySelectorAll("[data-orn-color]");
    expect(spheres).toHaveLength(5);
  });

  it("the sway class is absent under reduced motion", () => {
    mockReducedMotion(true);
    seedLive(1);
    const bundle = bundleWith(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    const ornaments = Array.from(container.querySelectorAll("[data-sway]"));
    expect(ornaments).toHaveLength(5);
    for (const o of ornaments) {
      expect(o.getAttribute("data-sway")).toBe("off");
    }
  });

  it("the sway class is present when motion is allowed", () => {
    mockReducedMotion(false);
    seedLive(1);
    const bundle = bundleWith(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    const ornaments = Array.from(container.querySelectorAll("[data-sway]"));
    expect(ornaments).toHaveLength(5);
    for (const o of ornaments) {
      expect(o.getAttribute("data-sway")).toBe("on");
    }
  });

  it("the layer carries the --orn-opacity token and its top offset follows --header-height", () => {
    seedLive(1);
    const bundle = bundleWith(true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <OrnamentsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    const layer = container.querySelector<HTMLElement>('[data-testid="ornaments-layer"]');
    expect(layer).not.toBeNull();
    expect(layer!.style.opacity).toBe("var(--orn-opacity)");
    expect(layer!.style.top).toBe("var(--header-height, 0px)");
  });

  it("the opacity token is 0.55 in light, 0.4 in dark, and 0.3 below 640 px", () => {
    expect(TOKENS_CSS).toMatch(/:root\[data-theme="light"\][^}]*--orn-opacity:\s*0\.55/s);
    expect(TOKENS_CSS).toMatch(/:root\[data-theme="dark"\][^}]*--orn-opacity:\s*0\.4/s);
    expect(TOKENS_CSS).toMatch(/@media \(max-width:\s*640px\)[^{]*\{[^}]*\{[^}]*--orn-opacity:\s*0\.3/s);
  });

  it("scales the whole layer to 0.5 below 640 px", () => {
    const phoneBlock = MODULE_CSS.match(/@media\s*\(max-width:\s*640px\)\s*\{[^}]*\.ornament\s*\{[^}]*transform:\s*scale\(([^)]+)\)/);
    expect(phoneBlock).not.toBeNull();
    expect(phoneBlock![1]).toBe("0.5");
    expect(MODULE_CSS).toMatch(/@keyframes ornaments-sway-small[^}]*scale\(0\.5\)/s);
  });

});
