// docs/site.md section 8.9. The route map's config, viewpoint markers,
// and gestures, with MapLibre and pmtiles mocked and the seeded route
// themes served from the contracts fixtures:
//  - The display and the controls come from the event's `routeMapConfig`: each of the
//    five display values (time label interval, arrows, arrow size, route
//    width, label size) resolves from the config's `display`, then the
//    default (15, true, medium, normal, medium), and reaches the style:
//    the labels at the interval's interior multiples (none at 0), the
//    arrow layer and its scale, the route line width, and the label
//    sizes. The controls default to true.
//  - The viewpoints come from the site settings' `landmarks`, none when
//    absent; a raw config that still carries `viewpoints` draws none.
//  - The place kinds come from the site settings' `places.routeMap.kinds`,
//    the theme's places layer hidden when absent, whatever the event's
//    config carries;
//    resolvePlaces keeps each part's string kinds when that part is an
//    object with a `kinds` list.
//  - A null or absent config renders the default map. Display, controls,
//    viewpoints, or POI kinds in the section data, or a routeMap block in
//    the site settings, change nothing.
//  - The named sizes map to scales through one table.
//  - A viewpoint with an icon stands a badge marker (a library icon
//    inline, a media icon through an image) and has no style dot; a
//    viewpoint with a description stands a button that opens its popover,
//    one at a time, closed by its close button, Escape, a tap elsewhere,
//    and its own button again; plain viewpoints get no marker and stay as
//    the style draws them. The popover holds a "Get directions" link to
//    the viewpoint's point in a new tab: Apple Maps on an Apple touch
//    device, Google Maps everywhere else.
//  - The map is created without cooperativeGestures.
//  - The section passes labelMinZoom 12: the handle listens on the
//    viewpoint and time label dot layers; below zoom 12 a pointer on a dot
//    shows a popup with its label until it leaves, a tap on a time dot
//    shows it for 2.5 s, and the container carries data-names; a click on
//    any viewpoint dot opens that viewpoint's popover, a plain viewpoint's
//    without a description paragraph.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import {
  DISPLAY_DEFAULTS,
  DISPLAY_SCALES,
  resolvePlaces,
  resolveViewpoints,
  resolveRouteMapConfig,
  resolveRouteMapDisplay,
} from "../../../../src/content/sections/RoutePreview/routeMapConfig";
import { routeTimeLabels } from "../../../../src/content/sections/RoutePreview/routeTimelineData";
import { mountRouteMap } from "../../../../src/mapHost/handle";
import {
  ROUTE_THEME_ROWS,
  routePalette,
  routeStyle,
  stubThemeFetch,
} from "../../mapHost/routeThemes";

type Handler = (event: unknown) => void;

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  handlers: Map<string, Handler[]>;
  layerHandlers: Map<string, Handler[]>;
  zoom: number;
  fire: (name: string, event?: unknown) => void;
  fireLayer: (name: string, layerId: string, event?: unknown) => void;
};

type FakePopupInstance = {
  options: Record<string, unknown>;
  lngLats: [number, number][];
  texts: string[];
  added: boolean;
  removed: boolean;
};

type FakeMarkerInstance = {
  element: HTMLElement | undefined;
  lngLats: [number, number][];
  removed: boolean;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
  markers: [] as FakeMarkerInstance[],
  popups: [] as FakePopupInstance[],
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    handlers = new Map<string, Handler[]>();
    layerHandlers = new Map<string, Handler[]>();
    images = new Set<string>();
    zoom = 10;
    canvas = document.createElement("canvas");
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
    on(name: string, layerOrHandler: string | Handler, handler?: Handler) {
      if (typeof layerOrHandler === "string") {
        const key = `${name} ${layerOrHandler}`;
        this.layerHandlers.set(key, [...(this.layerHandlers.get(key) ?? []), handler!]);
      } else {
        this.handlers.set(name, [...(this.handlers.get(name) ?? []), layerOrHandler]);
      }
      return this;
    }
    fire(name: string, event: unknown = {}) {
      for (const fn of this.handlers.get(name) ?? []) fn(event);
    }
    fireLayer(name: string, layerId: string, event: unknown = {}) {
      for (const fn of this.layerHandlers.get(`${name} ${layerId}`) ?? []) fn(event);
    }
    getZoom() {
      return this.zoom;
    }
    getCanvas() {
      return this.canvas;
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
  class FakePopup {
    options: Record<string, unknown>;
    lngLats: [number, number][] = [];
    texts: string[] = [];
    added = false;
    removed = false;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.popups.push(this);
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLats.push(lngLat);
      return this;
    }
    setText(text: string) {
      this.texts.push(text);
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
  return { Map: FakeMap, Marker: FakeMarker, Popup: FakePopup, addProtocol: vi.fn(), setWorkerUrl: vi.fn() };
});

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));

vi.mock("pmtiles", () => {
  class Protocol {
    tile = vi.fn();
  }
  return { Protocol };
});

vi.mock("../../../../src/map/renderer", () => ({
  reportRenderer: vi.fn(() => "maplibre"),
}));

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

// The event's map, `snapshot.event.trackerMap`.
const TRACKER_MAP = {
  id: 3,
  tilesUrl: "https://cdn.example/basemap/tiles.pmtiles",
  terrainUrl: "https://cdn.example/basemap/terrain.pmtiles",
};

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
        trackerMap: TRACKER_MAP,
        ...(routeMapConfig === undefined ? {} : { routeMapConfig }),
      },
      trackerThemes: ROUTE_THEME_ROWS,
    } as unknown as Snapshot,
  }));
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) {
      await vi.dynamicImportSettled();
      await new Promise((r) => setTimeout(r, 0));
    }
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
  mocks.popups.length = 0;
  stubThemeFetch();
  document.documentElement.setAttribute("data-theme", "light");
  setEvent();
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
  document.documentElement.removeAttribute("data-theme");
  document.body.style.overflow = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
    };
    expect(resolveRouteMapConfig(null)).toEqual(defaults);
    expect(resolveRouteMapConfig(undefined)).toEqual(defaults);
    expect(resolveRouteMapConfig({})).toEqual(defaults);
    expect(resolveRouteMapConfig({ display: null, controls: null })).toEqual(defaults);
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

  it("resolves the viewpoints, keeping only well formed entries", () => {
    const viewpoints = resolveViewpoints([
      { name: "Caras Park", lat: 46.87, lng: -113.99, icon: null, description: null },
      { name: "Mount Jumbo", lat: 46.88, lng: -113.96, icon: { source: "library", id: "tree" } },
      { name: "The Oval", lat: 46.86, lng: -113.98, description: "Where the reindeer rest." },
      { name: "Bad icon", lat: 46.8, lng: -113.9, icon: { source: "elsewhere", id: "x" } },
      { lat: 46.8, lng: -113.9 },
      { name: "No coordinates" },
    ]);
    expect(viewpoints).toEqual([
      { name: "Caras Park", lat: 46.87, lng: -113.99 },
      { name: "Mount Jumbo", lat: 46.88, lng: -113.96, icon: { source: "library", id: "tree" } },
      { name: "The Oval", lat: 46.86, lng: -113.98, description: "Where the reindeer rest." },
      { name: "Bad icon", lat: 46.8, lng: -113.9 },
    ]);
    expect(resolveViewpoints([])).toEqual([]);
    expect(resolveViewpoints(undefined)).toBeUndefined();
  });

  it("reads no POI kinds from the config", () => {
    expect(resolveRouteMapConfig({ pois: { kinds: ["peak"] } } as never)).not.toHaveProperty("poiKinds");
  });

  it("resolves the places: absent, null, or a part without kinds reads as absent", () => {
    const none = { tracker: undefined, routeMap: undefined };
    expect(resolvePlaces(undefined)).toEqual(none);
    expect(resolvePlaces(null)).toEqual(none);
    expect(resolvePlaces({})).toEqual(none);
    expect(resolvePlaces({ tracker: null, routeMap: null })).toEqual(none);
    expect(resolvePlaces({ tracker: {}, routeMap: { kinds: "park" } })).toEqual(none);
  });

  it("resolves each part of the places on its own", () => {
    expect(resolvePlaces({ tracker: { kinds: ["park", "school"] } })).toEqual({
      tracker: ["park", "school"],
      routeMap: undefined,
    });
    expect(resolvePlaces({ routeMap: { kinds: ["peak"] } })).toEqual({ tracker: undefined, routeMap: ["peak"] });
    expect(resolvePlaces({ tracker: { kinds: [] }, routeMap: { kinds: [] } })).toEqual({ tracker: [], routeMap: [] });
  });

  it("keeps only the string kinds of the places", () => {
    expect(
      resolvePlaces({ tracker: { kinds: ["park", 3, null] }, routeMap: { kinds: [{}, "peak", true, "museum"] } }),
    ).toEqual({ tracker: ["park"], routeMap: ["peak", "museum"] });
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
    expect(layerOf(style, "pois")?.layout?.visibility).toBe("none");
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
    expect(viewpointMarkers()).toHaveLength(0);
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
      const viewpointSize = layerOf(style, "route-landmarks")?.layout?.["text-size"] as unknown[];
      expect(viewpointSize.slice(0, 3)).toEqual(["interpolate", ["linear"], ["zoom"]]);
      expect(viewpointSize[viewpointSize.length - 1]).toBeCloseTo(14 * scale, 3);
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

  it("ignores display, controls, viewpoints, and POI kinds in the section data", async () => {
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
    expect(viewpointMarkers()).toHaveLength(0);
  });

  it("passes the settings' route map places to the route map as its place filter", async () => {
    await renderSection(null, { settings: { places: { routeMap: { kinds: ["park", "attraction"] } } } });
    const pois = layerOf(currentStyle(), "pois");
    expect(pois?.layout?.visibility).not.toBe("none");
    expect(JSON.stringify(pois?.filter)).toContain(
      JSON.stringify(["literal", ["park", "attraction"]]),
    );
  });

  it("passes the settings' route map places whatever the event's config carries", async () => {
    await renderSection({ pois: { kinds: ["school"] } }, { settings: { places: { routeMap: { kinds: ["park"] } } } });
    const filter = JSON.stringify(layerOf(currentStyle(), "pois")?.filter);
    expect(filter).toContain(JSON.stringify(["literal", ["park"]]));
    expect(filter).not.toContain("school");
  });

  it("hides the places without the settings' route map places, whatever the event's config carries", async () => {
    await renderSection({ pois: { kinds: ["park"] } }, { settings: { places: { tracker: { kinds: ["park"] } } } });
    const pois = layerOf(currentStyle(), "pois");
    expect(pois?.layout?.visibility).toBe("none");
    expect(pois?.filter).toEqual(layerOf(routeStyle("route-light") as unknown as StyleShape, "pois")?.filter);
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

function viewpointProperties(style: StyleShape): Record<string, unknown>[] {
  const data = style.sources["route-landmarks"].data as { features: { properties: Record<string, unknown> }[] };
  return data.features.map((f) => f.properties);
}

function viewpointMarkers(): FakeMarkerInstance[] {
  return mocks.markers.filter((m) => m.element?.getAttribute("data-testid") === "route-viewpoint");
}

function popover(): HTMLElement | null {
  return q(document, "route-viewpoint-popover");
}

function buttonFor(name: string): HTMLButtonElement {
  const button = qa(document, "route-viewpoint-button").find(
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

describe("route map viewpoints", () => {
  it("draws a viewpoint from settings.landmarks", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN] } });
    expect(viewpointProperties(currentStyle())).toEqual([{ label: "Caras Park" }]);
  });

  it("draws no viewpoint from a config that still carries the key", async () => {
    await renderSection({ landmarks: [PLAIN, TOLD, LIBRARY] });
    expect(currentStyle().sources["route-landmarks"]).toBeUndefined();
    expect(viewpointMarkers()).toHaveLength(0);
    expect(qa(document, "route-viewpoint-button")).toHaveLength(0);
  });

  it("keeps plain viewpoints exactly as the style draws them, with no marker", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN, { ...PLAIN, name: "Rattlesnake", lat: 46.9 }] } });
    const style = currentStyle();
    expect(viewpointProperties(style)).toEqual([{ label: "Caras Park" }, { label: "Rattlesnake" }]);
    expect(layerOf(style, "route-landmark-dots")?.filter).toBeUndefined();
    expect(layerOf(style, "route-landmarks")?.layout?.["text-radial-offset"]).toBe(0.5);
    expect(viewpointMarkers()).toHaveLength(0);
    expect(mocks.markers).toHaveLength(1);
    expect(qa(document, "route-viewpoint")).toHaveLength(0);
  });

  it("draws an icon viewpoint as a badge in place of the dot, the label beside it", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN, LIBRARY, MEDIA] } });
    const style = currentStyle();
    expect(viewpointProperties(style)).toEqual([
      { label: "Caras Park" },
      { label: "Mount Jumbo", badge: true },
      { label: "Higgins Bridge", badge: true },
    ]);
    expect(layerOf(style, "route-landmark-dots")?.filter).toEqual(["!", ["has", "badge"]]);
    expect(layerOf(style, "route-landmarks")).toBeDefined();

    const markers = viewpointMarkers();
    expect(markers).toHaveLength(2);
    expect(markers[0].lngLats).toEqual([[LIBRARY.lng, LIBRARY.lat]]);
    expect(markers[1].lngLats).toEqual([[MEDIA.lng, MEDIA.lat]]);

    const libraryBadge = q(markers[0].element!, "route-viewpoint-badge")!;
    expect(libraryBadge.getAttribute("aria-hidden")).toBe("true");
    const svg = libraryBadge.querySelector('svg[data-icon-source="library"]');
    expect(svg?.getAttribute("data-icon-id")).toBe("tree");
    expect(libraryBadge.querySelector("img")).toBeNull();

    const mediaBadge = q(markers[1].element!, "route-viewpoint-badge")!;
    const img = mediaBadge.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example/media/bridge.svg");
    expect(img?.getAttribute("data-icon-source")).toBe("media");
    expect(qa(document, "route-viewpoint-button")).toHaveLength(0);
  });

  it("treats an icon that does not resolve as no icon", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderSection(null, {
      settings: { landmarks: [{ ...MEDIA, icon: { source: "media", id: "22222222-2222-4222-8222-222222222222" } }] },
    });
    expect(viewpointProperties(currentStyle())).toEqual([{ label: "Higgins Bridge" }]);
    expect(viewpointMarkers()).toHaveLength(0);
  });

  it("opens a description viewpoint's popover with its name and description, and closes it with the close button", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN, TOLD] } });
    expect(viewpointProperties(currentStyle())).toEqual([{ label: "Caras Park" }, { label: "The Oval" }]);
    const markers = viewpointMarkers();
    expect(markers).toHaveLength(1);
    expect(markers[0].lngLats).toEqual([[TOLD.lng, TOLD.lat]]);

    const button = buttonFor("The Oval");
    expect(markers[0].element!.contains(button)).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(q(button, "route-viewpoint-badge")).toBeNull();
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

    const close = q(panel, "route-viewpoint-popover-close")!;
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

  it("closes the popover from its own viewpoint's button", async () => {
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
    for (const viewpoint of [TOLD, TOLD_ICON]) {
      await open(viewpoint.name);
      const panel = popover()!;
      const link = q(panel, "route-viewpoint-directions") as HTMLAnchorElement;
      expect(link.tagName).toBe("A");
      expect(link.textContent).toBe("Get directions");
      expect(link.getAttribute("href")).toBe(
        `https://www.google.com/maps/dir/?api=1&destination=${viewpoint.lat},${viewpoint.lng}`,
      );
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener");
      const text = Array.from(panel.querySelectorAll("p")).find((p) => p.textContent === viewpoint.description)!;
      expect(text.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("points the Get directions link at Apple Maps on an Apple touch device", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    await renderSection(null, { settings: { landmarks: [TOLD] } });
    await open(TOLD.name);
    const link = q(popover()!, "route-viewpoint-directions")!;
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
    expect(qa(document, "route-viewpoint-popover")).toHaveLength(1);
    expect(popover()!.textContent).toContain("Chimes at midnight.");
    expect(buttonFor("The Oval").getAttribute("aria-expanded")).toBe("false");
    expect(buttonFor("Clock Tower").getAttribute("aria-expanded")).toBe("true");
  });

  it("makes an icon viewpoint with a description a button around its badge", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD_ICON] } });
    expect(viewpointProperties(currentStyle())).toEqual([{ label: "Clock Tower", badge: true }]);
    const button = buttonFor("Clock Tower");
    const badge = q(button, "route-viewpoint-badge")!;
    expect(badge.querySelector('svg[data-icon-id="bell"]')).not.toBeNull();
    await open("Clock Tower");
    expect(popover()!.textContent).toContain("Clock Tower");
    expect(popover()!.textContent).toContain("Chimes at midnight.");
  });

  it("removes the viewpoint markers with the map", async () => {
    const { unmount } = await renderSection(null, { settings: { landmarks: [LIBRARY, TOLD] } });
    const markers = viewpointMarkers();
    expect(markers).toHaveLength(2);
    unmount();
    expect(markers.every((m) => m.removed)).toBe(true);
  });
});

function dotEvent(label: string, lat: number, lng: number) {
  return {
    features: [{ properties: { label }, geometry: { type: "Point", coordinates: [lng, lat] } }],
  };
}

describe("route map dot layer events", () => {
  async function mount(onViewpointClick = vi.fn()) {
    const container = document.createElement("div");
    const handle = await mountRouteMap({
      container,
      trackerMap: { ...TRACKER_MAP, minZoom: 0, maxZoom: 15 },
      bbox: null,
      theme: { key: "route-light", spriteUrl: null, style: routeStyle("route-light"), ...routePalette("route-light") },
      path: PATH,
      labelMinZoom: 12,
      onViewpointClick,
      onError: vi.fn(),
    });
    return { container, handle, map: mocks.maps[0], onViewpointClick };
  }

  it("registers the listeners on both dot layers and stamps the container by the zoom", async () => {
    const { container, map } = await mount();
    for (const name of ["mouseenter", "mouseleave", "click"]) {
      expect(map.layerHandlers.get(`${name} route-landmark-dots`), name).toHaveLength(1);
      expect(map.layerHandlers.get(`${name} route-time-label-dots`), name).toHaveLength(1);
    }
    expect(container.getAttribute("data-names")).toBe("hidden");
    map.zoom = 12;
    map.fire("zoom");
    expect(container.getAttribute("data-names")).toBe("shown");
  });

  it("shows a popup with the label on a hover at zoom 10 and removes it on leave", async () => {
    const { map } = await mount();
    map.fireLayer("mouseenter", "route-landmark-dots", dotEvent("Caras Park", 46.87, -113.99));
    expect(mocks.popups).toHaveLength(1);
    const tip = mocks.popups[0];
    expect(tip.options).toMatchObject({ closeButton: false, closeOnClick: false, offset: 10, className: "route-map-tip" });
    expect(tip.texts).toEqual(["Caras Park"]);
    expect(tip.lngLats).toEqual([[-113.99, 46.87]]);
    expect(tip.added).toBe(true);
    map.fireLayer("mouseleave", "route-landmark-dots");
    expect(tip.removed).toBe(true);
  });

  it("shows no popup at zoom 14", async () => {
    const { map } = await mount();
    map.zoom = 14;
    map.fireLayer("mouseenter", "route-landmark-dots", dotEvent("Caras Park", 46.87, -113.99));
    map.fireLayer("mouseenter", "route-time-label-dots", dotEvent("20 min", 46.9, -113.95));
    map.fireLayer("click", "route-time-label-dots", dotEvent("20 min", 46.9, -113.95));
    expect(mocks.popups).toHaveLength(0);
  });

  it("calls onViewpointClick with the feature's point on a viewpoint dot click", async () => {
    const { map, onViewpointClick } = await mount();
    map.zoom = 14;
    map.fireLayer("click", "route-landmark-dots", dotEvent("Caras Park", 46.87, -113.99));
    expect(onViewpointClick).toHaveBeenCalledWith({ lat: 46.87, lng: -113.99 });
  });

  it("shows a time dot's popup for 2.5 s on a click", async () => {
    const { map } = await mount();
    vi.useFakeTimers();
    try {
      map.fireLayer("click", "route-time-label-dots", dotEvent("20 min", 46.9, -113.95));
      expect(mocks.popups).toHaveLength(1);
      expect(mocks.popups[0].texts).toEqual(["20 min"]);
      vi.advanceTimersByTime(2499);
      expect(mocks.popups[0].removed).toBe(false);
      vi.advanceTimersByTime(1);
      expect(mocks.popups[0].removed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("route map viewpoint dot clicks", () => {
  it("passes labelMinZoom 12 to the style's two text layers", async () => {
    await renderSection(null, { settings: { landmarks: [PLAIN] } });
    const style = currentStyle() as unknown as { layers: { id: string; minzoom?: number }[] };
    const gated = style.layers.filter((l) => l.minzoom !== undefined && l.id.startsWith("route-"));
    expect(gated.map((l) => [l.id, l.minzoom])).toEqual([
      ["route-landmarks", 12],
      ["route-time-labels", 12],
    ]);
  });

  it("opens a plain viewpoint's popover from its dot with the name and the directions link, without a description", async () => {
    await renderSection(null, { settings: { landmarks: [TOLD, PLAIN] } });
    expect(popover()).toBeNull();
    await act(async () => {
      mocks.maps[0].fireLayer("click", "route-landmark-dots", dotEvent("Caras Park", PLAIN.lat, PLAIN.lng));
    });
    const panel = popover()!;
    expect(panel).not.toBeNull();
    expect(panel.querySelector("h3")?.textContent).toBe("Caras Park");
    expect(panel.querySelector("p")).toBeNull();
    const link = q(panel, "route-viewpoint-directions")!;
    expect(link.textContent).toBe("Get directions");
    expect(link.getAttribute("href")).toContain(`${PLAIN.lat},${PLAIN.lng}`);
  });

  it("puts the name in a tooltip span in every marker", async () => {
    await renderSection(null, { settings: { landmarks: [LIBRARY, TOLD] } });
    const markers = viewpointMarkers();
    expect(markers.map((m) => q(m.element!, "route-viewpoint-tip")?.textContent)).toEqual([
      "Mount Jumbo",
      "The Oval",
    ]);
  });
});
