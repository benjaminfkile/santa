// docs/site.md section 7.7 and S17f. Nine test surfaces for the seasonal
// layers, the tracker's snow button wiring, and live-screen detection
// through `live.eventStatusId === 3` at `/`.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  SnowLayer,
  LightsLayer,
  SNOW_KEY,
  LIGHTS_KEY,
  setSnowOverride,
  setLightsOverride,
  useSnowEnabled,
  useLightsEnabled,
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
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("seasonal layer storage keys and defaults", () => {
  it("stores the snow override under wmsfo.snow", () => {
    setSnowOverride(true);
    expect(window.localStorage.getItem(SNOW_KEY)).toBe("on");
    setSnowOverride(false);
    expect(window.localStorage.getItem(SNOW_KEY)).toBe("off");
  });

  it("stores the lights override under wmsfo.lights", () => {
    setLightsOverride(true);
    expect(window.localStorage.getItem(LIGHTS_KEY)).toBe("on");
    setLightsOverride(false);
    expect(window.localStorage.getItem(LIGHTS_KEY)).toBe("off");
  });

  it("useSnowEnabled prefers the stored value over the site default", () => {
    setSnowOverride(true);
    let seen: boolean | null = null;
    function Probe() {
      seen = useSnowEnabled(false);
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    expect(seen).toBe(true);
    cleanup();
    setSnowOverride(false);
    let seen2: boolean | null = null;
    function Probe2() {
      seen2 = useSnowEnabled(true);
      return null;
    }
    render(
      <MemoryRouter>
        <Probe2 />
      </MemoryRouter>,
    );
    expect(seen2).toBe(false);
  });

  it("useLightsEnabled prefers the stored value over the site default", () => {
    setLightsOverride(true);
    let seen: boolean | null = null;
    function Probe() {
      seen = useLightsEnabled(false);
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
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
