// docs/site.md section 7.7. The seasonal layers, the tracker's snow
// choice held for the live takeover only, and live-screen detection
// through `live.eventStatusId === 3` at `/`.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  SnowLayer,
  LightsLayer,
  SNOW_KEY,
  setSnowOverride,
  clearSnowOverride,
  useSnowEnabled,
} from "../../../../src/content/theme/seasonalLayers";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";

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

function bundleWithDefaults(snowDefault: boolean, lightsDefault: boolean): ContentBundle {
  return {
    content: {
      schemaVersion: 1,
      settings: {
        siteName: "WMSFO",
        tagline: null,
        homeNavLabel: "Home",
        logo: null,
        favicon: null,
        theme: { snowDefault, lightsDefault },
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

beforeEach(() => {
  window.localStorage.clear();
  clearSnowOverride();
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  clearSnowOverride();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("the live snow choice", () => {
  it("is held in memory and never written to localStorage", () => {
    setSnowOverride(true);
    expect(window.localStorage.getItem(SNOW_KEY)).toBeNull();
    setSnowOverride(false);
    expect(window.localStorage.getItem(SNOW_KEY)).toBeNull();
  });

  it("useSnowEnabled prefers the choice over the default until it is cleared", () => {
    let seen: boolean | null = null;
    function Probe({ defaultOn }: { defaultOn: boolean }) {
      seen = useSnowEnabled(defaultOn);
      return null;
    }
    render(<Probe defaultOn={false} />);
    expect(seen).toBe(false);
    act(() => setSnowOverride(true));
    expect(seen).toBe(true);
    cleanup();
    render(<Probe defaultOn={true} />);
    act(() => setSnowOverride(false));
    expect(seen).toBe(false);
    act(() => clearSnowOverride());
    expect(seen).toBe(true);
  });
});

describe("SnowLayer live-screen detection", () => {
  it("is off by default on the live screen (eventStatusId === 3 at /)", () => {
    seedLive(3);
    const bundle = bundleWithDefaults(true, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="snow-canvas"]')).toBeNull();
  });

  it("honours the site default off the live screen", () => {
    seedLive(1);
    const bundle = bundleWithDefaults(true, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="snow-canvas"]')).not.toBeNull();
  });

  it("respects the visitor override on the live screen", () => {
    seedLive(3);
    setSnowOverride(true);
    const bundle = bundleWithDefaults(false, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="snow-canvas"]')).not.toBeNull();
  });
});

describe("the snow choice ends with the live takeover", () => {
  function canvasIn(container: HTMLElement): Element | null {
    return container.querySelector('[data-testid="snow-canvas"]');
  }

  it("renders snowDefault once the event is not live, whatever was chosen on the tracker", () => {
    seedLive(3);
    const bundle = bundleWithDefaults(true, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    act(() => setSnowOverride(true));
    expect(canvasIn(container)).not.toBeNull();
    act(() => setSnowOverride(false));
    expect(canvasIn(container)).toBeNull();

    act(() => {
      store.setState({ live: { ...store.getState().live!, eventStatusId: 4 } });
    });
    expect(canvasIn(container)).not.toBeNull();

    // A later takeover starts from the live default again, not the old choice.
    act(() => {
      store.setState({ live: { ...store.getState().live!, eventStatusId: 3 } });
    });
    expect(canvasIn(container)).toBeNull();
  });

  it("ignores and removes a stored off outside live, rendering snowDefault", () => {
    window.localStorage.setItem(SNOW_KEY, "off");
    seedLive(1);
    const bundle = bundleWithDefaults(true, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(canvasIn(container)).not.toBeNull();
    expect(window.localStorage.getItem(SNOW_KEY)).toBeNull();
  });

  it("keeps snow off outside live when snowDefault is off, whatever was stored", () => {
    window.localStorage.setItem(SNOW_KEY, "on");
    seedLive(1);
    const bundle = bundleWithDefaults(false, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(canvasIn(container)).toBeNull();
  });
});

describe("LightsLayer live-screen detection", () => {
  it("does not render over the map on the live screen (eventStatusId === 3 at /)", () => {
    seedLive(3);
    const bundle = bundleWithDefaults(false, true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <LightsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="site-lights"]')).toBeNull();
  });

  it("renders under the header off the live screen when the site default is on", () => {
    seedLive(1);
    const bundle = bundleWithDefaults(false, true);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <LightsLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="site-lights"]')).not.toBeNull();
  });
});
