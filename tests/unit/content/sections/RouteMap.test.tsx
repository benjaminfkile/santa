// docs/site.md sections 7.4, 8.9, 22.1. The `map` style of route_preview
// with MapLibre and pmtiles mocked:
//  - The heading and disclaimer render around the map frame, as the
//    viewer style renders them.
//  - The route line source is fed `event.routeMap.path`; the map fits its
//    bounds, takes gestures directly (no cooperativeGestures option), and
//    has the archive's zoom range and the OpenStreetMap attribution.
//  - The style follows the site appearance, including a live switch that
//    diffs the style on the same map.
//  - Every fallback (no route map, no basemap URL, an unreadable archive,
//    a style or tile error) renders exactly the image-style view, and
//    logs once.
//  - The routemap chunk is imported only when a map-style section mounts.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { env } from "../../../../src/config/env";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import { DARK_FLAVOR, LIGHT_FLAVOR, ROUTE_PALETTES } from "../../../../src/routeMap/flavors";

type Handler = (event: { error?: unknown }) => void;

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  fire: (event: string, data?: { error?: unknown }) => void;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
  header: { fail: false, minZoom: 0, maxZoom: 15 },
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    handlers: Record<string, Handler[]> = {};
    onceHandlers: Record<string, Handler[]> = {};
    setStyle = vi.fn();
    fitBounds = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.maps.push(this as unknown as FakeMapInstance);
    }
    on(event: string, fn: Handler) {
      (this.handlers[event] ??= []).push(fn);
      return this;
    }
    once(event: string, fn: Handler) {
      (this.onceHandlers[event] ??= []).push(fn);
      return this;
    }
    fire(event: string, data: { error?: unknown } = {}) {
      const once = this.onceHandlers[event] ?? [];
      this.onceHandlers[event] = [];
      for (const fn of [...(this.handlers[event] ?? []), ...once]) fn(data);
    }
  }
  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
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
      if (mocks.header.fail) throw new Error("archive unreachable");
      return { minZoom: mocks.header.minZoom, maxZoom: mocks.header.maxZoom };
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

const BASEMAP = "https://cdn.example/basemap";
const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];

const mutableEnv = env as unknown as { ROUTE_BASEMAP_URL: string };
const originalBasemap = mutableEnv.ROUTE_BASEMAP_URL;

function buildBundle(): ContentBundle {
  return {
    content: { pages: [], nav: [] } as unknown as ContentDocument,
    media: {
      "poster-1": {
        url: "https://cdn.example/poster.jpg",
        kind: "raster",
        width: 2400,
        height: 1600,
        alt: "2026 route poster",
        variants: { "960": "https://cdn.example/poster-960.jpg" },
        dzi: null,
      },
    },
    icons: {},
  } as ContentBundle;
}

function setEvent(routeImageMediaId: string | null, routeMap: unknown): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: { id: 1, routeImageMediaId, routeMap },
    } as unknown as Snapshot,
  }));
}

function routeMapOf(path: { lat: number; lng: number }[]) {
  return { path, timeline: [], durationMinutes: 5, timed: false };
}

async function settle(): Promise<void> {
  await act(async () => {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

function renderSection(data: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <RoutePreview data={data} items={[]} bundle={buildBundle()} />
    </MemoryRouter>,
  );
}

type StyleShape = {
  sources: Record<string, { type: string; url?: string; data?: unknown; attribution?: string }>;
  layers: { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }[];
  glyphs: string;
};

function routeLayer(style: StyleShape) {
  return style.layers.find((l) => l.id === "route-line");
}

function backgroundColor(style: StyleShape): unknown {
  return style.layers.find((l) => l.id === "background")?.paint?.["background-color"];
}

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.header.fail = false;
  mutableEnv.ROUTE_BASEMAP_URL = BASEMAP;
  document.documentElement.setAttribute("data-theme", "light");
});

afterEach(() => {
  window.localStorage.removeItem("wmsfo.routeMap.terrain");
  cleanup();
  store.setState(() => ({ ...initialStore }));
  mutableEnv.ROUTE_BASEMAP_URL = originalBasemap;
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

describe("route_preview style map", () => {
  it("renders the heading and the disclaimer around the map frame", async () => {
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({
      style: "map",
      heading: "The route",
      disclaimer: "The route is a plan, not a promise.",
    });
    await settle();
    const heading = container.querySelector("h2");
    const note = container.querySelector('[role="note"]');
    const frame = container.querySelector('[data-testid="route-map-frame"]');
    expect(heading?.textContent).toBe("The route");
    expect(note?.textContent).toContain("The route is a plan, not a promise.");
    expect(frame).not.toBeNull();
    expect(heading!.compareDocumentPosition(note!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note!.compareDocumentPosition(frame!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-preview-image"]')).toBeNull();
  });

  it("feeds routeMap.path to the route line and fits the map to it", async () => {
    setEvent("poster-1", routeMapOf(PATH));
    renderSection({ style: "map" });
    await settle();
    expect(mocks.maps).toHaveLength(1);
    const options = mocks.maps[0].options;
    const style = options.style as StyleShape;
    const line = style.sources.route.data as { geometry: { type: string; coordinates: number[][] } };
    expect(line.geometry.type).toBe("LineString");
    expect(line.geometry.coordinates).toEqual(PATH.map((p) => [p.lng, p.lat]));
    const ends = style.sources["route-ends"].data as { features: { geometry: { coordinates: number[] } }[] };
    expect(ends.features.map((f) => f.geometry.coordinates)).toEqual([
      [PATH[0].lng, PATH[0].lat],
      [PATH[2].lng, PATH[2].lat],
    ]);
    const layer = routeLayer(style);
    expect(layer?.type).toBe("line");
    expect(layer?.layout).toMatchObject({ "line-join": "round", "line-cap": "round" });
    expect(options.bounds).toEqual([[-114.0, 46.85], [-113.9, 46.9]]);
    expect(options.fitBoundsOptions).toHaveProperty("padding");
    expect(options).not.toHaveProperty("cooperativeGestures");
    expect(options.minZoom).toBe(0);
    expect(options.maxZoom).toBe(15);
    expect(JSON.stringify(options.attributionControl)).toContain("© OpenStreetMap contributors");
    expect(style.sources.protomaps.url).toBe(`pmtiles://${BASEMAP}/tiles.pmtiles`);
    expect(style.glyphs).toBe(`${BASEMAP}/glyphs/{fontstack}/{range}.pbf`);
  });

  it("selects the light style under a light appearance and the dark style under a dark one", async () => {
    setEvent("poster-1", routeMapOf(PATH));
    renderSection({ style: "map" });
    await settle();
    const light = mocks.maps[0].options.style as StyleShape;
    expect(routeLayer(light)?.paint?.["line-color"]).toBe(ROUTE_PALETTES.light.routeColor);
    expect(backgroundColor(light)).toBe(LIGHT_FLAVOR.background);
    cleanup();

    document.documentElement.setAttribute("data-theme", "dark");
    renderSection({ style: "map" });
    await settle();
    const dark = mocks.maps[1].options.style as StyleShape;
    expect(routeLayer(dark)?.paint?.["line-color"]).toBe(ROUTE_PALETTES.dark.routeColor);
    expect(backgroundColor(dark)).toBe(DARK_FLAVOR.background);
  });

  it("switches the style live when the appearance changes, on the same map", async () => {
    window.localStorage.setItem("wmsfo.routeMap.terrain", "off");
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({ style: "map" });
    await settle();
    expect(mocks.maps).toHaveLength(1);
    const map = mocks.maps[0];
    expect(map.setStyle).not.toHaveBeenCalled();

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    await settle();
    expect(container.querySelector('[data-testid="route-map"]')?.getAttribute("data-appearance")).toBe("dark");
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    const [dark, opts] = map.setStyle.mock.calls[0] as [StyleShape, { diff?: boolean }];
    expect(opts).toEqual({ diff: true });
    expect(routeLayer(dark)?.paint?.["line-color"]).toBe(ROUTE_PALETTES.dark.routeColor);
    expect(backgroundColor(dark)).toBe(DARK_FLAVOR.background);

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "light");
      await Promise.resolve();
    });
    await settle();
    expect(map.setStyle).toHaveBeenCalledTimes(2);
    const light = map.setStyle.mock.calls[1][0] as StyleShape;
    expect(backgroundColor(light)).toBe(LIGHT_FLAVOR.background);
    expect(mocks.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();  });

  it("removes the map on unmount", async () => {
    setEvent("poster-1", routeMapOf(PATH));
    const { unmount } = renderSection({ style: "map" });
    await settle();
    unmount();
    expect(mocks.maps[0].remove).toHaveBeenCalledTimes(1);
  });
});

describe("route_preview style map fallbacks", () => {
  function expectImageView(container: HTMLElement): void {
    expect(container.querySelector('[data-testid="route-preview-image-wrap"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-preview-image"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-preview-map"]')).toBeNull();
  }

  it("renders the image view when event.routeMap is null", async () => {
    setEvent("poster-1", null);
    const { container } = renderSection({ style: "map", heading: "The route" });
    await settle();
    expectImageView(container);
    expect(container.querySelector("h2")?.textContent).toBe("The route");
    expect(mocks.maps).toHaveLength(0);
  });

  it("renders emptyText, as the image style does, when there is no route map and no poster", async () => {
    setEvent(null, null);
    const { container } = renderSection({ style: "map", emptyText: "The route is not published yet." });
    await settle();
    expect(container.textContent).toContain("The route is not published yet.");
    expect(container.querySelector('[data-testid="route-preview-map"]')).toBeNull();
  });

  it("renders the image view when VITE_ROUTE_BASEMAP_URL is unset", async () => {
    mutableEnv.ROUTE_BASEMAP_URL = "";
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({ style: "map" });
    await settle();
    expectImageView(container);
    expect(mocks.maps).toHaveLength(0);
  });

  it("renders the image view and logs once when the tiles archive cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.header.fail = true;
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({ style: "map" });
    await settle();
    expectImageView(container);
    expect(mocks.maps).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("renders the image view and logs once when the style or tiles fail to load", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({ style: "map" });
    await settle();
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    const map = mocks.maps[0];
    await act(async () => {
      map.fire("error", { error: new Error("glyphs 404") });
      map.fire("error", { error: new Error("tile 404") });
    });
    expectImageView(container);
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the map when a tile fails after the first complete render", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({ style: "map" });
    await settle();
    const map = mocks.maps[0];
    await act(async () => {
      map.fire("idle");
      map.fire("error", { error: new Error("tile 404") });
    });
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("never leaves a blank card: with no poster the failed map renders emptyText", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.header.fail = true;
    setEvent(null, routeMapOf(PATH));
    const { container } = renderSection({ style: "map", emptyText: "The route is not published yet." });
    await settle();
    expect(container.textContent).toContain("The route is not published yet.");
  });
});

describe("routemap chunk", () => {
  it("is imported only when a map-style section mounts", async () => {
    setEvent("poster-1", routeMapOf(PATH));
    const { container } = renderSection({ style: "image" });
    await settle();
    expect(container.querySelector('[data-testid="route-map-frame"]')).toBeNull();
    expect(mocks.maps).toHaveLength(0);
    cleanup();
    renderSection({ style: "map" });
    await settle();
    expect(mocks.maps).toHaveLength(1);
  });
});
