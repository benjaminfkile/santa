// docs/site.md section 8.9. The route map's config, landmark markers,
// and gestures, with MapLibre and pmtiles mocked:
//  - Every input comes from the event's `routeMapConfig`: each of the
//    five display values (time label interval, arrows, arrow size, route
//    width, label size) resolves from the config's `display`, then the
//    default (15, true, medium, normal, medium), and reaches the style:
//    the labels at the interval's interior multiples (none at 0), the
//    arrow layer and its scale, the route line width, and the label
//    sizes. The controls default to true and
//    the POI kinds to none.
//  - The landmarks come from the site settings' `landmarks`, none when
//    absent; a raw config that still carries `landmarks` draws none.
//  - A null or absent config renders the default map. Display, controls,
//    landmarks, or POI kinds in the section data, or a routeMap block in
//    the site settings, change nothing.
//  - The named sizes map to scales through one table.
//  - A landmark with an icon stands a badge marker (a library icon
//    inline, a media icon through an image) and has no style dot; a
//    landmark with a description stands a button that opens its popover,
//    one at a time, closed by its close button, Escape, a tap elsewhere,
//    and its own button again; plain landmarks get no marker and stay as
//    the style draws them. The popover holds a "Get directions" link to
//    the landmark's point in a new tab: Apple Maps on an Apple touch
//    device, Google Maps everywhere else.
//  - The map is created without cooperativeGestures.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { env } from "../../../../src/config/env";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import {
  DISPLAY_DEFAULTS,
  DISPLAY_SCALES,
  resolveLandmarks,
  resolveRouteMapConfig,
  resolveRouteMapDisplay,
} from "../../../../src/content/sections/RoutePreview/routeMapConfig";
import { routeTimeLabels } from "../../../../src/content/sections/RoutePreview/routeTimelineData";

type Handler = (event: unknown) => void;

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  handlers: Map<string, Handler[]>;
};

type FakeMarkerInstance = {
  element: HTMLElement | undefined;
  lngLats: [number, number][];
  removed: boolean;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
  markers: [] as FakeMarkerInstance[],
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    handlers = new Map<string, Handler[]>();
    images = new Set<string>();
    setStyle = vi.fn();
    fitBounds = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    addImage = vi.fn((id: string) => {
      this.images.add(id);
    });
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.maps.push(this as unknown as FakeMapInstance);
    }
    hasImage(id: string) {
      return this.images.has(id);
    }
    on(name: string, handler: Handler) {
      this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
      return this;
    }
    once() {
      return this;
    }
  }
  class FakeMarker {
    element: HTMLElement | undefined;
    lngLats: [number, number][] = [];
    removed = false;
    constructor(options: { element?: HTMLElement }) {
      this.element = options.element;
      mocks.markers.push(this);
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLats.push(lngLat);
      return this;
    }
    addTo(map: { options: { container: HTMLElement } }) {
      if (this.element) map.options.container.appendChild(this.element);
      return this;
    }
    remove() {
      this.removed = true;
      this.element?.remove();
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

// Every 5 minutes from liftoff to 90, then the last point at 93.
const TIMELINE = [
  ...Array.from({ length: 19 }, (_, i) => ({
    minutes: i * 5,
    lat: 46.8 + i * 0.01,
    lng: -114.0 + i * 0.01,
  })),
  { minutes: 93, lat: 47.0, lng: -113.8 },
];

const mutableEnv = env as unknown as { ROUTE_BASEMAP_URL: string };
const originalBasemap = mutableEnv.ROUTE_BASEMAP_URL;

type Config = Record<string, unknown>;

function buildBundle(settings: Record<string, unknown> = {}): ContentBundle {
  return {
    content: {
      pages: [],
      nav: [],
      settings,
    } as unknown as ContentDocument,
    media: {
      "11111111-1111-4111-8111-111111111111": {
        url: "https://cdn.example/media/bridge.svg",
        kind: "svg",
        alt: "Bridge",
      },
    },
    icons: {},
  } as unknown as ContentBundle;
}

function setEvent(routeMapConfig?: Config | null): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        scheduledAt: null,
        routeMap: { path: PATH, timeline: TIMELINE, durationMinutes: 93, timed: true },
        ...(routeMapConfig === undefined ? {} : { routeMapConfig }),
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

// Renders a `map` section with `config` as the event's `routeMapConfig`
// (left out of the event when undefined), `data` added to the section
// data, and `settings` as the content document's site settings.
async function renderSection(
  config?: Config | null,
  { data = {}, settings = {} }: { data?: Record<string, unknown>; settings?: Record<string, unknown> } = {},
) {
  setEvent(config);
  const result = render(
    <MemoryRouter>
      <RoutePreview data={data} items={[]} bundle={buildBundle(settings)} />
    </MemoryRouter>,
  );
  await settle();
  return result;
}

type Layer = { id: string; filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> };
type StyleShape = { sources: Record<string, { data?: unknown }>; layers: Layer[] };

function currentStyle(): StyleShape {
  const map = mocks.maps[0];
  const calls = map.setStyle.mock.calls;
  return (calls.length > 0 ? calls[calls.length - 1][0] : map.options.style) as StyleShape;
}

function layerOf(style: StyleShape, id: string): Layer | undefined {
  return style.layers.find((l) => l.id === id);
}

function labelsOf(style: StyleShape): string[] {
  const source = style.sources["route-time-labels"];
  if (source === undefined) return [];
  const data = source.data as { features: { properties: { label: string } }[] };
  return data.features.map((f) => f.properties.label);
}

function lineWidth(style: StyleShape): unknown {
  return layerOf(style, "route-line")?.paint?.["line-width"];
}

function timeLabelSize(style: StyleShape): unknown {
  return layerOf(style, "route-time-labels")?.layout?.["text-size"];
}

// The time label text size at a label scale: two thirds of 20 px at zoom
// 12 and under, 20 px at zoom 16 and over, times the scale.
function labelSizeAt(scale: number): unknown[] {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return ["interpolate", ["linear"], ["zoom"], 12, round((20 * 2 * scale) / 3), 16, round(20 * scale)];
}

function widthAt(scale: number): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 8, 3 * scale, 14, 5 * scale];
}

function q(root: ParentNode, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

function qa(root: ParentNode, id: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
}

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.markers.length = 0;
  mutableEnv.ROUTE_BASEMAP_URL = "https://cdn.example/basemap";
  document.documentElement.setAttribute("data-theme", "light");
  setEvent();
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
  mutableEnv.ROUTE_BASEMAP_URL = originalBasemap;
  document.documentElement.removeAttribute("data-theme");
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("route map config resolution", () => {
  const DEFAULT_DISPLAY = {
    timeLabelIntervalMinutes: 15,
    arrows: true,
    arrowScale: 1,
    routeWidthScale: 1,
    labelScale: 1,
  };

  it("maps the named sizes to scales in one table", () => {
    expect(DISPLAY_SCALES).toEqual({
      arrowSize: { small: 0.75, medium: 1, large: 1.5, xlarge: 2 },
      routeWidth: { thin: 0.75, normal: 1, thick: 1.5, xthick: 2 },
      labelSize: { small: 0.8, medium: 1, large: 1.3 },
    });
    expect(DISPLAY_DEFAULTS).toEqual({
      timeLabelIntervalMinutes: 15,
      arrows: true,
      arrowSize: "medium",
      routeWidth: "normal",
      labelSize: "medium",
    });
    for (const [name, scale] of Object.entries(DISPLAY_SCALES.arrowSize)) {
      expect(resolveRouteMapDisplay({ arrowSize: name }).arrowScale).toBe(scale);
    }
    for (const [name, scale] of Object.entries(DISPLAY_SCALES.routeWidth)) {
      expect(resolveRouteMapDisplay({ routeWidth: name }).routeWidthScale).toBe(scale);
    }
    expect(resolveRouteMapDisplay({ labelSize: "small" }).labelScale).toBe(0.8);
    expect(resolveRouteMapDisplay({ labelSize: "medium" }).labelScale).toBe(1);
    expect(resolveRouteMapDisplay({ labelSize: "large" }).labelScale).toBe(1.3);
  });

  it("resolves every display value from the config, then the default", () => {
    expect(
      resolveRouteMapDisplay({
        timeLabelIntervalMinutes: 5,
        arrows: false,
        arrowSize: "small",
        routeWidth: "thin",
        labelSize: "small",
      }),
    ).toEqual({
      timeLabelIntervalMinutes: 5,
      arrows: false,
      arrowScale: 0.75,
      routeWidthScale: 0.75,
      labelScale: 0.8,
    });
    expect(resolveRouteMapDisplay({ timeLabelIntervalMinutes: 0 }).timeLabelIntervalMinutes).toBe(0);
    for (const display of [undefined, null, {}]) {
      expect(resolveRouteMapDisplay(display)).toEqual(DEFAULT_DISPLAY);
    }
    expect(
      resolveRouteMapDisplay({
        timeLabelIntervalMinutes: null,
        arrows: null,
        arrowSize: null,
        routeWidth: null,
        labelSize: null,
      }),
    ).toEqual(DEFAULT_DISPLAY);
  });

  it("resolves each display value on its own, a value outside its contract set reading as absent", () => {
    expect(resolveRouteMapDisplay({ arrowSize: "large", routeWidth: "thick" })).toEqual({
      timeLabelIntervalMinutes: 15,
      arrows: true,
      arrowScale: 1.5,
      routeWidthScale: 1.5,
      labelScale: 1,
    });
    expect(resolveRouteMapDisplay({ labelSize: "large" })).toEqual({ ...DEFAULT_DISPLAY, labelScale: 1.3 });
    expect(
      resolveRouteMapDisplay({
        timeLabelIntervalMinutes: 7,
        arrowSize: "huge",
        routeWidth: "wide",
        labelSize: "xlarge",
      }),
    ).toEqual(DEFAULT_DISPLAY);
  });

  it("resolves a null or absent config to every default", () => {
    const defaults = {
      display: DEFAULT_DISPLAY,
      controls: { fullscreen: true, terrain: true },
      poiKinds: undefined,
    };
    expect(resolveRouteMapConfig(null)).toEqual(defaults);
    expect(resolveRouteMapConfig(undefined)).toEqual(defaults);
    expect(resolveRouteMapConfig({})).toEqual(defaults);
    expect(resolveRouteMapConfig({ display: null, controls: null, pois: null })).toEqual(defaults);
  });

  it("resolves the controls from the config, each true unless false", () => {
    expect(resolveRouteMapConfig({ controls: {} }).controls).toEqual({ fullscreen: true, terrain: true });
    expect(resolveRouteMapConfig({ controls: { fullscreen: null, terrain: null } }).controls).toEqual({
      fullscreen: true,
      terrain: true,
    });
    expect(resolveRouteMapConfig({ controls: { fullscreen: false } }).controls).toEqual({
      fullscreen: false,
      terrain: true,
    });
    expect(resolveRouteMapConfig({ controls: { terrain: false } }).controls).toEqual({
      fullscreen: true,
      terrain: false,
    });
  });

  it("resolves the landmarks and POI kinds, keeping only well formed entries", () => {
    const landmarks = resolveLandmarks([
      { name: "Caras Park", lat: 46.87, lng: -113.99, icon: null, description: null },
      { name: "Mount Jumbo", lat: 46.88, lng: -113.96, icon: { source: "library", id: "tree" } },
      { name: "The Oval", lat: 46.86, lng: -113.98, description: "Where the reindeer rest." },
      { name: "Bad icon", lat: 46.8, lng: -113.9, icon: { source: "elsewhere", id: "x" } },
      { lat: 46.8, lng: -113.9 },
      { name: "No coordinates" },
    ]);
    const resolved = resolveRouteMapConfig({ pois: { kinds: ["peak", "museum"] } });
    expect(landmarks).toEqual([
      { name: "Caras Park", lat: 46.87, lng: -113.99 },
      { name: "Mount Jumbo", lat: 46.88, lng: -113.96, icon: { source: "library", id: "tree" } },
      { name: "The Oval", lat: 46.86, lng: -113.98, description: "Where the reindeer rest." },
      { name: "Bad icon", lat: 46.8, lng: -113.9 },
    ]);
    expect(resolved.poiKinds).toEqual(["peak", "museum"]);
    expect(resolveLandmarks([])).toEqual([]);
    expect(resolveLandmarks(undefined)).toBeUndefined();
    expect(resolveRouteMapConfig({ pois: { kinds: [] } })).toMatchObject({ poiKinds: [] });
  });

  it("keeps labels on the interior multiples of the interval, and none at 0", () => {
    expect(routeTimeLabels(TIMELINE, 30).map((l) => l.label)).toEqual(["30m", "1h 0m", "1h 30m"]);
    expect(routeTimeLabels(TIMELINE, 10).map((l) => l.label)).toEqual([
      "10m",
      "20m",
      "30m",
      "40m",
      "50m",
      "1h 0m",
      "1h 10m",
      "1h 20m",
      "1h 30m",
    ]);
    expect(routeTimeLabels(TIMELINE, 0)).toEqual([]);
    expect(routeTimeLabels(TIMELINE)).toEqual(routeTimeLabels(TIMELINE, 15));
  });
});

describe("route map config reaching the style", () => {
  function expectDefaultStyle(): void {
    const style = currentStyle();
    expect(labelsOf(style)).toEqual(["15m", "30m", "45m", "1h 0m", "1h 15m", "1h 30m"]);
    const arrows = layerOf(style, "route-arrows");
    expect(arrows).toBeDefined();
    expect(arrows?.layout?.["icon-size"]).toBe(1);
    expect(arrows?.layout?.["symbol-spacing"]).toBe(140);
    expect(lineWidth(style)).toEqual(widthAt(1));
    expect(layerOf(style, "pois")).toBeUndefined();
    expect(style.sources["route-landmarks"]).toBeUndefined();
    expect(timeLabelSize(style)).toEqual(labelSizeAt(1));
  }

  function expectDefaultControls(container: HTMLElement): void {
    expect(q(container, "route-map-fullscreen")).not.toBeNull();
  }

  it("uses the defaults with no config: labels every 15, medium arrows, normal width", async () => {
    const { container } = await renderSection();
    expect(q(container, "route-map-frame")).not.toBeNull();
    expectDefaultStyle();
    expectDefaultControls(container);
  });

  it("renders the default map for a null config", async () => {
    const { container } = await renderSection(null);
    expect(q(container, "route-map-frame")).not.toBeNull();
    expect(mocks.maps).toHaveLength(1);
    expectDefaultStyle();
    expectDefaultControls(container);
    expect(landmarkMarkers()).toHaveLength(0);
  });

  it("renders the default map for a config with every block null", async () => {
    await renderSection({ display: null, controls: null, landmarks: null, pois: null });
    expectDefaultStyle();
  });

  it("uses the config's display values", async () => {
    await renderSection({
      display: { timeLabelIntervalMinutes: 30, arrows: true, arrowSize: "xlarge", routeWidth: "thick" },
    });
    let style = currentStyle();
    expect(labelsOf(style)).toEqual(["30m", "1h 0m", "1h 30m"]);
    expect(layerOf(style, "route-arrows")?.layout?.["icon-size"]).toBe(2);
    expect(layerOf(style, "route-arrows")?.layout?.["symbol-spacing"]).toBe(280);
    expect(lineWidth(style)).toEqual(widthAt(1.5));
    cleanup();
    mocks.maps.length = 0;
    await renderSection({ display: { timeLabelIntervalMinutes: 10, arrowSize: "small", routeWidth: "xthick" } });
    style = currentStyle();
    expect(labelsOf(style)[0]).toBe("10m");
    expect(labelsOf(style)).toHaveLength(9);
    expect(layerOf(style, "route-arrows")?.layout?.["icon-size"]).toBe(0.75);
    expect(lineWidth(style)).toEqual(widthAt(2));
  });

  it("scales the label sizes by the config's label size", async () => {
    for (const [labelSize, scale] of [
      ["small", 0.8],
      ["medium", 1],
      ["large", 1.3],
    ] as const) {
      cleanup();
      mocks.maps.length = 0;
      await renderSection({ display: { labelSize } }, { settings: { landmarks: [PLAIN] } });
      const style = currentStyle();
      expect(timeLabelSize(style)).toEqual(labelSizeAt(scale));
      const landmarkSize = layerOf(style, "route-landmarks")?.layout?.["text-size"] as unknown[];
      expect(landmarkSize.slice(0, 3)).toEqual(["interpolate", ["linear"], ["zoom"]]);
      expect(landmarkSize[landmarkSize.length - 1]).toBeCloseTo(14 * scale, 3);
    }
  });

  it("turns the arrows off from the config", async () => {
    await renderSection({ display: { arrows: false } });
    expect(layerOf(currentStyle(), "route-arrows")).toBeUndefined();
  });

  it("removes the time labels at an interval of 0", async () => {
    await renderSection({ display: { timeLabelIntervalMinutes: 0 } });
    const style = currentStyle();
    expect(style.sources["route-time-labels"]).toBeUndefined();
    expect(style.layers.some((l) => l.id.startsWith("route-time-label"))).toBe(false);
    expect(layerOf(style, "route-marks")).toBeDefined();
  });

  it("follows the config's controls", async () => {
    const { container } = await renderSection({ controls: { fullscreen: false } });
    expect(q(container, "route-map-fullscreen")).toBeNull();
  });

  it("ignores display, controls, landmarks, and POI kinds in the section data", async () => {
    const { container } = await renderSection(null, {
      data: {
        display: { timeLabelIntervalMinutes: 30, arrows: false, arrowSize: "xlarge", routeWidth: "thick" },
        controls: { fullscreen: false, terrain: false },
        landmarks: [TOLD, LIBRARY],
        pois: { kinds: ["peak"] },
      },
    });
    expectDefaultStyle();
    expectDefaultControls(container);
    expect(landmarkMarkers()).toHaveLength(0);
  });

  it("ignores a routeMap block in the site settings", async () => {
    await renderSection(null, {
      settings: {
        routeMap: { timeLabelIntervalMinutes: 30, arrows: false, arrowSize: "xlarge", routeWidth: "thick" },
      },
    });
    expectDefaultStyle();
  });

  it("adds the arrowhead image when the style asks for it", async () => {
    await renderSection();
    const map = mocks.maps[0];
    const missing = map.handlers.get("styleimagemissing") ?? [];
    expect(missing).toHaveLength(1);
    missing[0]({ id: "something-else" });
    expect(map.addImage).not.toHaveBeenCalled();
    missing[0]({ id: "route-arrow" });
    missing[0]({ id: "route-arrow" });
    expect(map.addImage).toHaveBeenCalledTimes(1);
    expect(map.addImage.mock.calls[0][0]).toBe("route-arrow");
    expect(map.addImage.mock.calls[0][2]).toMatchObject({ sdf: true });
  });

  it("creates the map without cooperativeGestures", async () => {
    await renderSection();
    expect(mocks.maps).toHaveLength(1);
    expect(mocks.maps[0].options).not.toHaveProperty("cooperativeGestures");
  });
});

const PLAIN = { name: "Caras Park", lat: 46.87, lng: -113.99 };
const LIBRARY = { name: "Mount Jumbo", lat: 46.88, lng: -113.96, icon: { source: "library", id: "tree" } };
const MEDIA = {
  name: "Higgins Bridge",
  lat: 46.86,
  lng: -113.99,
  icon: { source: "media", id: "11111111-1111-4111-8111-111111111111" },
};
const TOLD = { name: "The Oval", lat: 46.86, lng: -113.98, description: "Where the reindeer rest." };
const TOLD_ICON = {
  name: "Clock Tower",
  lat: 46.85,
  lng: -113.97,
  icon: { source: "library", id: "bell" },
  description: "Chimes at midnight.",
};

function landmarkProperties(style: StyleShape): Record<string, unknown>[] {
  const data = style.sources["route-landmarks"].data as { features: { properties: Record<string, unknown> }[] };
  return data.features.map((f) => f.properties);
}

function landmarkMarkers(): FakeMarkerInstance[] {
  return mocks.markers.filter((m) => m.element?.getAttribute("data-testid") === "route-landmark");
}

function popover(): HTMLElement | null {
  return q(document, "route-landmark-popover");
}

function buttonFor(name: string): HTMLButtonElement {
  const button = qa(document, "route-landmark-button").find(
    (b) => b.getAttribute("aria-label") === `About ${name}`,
  );
  expect(button, name).toBeDefined();
  return button as HTMLButtonElement;
}

async function open(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(buttonFor(name));
  });
}

describe("route map landmarks", () => {
  it("draws a landmark from settings.landmarks", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN] } });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Caras Park" }]);
  });

  it("draws no landmark from a config that still carries the key", async () => {
    await renderSection({ landmarks: [PLAIN, TOLD, LIBRARY] });
    expect(currentStyle().sources["route-landmarks"]).toBeUndefined();
    expect(landmarkMarkers()).toHaveLength(0);
    expect(qa(document, "route-landmark-button")).toHaveLength(0);
  });

  it("keeps plain landmarks exactly as the style draws them, with no marker", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN, { ...PLAIN, name: "Rattlesnake", lat: 46.9 }] } });
    const style = currentStyle();
    expect(landmarkProperties(style)).toEqual([{ label: "Caras Park" }, { label: "Rattlesnake" }]);
    expect(layerOf(style, "route-landmark-dots")?.filter).toBeUndefined();
    expect(layerOf(style, "route-landmarks")?.layout?.["text-radial-offset"]).toBe(0.5);
    expect(landmarkMarkers()).toHaveLength(0);
    expect(mocks.markers).toHaveLength(1);
    expect(qa(document, "route-landmark")).toHaveLength(0);
  });

  it("draws an icon landmark as a badge in place of the dot, the label beside it", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN, LIBRARY, MEDIA] } });
    const style = currentStyle();
    expect(landmarkProperties(style)).toEqual([
      { label: "Caras Park" },
      { label: "Mount Jumbo", badge: true },
      { label: "Higgins Bridge", badge: true },
    ]);
    expect(layerOf(style, "route-landmark-dots")?.filter).toEqual(["!", ["has", "badge"]]);
    expect(layerOf(style, "route-landmarks")).toBeDefined();

    const markers = landmarkMarkers();
    expect(markers).toHaveLength(2);
    expect(markers[0].lngLats).toEqual([[LIBRARY.lng, LIBRARY.lat]]);
    expect(markers[1].lngLats).toEqual([[MEDIA.lng, MEDIA.lat]]);

    const libraryBadge = q(markers[0].element!, "route-landmark-badge")!;
    expect(libraryBadge.getAttribute("aria-hidden")).toBe("true");
    const svg = libraryBadge.querySelector('svg[data-icon-source="library"]');
    expect(svg?.getAttribute("data-icon-id")).toBe("tree");
    expect(libraryBadge.querySelector("img")).toBeNull();

    const mediaBadge = q(markers[1].element!, "route-landmark-badge")!;
    const img = mediaBadge.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example/media/bridge.svg");
    expect(img?.getAttribute("data-icon-source")).toBe("media");
    expect(qa(document, "route-landmark-button")).toHaveLength(0);
  });

  it("treats an icon that does not resolve as no icon", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderSection(null, {
      settings: { landmarks: [{ ...MEDIA, icon: { source: "media", id: "22222222-2222-4222-8222-222222222222" } }] },
    });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Higgins Bridge" }]);
    expect(landmarkMarkers()).toHaveLength(0);
  });

  it("opens a description landmark's popover with its name and description, and closes it with the close button", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN, TOLD] } });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Caras Park" }, { label: "The Oval" }]);
    const markers = landmarkMarkers();
    expect(markers).toHaveLength(1);
    expect(markers[0].lngLats).toEqual([[TOLD.lng, TOLD.lat]]);

    const button = buttonFor("The Oval");
    expect(markers[0].element!.contains(button)).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(q(button, "route-landmark-badge")).toBeNull();
    expect(popover()).toBeNull();

    await open("The Oval");
    const panel = popover()!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("role")).toBe("dialog");
    const title = document.getElementById(panel.getAttribute("aria-labelledby")!);
    expect(title?.textContent).toBe("The Oval");
    expect(panel.textContent).toContain("Where the reindeer rest.");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(panel.id);
    expect(q(document, "route-map-frame")!.contains(panel)).toBe(true);

    const close = q(panel, "route-landmark-popover-close")!;
    expect(close.getAttribute("aria-label")).toBe("Close");
    expect(document.activeElement).toBe(close);
    await act(async () => {
      fireEvent.click(close);
    });
    expect(popover()).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes the popover on Escape, keeping a fullscreen map fullscreen", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD] } });
    const stage = q(document, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(document, "route-map-fullscreen")!);
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");

    await open("The Oval");
    expect(popover()).not.toBeNull();
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    });
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(buttonFor("The Oval"));
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
  });

  it("closes the popover on a tap elsewhere, and not on a tap inside it", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD] } });
    await open("The Oval");
    const panel = popover()!;
    await act(async () => {
      fireEvent.pointerDown(panel.querySelector("p")!);
    });
    expect(popover()).not.toBeNull();
    await act(async () => {
      fireEvent.pointerDown(q(document, "route-map")!);
    });
    expect(popover()).toBeNull();

    await open("The Oval");
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(popover()).toBeNull();
  });

  it("closes the popover from its own landmark's button", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD] } });
    await open("The Oval");
    expect(popover()).not.toBeNull();
    await act(async () => {
      fireEvent.pointerDown(buttonFor("The Oval"));
    });
    expect(popover()).not.toBeNull();
    await open("The Oval");
    expect(popover()).toBeNull();
  });

  it("puts a Get directions link under the description, to Google Maps off Apple touch devices", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    );
    await renderSection(null, { settings: { landmarks: [TOLD, TOLD_ICON] } });
    for (const landmark of [TOLD, TOLD_ICON]) {
      await open(landmark.name);
      const panel = popover()!;
      const link = q(panel, "route-landmark-directions") as HTMLAnchorElement;
      expect(link.tagName).toBe("A");
      expect(link.textContent).toBe("Get directions");
      expect(link.getAttribute("href")).toBe(
        `https://www.google.com/maps/dir/?api=1&destination=${landmark.lat},${landmark.lng}`,
      );
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener");
      const text = Array.from(panel.querySelectorAll("p")).find((p) => p.textContent === landmark.description)!;
      expect(text.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("points the Get directions link at Apple Maps on an Apple touch device", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    await renderSection(null, { settings: { landmarks: [TOLD] } });
    await open(TOLD.name);
    const link = q(popover()!, "route-landmark-directions")!;
    expect(link.getAttribute("href")).toBe(`https://maps.apple.com/?daddr=${TOLD.lat},${TOLD.lng}`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
  });

  it("keeps one popover open at a time", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD, TOLD_ICON] } });
    await open("The Oval");
    await act(async () => {
      fireEvent.pointerDown(buttonFor("Clock Tower"));
    });
    await open("Clock Tower");
    expect(qa(document, "route-landmark-popover")).toHaveLength(1);
    expect(popover()!.textContent).toContain("Chimes at midnight.");
    expect(buttonFor("The Oval").getAttribute("aria-expanded")).toBe("false");
    expect(buttonFor("Clock Tower").getAttribute("aria-expanded")).toBe("true");
  });

  it("makes an icon landmark with a description a button around its badge", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD_ICON] } });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Clock Tower", badge: true }]);
    const button = buttonFor("Clock Tower");
    const badge = q(button, "route-landmark-badge")!;
    expect(badge.querySelector('svg[data-icon-id="bell"]')).not.toBeNull();
    await open("Clock Tower");
    expect(popover()!.textContent).toContain("Clock Tower");
    expect(popover()!.textContent).toContain("Chimes at midnight.");
  });

  it("removes the landmark markers with the map", async () => {
    const { unmount } = await renderSection(null, { settings: { landmarks: [LIBRARY, TOLD] } });
    const markers = landmarkMarkers();
    expect(markers).toHaveLength(2);
    unmount();
    expect(markers.every((m) => m.removed)).toBe(true);
  });
});
