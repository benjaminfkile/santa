// docs/site.md sections 8.9, 22.1. The route map timeline with MapLibre
// and pmtiles mocked:
//  - A timed route renders no range input and no Santa pin; the start
//    marker (the star flag and its "Starts here" label, anchored at its
//    bottom) stands on the path's first point, the style draws the end
//    circle without the start circle, and the region label speaks the
//    start. No wall clock appears even when the event has a scheduledAt.
//  - The style's time labels are exactly the interior multiples of 15
//    minutes, in the "1h 15m" form.
//  - The marks source holds every timeline entry.
//  - A timeline of fewer than two entries keeps the path and the start
//    marker and shows no marks.
//  - The event's `routeMapConfig.pois.kinds` and the site settings'
//    `landmarks` reach the style as its POI kind filter and its landmark
//    labels; without them, or with them in the section data only, the
//    style has neither.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { env } from "../../../../src/config/env";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import {
  formatElapsed,
  routeMapTimeline,
  routeTimeLabels,
} from "../../../../src/content/sections/RoutePreview/routeTimelineData";
import { copy } from "../../../../src/copy/copy";

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
};

type FakeMarkerInstance = {
  element: HTMLElement | undefined;
  anchor: string | undefined;
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
    anchor: string | undefined;
    constructor(options: { element?: HTMLElement; anchor?: string }) {
      this.element = options.element;
      this.anchor = options.anchor;
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
function buildBundle(settings: Record<string, unknown> = {}): ContentBundle {
  return {
    content: { pages: [], nav: [], settings } as unknown as ContentDocument,
    media: {},
    icons: {},
  } as unknown as ContentBundle;
}

function setEvent(
  scheduledAt: string | null,
  timeline: unknown[],
  routeMapConfig: Record<string, unknown> | null = null,
): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        scheduledAt,
        routeMap: { path: PATH, timeline, durationMinutes: 72, timed: true },
        routeMapConfig,
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

function renderSection(
  data: Record<string, unknown> = {},
  settings: Record<string, unknown> = {},
) {
  return render(
    <MemoryRouter>
      <RoutePreview data={data} items={[]} bundle={buildBundle(settings)} />
    </MemoryRouter>,
  );
}

function indexOfMinutes(minutes: number): number {
  return LONG_TIMELINE.findIndex((e) => e.minutes === minutes);
}

type StyleShape = {
  sources: Record<string, { data?: unknown }>;
  layers: { id: string; filter?: unknown }[];
};

// The style the map shows now: the last one set, else the one it was
// created with.
function currentStyle(): StyleShape {
  const map = mocks.maps[0];
  const calls = map.setStyle.mock.calls;
  return (calls.length > 0 ? calls[calls.length - 1][0] : map.options.style) as StyleShape;
}

function markCoordinates(style: StyleShape): number[][] {
  const data = style.sources["route-marks"].data as { features: { geometry: { coordinates: number[] } }[] };
  return data.features.map((f) => f.geometry.coordinates);
}

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.markers.length = 0;
  mutableEnv.ROUTE_BASEMAP_URL = "https://cdn.example/basemap";
  document.documentElement.setAttribute("data-theme", "light");
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
  mutableEnv.ROUTE_BASEMAP_URL = originalBasemap;
  document.documentElement.removeAttribute("data-theme");
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
  it("renders no slider and no Santa pin, and marks the start with the star flag and its label", async () => {
    setEvent(null, LONG_TIMELINE);
    const { container } = renderSection();
    await settle();
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.querySelector('[data-testid="route-timeline"]')).toBeNull();
    expect(container.querySelector('[data-testid="route-map-pin"]')).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(mocks.markers).toHaveLength(1);
    const marker = mocks.markers[0];
    expect(marker.added).toBe(true);
    expect(marker.anchor).toBe("bottom");
    expect(marker.lngLats[marker.lngLats.length - 1]).toEqual([PATH[0].lng, PATH[0].lat]);
    const el = marker.element!;
    expect(el.getAttribute("data-testid")).toBe("route-map-start");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelector("img")).toBeNull();
    const svg = el.querySelector("svg")!;
    expect(svg.getAttribute("height")).toBe("36");
    expect(svg.querySelector('[fill="var(--gold)"]')).not.toBeNull();
    const label = el.querySelector('[data-testid="route-map-start-label"]');
    expect(label?.textContent).toBe(copy.map.routeStart);
    expect(label?.textContent).toBe("Starts here");
    const region = container.querySelector('[data-testid="route-map"]');
    expect(region?.getAttribute("aria-label")).toBe(
      "Santa's planned route; the star marks where he starts",
    );
  });

  it("draws the end circle and leaves the start to the marker", async () => {
    setEvent(null, TIMELINE);
    renderSection();
    await settle();
    const style = mocks.maps[0].options.style as StyleShape;
    const ends = style.sources["route-ends"].data as {
      features: { properties: { end: string }; geometry: { coordinates: number[] } }[];
    };
    expect(ends.features.map((f) => f.properties.end)).toEqual(["end"]);
    expect(ends.features[0].geometry.coordinates).toEqual([PATH[2].lng, PATH[2].lat]);
    expect(style.layers.some((l) => l.id === "route-ends")).toBe(true);
  });

  it("shows no wall clock time for an event with a scheduledAt", async () => {
    setEvent(SCHEDULED_AT, TIMELINE);
    const { container } = renderSection();
    await settle();
    const stage = container.querySelector('[data-testid="route-map-stage"]')?.textContent ?? "";
    expect(stage).not.toMatch(/AM|PM|Dec|:\d\d/);
    expect(mocks.markers[0].element?.textContent).not.toMatch(/AM|PM|Dec|:\d\d/);
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

  it("keeps the path and the start marker and hides the marks with fewer than two entries", async () => {
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
      expect(mocks.markers).toHaveLength(1);
      expect(mocks.markers[0].element?.getAttribute("data-testid")).toBe("route-map-start");
      expect(mocks.markers[0].lngLats[0]).toEqual([PATH[0].lng, PATH[0].lat]);
      cleanup();
    }
  });
});

describe("route map POI kinds and landmarks", () => {
  it("passes the config's POI kinds and the settings' landmarks into the style", async () => {
    setEvent(null, TIMELINE, { pois: { kinds: ["peak", "museum"] } });
    renderSection(undefined, {
      landmarks: [
        { name: "Mount Jumbo", lat: 46.88, lng: -113.96 },
        { name: "Caras Park", lat: 46.87, lng: -113.99 },
      ],
    });
    await settle();
    expect(mocks.maps).toHaveLength(1);
    for (const style of [mocks.maps[0].options.style as StyleShape, currentStyle()]) {
      const pois = style.layers.find((l) => l.id === "pois");
      expect(pois).toBeDefined();
      expect(JSON.stringify(pois?.filter)).toContain('["literal",["peak","museum"]]');
      const data = style.sources["route-landmarks"].data as {
        features: { properties: { label: string }; geometry: { coordinates: number[] } }[];
      };
      expect(data.features.map((f) => f.properties.label)).toEqual(["Mount Jumbo", "Caras Park"]);
      expect(data.features[0].geometry.coordinates).toEqual([-113.96, 46.88]);
      expect(style.layers.some((l) => l.id === "route-landmarks")).toBe(true);
      expect(style.layers.some((l) => l.id === "route-time-labels")).toBe(true);
    }
    expect(markCoordinates(currentStyle())).toHaveLength(TIMELINE.length);
  });

  it("drops the POI layers for an empty kind list", async () => {
    setEvent(null, TIMELINE, { pois: { kinds: [] } });
    renderSection();
    await settle();
    expect(currentStyle().layers.some((l) => l.id === "pois")).toBe(false);
  });

  it("passes neither without them in the config and the settings", async () => {
    setEvent(null, TIMELINE);
    renderSection();
    await settle();
    const style = currentStyle();
    expect(style.layers.some((l) => l.id === "pois")).toBe(false);
    expect(style.sources["route-landmarks"]).toBeUndefined();
    expect(style.layers.some((l) => l.id.startsWith("route-landmark"))).toBe(false);
  });

  it("passes neither with them in the section data only", async () => {
    setEvent(null, TIMELINE);
    renderSection({
      pois: { kinds: ["peak"] },
      landmarks: [{ name: "Mount Jumbo", lat: 46.88, lng: -113.96 }],
    });
    await settle();
    const style = currentStyle();
    expect(style.layers.some((l) => l.id === "pois")).toBe(false);
    expect(style.sources["route-landmarks"]).toBeUndefined();
  });
});
