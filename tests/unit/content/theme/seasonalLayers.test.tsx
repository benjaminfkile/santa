// docs/site.md section 7.7. The seasonal layers, the tracker's snow
// choice held for the live takeover only, and live-screen detection
// through `live.eventStatusId === 3` at `/`.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  LIVE_FLAKE_FILL,
  LIVE_FLAKE_OUTLINE,
  SnowLayer,
  LightsLayer,
  SNOW_KEY,
  setSnowOverride,
  clearSnowOverride,
  useSnowEnabled,
} from "../../../../src/content/theme/seasonalLayers";
import { store } from "../../../../src/store/useStore";
import { TRACKER_SETTINGS_KEY } from "../../../../src/content/sections/Map/trackerToggles";
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
  it("is stored with the tracker's other choices, never under the old key", () => {
    setSnowOverride(true);
    expect(window.localStorage.getItem(SNOW_KEY)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(TRACKER_SETTINGS_KEY) ?? "{}").snow).toBe(true);
    setSnowOverride(false);
    expect(JSON.parse(window.localStorage.getItem(TRACKER_SETTINGS_KEY) ?? "{}").snow).toBe(false);
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

describe("the snow choice outlives the live takeover", () => {
  function canvasIn(container: HTMLElement): Element | null {
    return container.querySelector('[data-testid="snow-canvas"]');
  }

  it("renders snowDefault once the event is not live and the stored choice again when it is", () => {
    seedLive(3);
    const bundle = bundleWithDefaults(false, false);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundle} />
      </MemoryRouter>,
    );
    expect(canvasIn(container)).toBeNull();
    act(() => setSnowOverride(true));
    expect(canvasIn(container)).not.toBeNull();

    act(() => {
      store.setState({ live: { ...store.getState().live!, eventStatusId: 4 } });
    });
    expect(canvasIn(container)).toBeNull();

    act(() => {
      store.setState({ live: { ...store.getState().live!, eventStatusId: 3 } });
    });
    expect(canvasIn(container)).not.toBeNull();
  });

  it("starts the live screen from a choice a previous page load stored", () => {
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify({ snow: true }));
    seedLive(3);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundleWithDefaults(false, false)} />
      </MemoryRouter>,
    );
    expect(canvasIn(container)).not.toBeNull();
  });

  it("ignores and removes the old key outside live, rendering snowDefault", () => {
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

  it("keeps snow off outside live when snowDefault is off, whatever was chosen", () => {
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify({ snow: true }));
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

describe("the snow canvas on a high density screen", () => {
  let frames: Map<number, FrameRequestCallback>;
  let visibility: DocumentVisibilityState;
  let snowCtx: { fill: ReturnType<typeof vi.fn>; stroke: ReturnType<typeof vi.fn>; fillStyle: string; strokeStyle: string };

  beforeEach(() => {
    frames = new Map();
    visibility = "visible";
    let nextId = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = nextId++;
      frames.set(id, cb);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    };
    snowCtx = ctx;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockReturnValue(390);
    vi.spyOn(HTMLCanvasElement.prototype, "clientHeight", "get").mockReturnValue(844);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
  });

  function renderSnow(): HTMLCanvasElement {
    seedLive(1);
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundleWithDefaults(true, false)} />
      </MemoryRouter>,
    );
    return container.querySelector('[data-testid="snow-canvas"]') as HTMLCanvasElement;
  }

  function runFrames(): void {
    act(() => {
      for (const cb of Array.from(frames.values())) cb(0);
    });
  }

  it("draws the map flakes white with a cool outline, about one per 22,000 square pixels", () => {
    seedLive(3);
    act(() => setSnowOverride(true));
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundleWithDefaults(false, false)} />
      </MemoryRouter>,
    );
    expect(container.querySelector("[data-testid=snow-canvas]")).not.toBeNull();
    runFrames();
    const perFrame = Math.floor((390 * 844) / 22000);
    expect(snowCtx.fillStyle).toBe(LIVE_FLAKE_FILL);
    expect(snowCtx.strokeStyle).toBe(LIVE_FLAKE_OUTLINE);
    expect(snowCtx.fill.mock.calls.length).toBeGreaterThan(0);
    expect(snowCtx.fill.mock.calls.length % perFrame).toBe(0);
    expect(snowCtx.stroke).toHaveBeenCalledTimes(snowCtx.fill.mock.calls.length);
    act(() => clearSnowOverride());
  });

  it("draws the page flakes in --snow with no outline, about one per 30,000 square pixels", () => {
    seedLive(2);
    document.documentElement.style.setProperty("--snow", "rgba(1, 2, 3, 0.5)");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SnowLayer bundle={bundleWithDefaults(true, false)} />
      </MemoryRouter>,
    );
    runFrames();
    document.documentElement.style.removeProperty("--snow");
    const perFrame = Math.floor((390 * 844) / 30000);
    expect(snowCtx.fillStyle).toBe("rgba(1, 2, 3, 0.5)");
    expect(snowCtx.fill.mock.calls.length).toBeGreaterThan(0);
    expect(snowCtx.fill.mock.calls.length % perFrame).toBe(0);
    expect(snowCtx.stroke).not.toHaveBeenCalled();
  });

  it("sizes the backing store at a device pixel ratio of 2, not 3", () => {
    const canvas = renderSnow();
    expect(canvas.width).toBe(780);
    expect(canvas.height).toBe(1688);
  });

  it("pauses its frame loop while the tab is hidden and resumes when shown", () => {
    renderSnow();
    expect(frames.size).toBe(1);
    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(frames.size).toBe(0);
    act(() => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(frames.size).toBe(1);
  });

  it("cancels its frame when it unmounts", () => {
    renderSnow();
    expect(frames.size).toBe(1);
    cleanup();
    expect(frames.size).toBe(0);
  });
});
