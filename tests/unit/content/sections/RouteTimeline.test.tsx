// docs/site.md sections 8.9, 17, 22.1. The route map timeline with
// MapLibre and pmtiles mocked:
//  - The slider has min 0, one step per timeline entry, and starts at 0;
//    the arrow keys step one entry and Home and End reach the ends.
//  - The time label and aria-valuetext are the elapsed flight time
//    ("1h 15m into the flight"), with no wall clock even when the event
//    has a scheduledAt.
//  - The style's time labels are exactly the interior multiples of 15
//    minutes, in the "1h 15m" form.
//  - The marks source holds every timeline entry; the Santa pin starts on
//    the first entry and follows the slider.
//  - The pin eases between entries, and moves at once under reduced motion.
//  - A timeline of fewer than two entries keeps the path and shows no
//    marks, slider, or pin.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { env } from "../../../../src/config/env";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import {
  formatElapsed,
  routeMapTimeline,
  routeTimeLabel,
  routeTimeLabels,
} from "../../../../src/content/sections/RoutePreview/routeTimelineData";
import { PIN_TRANSITION_MS } from "../../../../src/routeMap";

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
};

type FakeMarkerInstance = {
  element: HTMLElement | undefined;
  lngLats: [number, number][];
  added: boolean;
  removed: boolean;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
  markers: [] as FakeMarkerInstance[],
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    setStyle = vi.fn();
    fitBounds = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.maps.push(this as unknown as FakeMapInstance);
    }
    on() {
      return this;
    }
    once() {
      return this;
    }
  }
  class FakeMarker {
    element: HTMLElement | undefined;
    lngLats: [number, number][] = [];
    added = false;
    removed = false;
    constructor(options: { element?: HTMLElement }) {
      this.element = options.element;
      mocks.markers.push(this);
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLats.push(lngLat);
      return this;
    }
    addTo() {
      this.added = true;
      return this;
    }
    remove() {
      this.removed = true;
    }
  }
  return { Map: FakeMap, Marker: FakeMarker, addProtocol: vi.fn(), setWorkerUrl: vi.fn() };
});

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));

vi.mock("pmtiles", () => {
  class PMTiles {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    async getHeader() {
      return { minZoom: 0, maxZoom: 15 };
    }
  }
  class Protocol {
    tiles = new Map<string, PMTiles>();
    tile = vi.fn();
    add(p: PMTiles) {
      this.tiles.set(p.url, p);
    }
    get(url: string) {
      return this.tiles.get(url);
    }
  }
  return { PMTiles, Protocol };
});

const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];

const TIMELINE = [
  { minutes: 0, lat: 46.87, lng: -114.0 },
  { minutes: 5, lat: 46.88, lng: -113.98 },
  { minutes: 10, lat: 46.9, lng: -113.95 },
  { minutes: 15, lat: 46.87, lng: -113.92 },
  { minutes: 72, lat: 46.85, lng: -113.9 },
];

// Every 5 minutes from liftoff to 90, then the last point at 93.
const LONG_TIMELINE = [
  ...Array.from({ length: 19 }, (_, i) => ({
    minutes: i * 5,
    lat: 46.8 + i * 0.01,
    lng: -114.0 + i * 0.01,
  })),
  { minutes: 93, lat: 47.0, lng: -113.8 },
];

const SCHEDULED_AT = "2026-12-22T01:00:00.000Z";

const mutableEnv = env as unknown as { ROUTE_BASEMAP_URL: string };
const originalBasemap = mutableEnv.ROUTE_BASEMAP_URL;
const originalMatchMedia = window.matchMedia;
const originalRaf = window.requestAnimationFrame;
const originalCaf = window.cancelAnimationFrame;

let frames: FrameRequestCallback[] = [];

function flushFrame(time: number): void {
  const queued = frames;
  frames = [];
  for (const cb of queued) cb(time);
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

function buildBundle(): ContentBundle {
  return {
    content: { pages: [], nav: [] } as unknown as ContentDocument,
    media: {},
    icons: {},
  } as unknown as ContentBundle;
}

function setEvent(scheduledAt: string | null, timeline: unknown[]): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        scheduledAt,
        routeImageMediaId: null,
        routeMap: { path: PATH, timeline, durationMinutes: 72, timed: true },
      },
    } as unknown as Snapshot,
  }));
}

async function settle(): Promise<void> {
  await act(async () => {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

function renderSection() {
  return render(
    <MemoryRouter>
      <RoutePreview data={{ style: "map" }} items={[]} bundle={buildBundle()} />
    </MemoryRouter>,
  );
}

function slider(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>('[data-testid="route-timeline-slider"]');
  expect(el).not.toBeNull();
  return el!;
}

function label(container: HTMLElement): string {
  return container.querySelector('[data-testid="route-timeline-label"]')?.textContent ?? "";
}

function indexOfMinutes(minutes: number): number {
  return LONG_TIMELINE.findIndex((e) => e.minutes === minutes);
}

type StyleShape = {
  sources: Record<string, { data?: unknown }>;
  layers: { id: string }[];
};

function markCoordinates(style: StyleShape): number[][] {
  const data = style.sources["route-marks"].data as { features: { geometry: { coordinates: number[] } }[] };
  return data.features.map((f) => f.geometry.coordinates);
}

function lastLngLat(): [number, number] | undefined {
  const marker = mocks.markers[0];
  return marker?.lngLats[marker.lngLats.length - 1];
}

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.markers.length = 0;
  frames = [];
  mutableEnv.ROUTE_BASEMAP_URL = "https://cdn.example/basemap";
  document.documentElement.setAttribute("data-theme", "light");
  mockReducedMotion(false);
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => {
    frames = [];
  }) as typeof window.cancelAnimationFrame;
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
  mutableEnv.ROUTE_BASEMAP_URL = originalBasemap;
  document.documentElement.removeAttribute("data-theme");
  window.matchMedia = originalMatchMedia;
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCaf;
  vi.restoreAllMocks();
});

describe("route timeline data", () => {
  it("keeps entries with numeric fields, in minute order", () => {
    const entries = routeMapTimeline({
      timeline: [
        { minutes: 10, lat: 1, lng: 2 },
        { minutes: 0, lat: 3, lng: 4 },
        { minutes: 5, lat: Number.NaN, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    });
    expect(entries).toEqual([
      { minutes: 0, lat: 3, lng: 4 },
      { minutes: 10, lat: 1, lng: 2 },
    ]);
  });

  it("formats elapsed minutes as minutes under an hour and hours plus minutes after", () => {
    expect(formatElapsed(0)).toBe("0m");
    expect(formatElapsed(5)).toBe("5m");
    expect(formatElapsed(45)).toBe("45m");
    expect(formatElapsed(60)).toBe("1h 0m");
    expect(formatElapsed(75)).toBe("1h 15m");
    expect(formatElapsed(605)).toBe("10h 5m");
    expect(routeTimeLabel(0)).toBe("0m into the flight");
    expect(routeTimeLabel(45)).toBe("45m into the flight");
    expect(routeTimeLabel(75)).toBe("1h 15m into the flight");
  });

  it("labels every interior multiple of 15 minutes, never minute 0 or the final entry", () => {
    expect(routeTimeLabels(LONG_TIMELINE).map((l) => l.label)).toEqual([
      "15m",
      "30m",
      "45m",
      "1h 0m",
      "1h 15m",
      "1h 30m",
    ]);
    const endsOnFifteen = LONG_TIMELINE.slice(0, 19);
    expect(endsOnFifteen[endsOnFifteen.length - 1].minutes).toBe(90);
    expect(routeTimeLabels(endsOnFifteen).map((l) => l.label)).toEqual([
      "15m",
      "30m",
      "45m",
      "1h 0m",
      "1h 15m",
    ]);
  });
});

describe("route map timeline", () => {
  it("starts at 0 with min 0 and one 5 minute step per entry", async () => {
    setEvent(null, LONG_TIMELINE);
    const { container } = renderSection();
    await settle();
    const input = slider(container);
    expect(input.min).toBe("0");
    expect(input.max).toBe(String(LONG_TIMELINE.length - 1));
    expect(input.step).toBe("1");
    expect(input.value).toBe("0");
    expect(label(container)).toBe("0m into the flight");
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(slider(container).value).toBe("1");
    expect(label(container)).toBe("5m into the flight");
  });

  it("has one slider step per timeline entry, with Home and End reaching the ends", async () => {
    setEvent(null, TIMELINE);
    const { container } = renderSection();
    await settle();
    const input = slider(container);
    expect(input.type).toBe("range");
    expect(input.min).toBe("0");
    expect(input.max).toBe(String(TIMELINE.length - 1));
    expect(input.step).toBe("1");
    expect(input.value).toBe("0");
    expect(input.getAttribute("aria-label")).toBeTruthy();

    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(slider(container).value).toBe("1");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(slider(container).value).toBe("2");
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(slider(container).value).toBe("1");
    fireEvent.keyDown(input, { key: "End" });
    expect(slider(container).value).toBe(String(TIMELINE.length - 1));
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(slider(container).value).toBe(String(TIMELINE.length - 1));
    fireEvent.keyDown(input, { key: "Home" });
    expect(slider(container).value).toBe("0");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(slider(container).value).toBe("0");

    fireEvent.change(input, { target: { value: "3" } });
    expect(slider(container).value).toBe("3");
  });

  it("speaks elapsed flight time in the label and aria-valuetext", async () => {
    setEvent(null, LONG_TIMELINE);
    const { container } = renderSection();
    await settle();
    const expectAt = (text: string) => {
      expect(label(container)).toBe(text);
      expect(slider(container).getAttribute("aria-valuetext")).toBe(text);
    };
    expectAt("0m into the flight");
    fireEvent.change(slider(container), { target: { value: String(indexOfMinutes(45)) } });
    expectAt("45m into the flight");
    fireEvent.change(slider(container), { target: { value: String(indexOfMinutes(75)) } });
    expectAt("1h 15m into the flight");
    fireEvent.keyDown(slider(container), { key: "End" });
    expectAt("1h 33m into the flight");
  });

  it("shows no wall clock time for an event with a scheduledAt", async () => {
    setEvent(SCHEDULED_AT, TIMELINE);
    const { container } = renderSection();
    await settle();
    const stage = () => container.querySelector('[data-testid="route-map-stage"]')?.textContent ?? "";
    expect(label(container)).toBe("0m into the flight");
    expect(stage()).not.toMatch(/AM|PM|Dec|:\d\d/);
    fireEvent.keyDown(slider(container), { key: "End" });
    expect(label(container)).toBe("1h 12m into the flight");
    expect(slider(container).getAttribute("aria-valuetext")).toBe("1h 12m into the flight");
    expect(stage()).not.toMatch(/AM|PM|Dec|:\d\d/);
  });

  it("passes the style a time label at every interior multiple of 15 minutes", async () => {
    setEvent(SCHEDULED_AT, LONG_TIMELINE);
    renderSection();
    await settle();
    const style = mocks.maps[0].options.style as StyleShape;
    const data = style.sources["route-time-labels"].data as {
      features: { properties: { label: string }; geometry: { coordinates: number[] } }[];
    };
    const expected = [15, 30, 45, 60, 75, 90].map((m) => LONG_TIMELINE[indexOfMinutes(m)]);
    expect(data.features.map((f) => f.properties.label)).toEqual([
      "15m",
      "30m",
      "45m",
      "1h 0m",
      "1h 15m",
      "1h 30m",
    ]);
    expect(data.features.map((f) => f.geometry.coordinates)).toEqual(
      expected.map((e) => [e.lng, e.lat]),
    );
    const ids = style.layers.map((l) => l.id);
    expect(ids).toContain("route-time-label-dots");
    expect(ids).toContain("route-time-labels");
    expect(markCoordinates(style)).toEqual(LONG_TIMELINE.map((e) => [e.lng, e.lat]));
  });

  it("labels the style at 15 only when the timeline reaches past it", async () => {
    setEvent(null, TIMELINE);
    renderSection();
    await settle();
    const style = mocks.maps[0].options.style as StyleShape;
    const data = style.sources["route-time-labels"].data as {
      features: { properties: { label: string } }[];
    };
    expect(data.features.map((f) => f.properties.label)).toEqual(["15m"]);
  });

  it("draws a mark at every entry, above the path and below the end markers", async () => {
    setEvent(null, TIMELINE);
    renderSection();
    await settle();
    const style = mocks.maps[0].options.style as StyleShape;
    expect(markCoordinates(style)).toEqual(TIMELINE.map((e) => [e.lng, e.lat]));
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf("route-marks")).toBeGreaterThan(ids.indexOf("route-line"));
    expect(ids.indexOf("route-marks")).toBeLessThan(ids.indexOf("route-ends"));
  });

  it("stands the pin on the first entry and moves it to the entry the slider selects", async () => {
    setEvent(null, TIMELINE);
    const { container } = renderSection();
    await settle();
    expect(mocks.markers).toHaveLength(1);
    const marker = mocks.markers[0];
    expect(marker.added).toBe(true);
    expect(marker.element?.getAttribute("data-testid")).toBe("route-map-pin");
    expect(marker.element?.querySelector("svg")).not.toBeNull();
    expect(lastLngLat()).toEqual([TIMELINE[0].lng, TIMELINE[0].lat]);

    fireEvent.keyDown(slider(container), { key: "ArrowRight" });
    flushFrame(1000);
    flushFrame(1000 + PIN_TRANSITION_MS);
    expect(lastLngLat()).toEqual([TIMELINE[1].lng, TIMELINE[1].lat]);

    fireEvent.keyDown(slider(container), { key: "End" });
    flushFrame(2000);
    flushFrame(2000 + PIN_TRANSITION_MS);
    expect(lastLngLat()).toEqual([TIMELINE[4].lng, TIMELINE[4].lat]);
    expect(mocks.markers).toHaveLength(1);
  });

  it("eases the pin between entries", async () => {
    setEvent(null, TIMELINE);
    const { container } = renderSection();
    await settle();
    const marker = mocks.markers[0];
    const before = marker.lngLats.length;
    fireEvent.keyDown(slider(container), { key: "End" });
    expect(marker.lngLats).toHaveLength(before);
    expect(frames).toHaveLength(1);
    flushFrame(1000);
    flushFrame(1000 + PIN_TRANSITION_MS / 2);
    const [lng, lat] = lastLngLat()!;
    expect(lng).toBeGreaterThan(TIMELINE[0].lng);
    expect(lng).toBeLessThan(TIMELINE[4].lng);
    expect(lat).not.toBe(TIMELINE[4].lat);
    flushFrame(1000 + PIN_TRANSITION_MS);
    expect(lastLngLat()).toEqual([TIMELINE[4].lng, TIMELINE[4].lat]);
    expect(frames).toHaveLength(0);
  });

  it("moves the pin at once under reduced motion", async () => {
    mockReducedMotion(true);
    setEvent(null, TIMELINE);
    const { container } = renderSection();
    await settle();
    const marker = mocks.markers[0];
    const before = marker.lngLats.length;
    fireEvent.keyDown(slider(container), { key: "End" });
    expect(frames).toHaveLength(0);
    expect(marker.lngLats).toHaveLength(before + 1);
    expect(lastLngLat()).toEqual([TIMELINE[4].lng, TIMELINE[4].lat]);
  });

  it("keeps the path and hides the marks, slider, and pin with fewer than two entries", async () => {
    for (const timeline of [[], [TIMELINE[0]]]) {
      mocks.maps.length = 0;
      mocks.markers.length = 0;
      setEvent(SCHEDULED_AT, timeline);
      const { container } = renderSection();
      await settle();
      expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="route-timeline"]')).toBeNull();
      const style = mocks.maps[0].options.style as StyleShape;
      const line = style.sources.route.data as { geometry: { coordinates: number[][] } };
      expect(line.geometry.coordinates).toEqual(PATH.map((p) => [p.lng, p.lat]));
      expect(markCoordinates(style)).toEqual([]);
      expect(mocks.markers).toHaveLength(0);
      cleanup();
    }
  });
});
