// docs/site.md sections 7.4, 8.9, 22.1. The route_preview map with
// MapLibre and pmtiles mocked and the seeded route themes served from the
// contracts fixtures:
//  - A section with a recording and a basemap mounts the map, the heading
//    and the disclaimer above it; a published document's `style` key,
//    `viewer` included, is ignored.
//  - The route line source is fed `event.routeMap.path`; the map fits its
//    bounds, takes gestures directly (no cooperativeGestures option), and
//    has the map row's zoom range and the OpenStreetMap attribution.
//  - The style is the seeded theme of the site appearance, including a
//    live switch that diffs the style on the same map.
//  - Every fallback (no route map, no `trackerMap`, an unreadable style
//    body or a style or tile error on an event with no Google theme to
//    fall back to) renders the heading and `emptyText`, never an `<img>`,
//    and logs once; a MapLibre failure reports `map_renderer_fallback`
//    with `style_failed`.
//  - The map host chunk is imported only when a section with a recording
//    mounts.
//  - A section with a recording reports the renderer choice as the
//    `route` surface; the host draws on `maplibre`, and on `google` it
//    draws with the Google libraries (faked) when the event has a Google
//    theme. A Google load that still fails after its retries renders
//    `emptyText` and logs once.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import { reportRenderer, reportRendererFallback } from "../../../../src/map/renderer";
import { loadMaps } from "../../../../src/map/loadMaps";
import { FakeMap, installFakeGoogle, resetFakeGoogle } from "../../map/fakeGoogle";
import {
  GOOGLE_THEME_ROWS,
  ROUTE_THEME_ROWS,
  backgroundOf,
  routePalette,
  routeStyle,
  stubThemeFetch,
} from "../../mapHost/routeThemes";

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
  renderer: "maplibre" as "maplibre" | "google",
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
    on(event: string, fn: Handler | string) {
      if (typeof fn === "function") (this.handlers[event] ??= []).push(fn);
      return this;
    }
    getZoom() {
      return 10;
    }
    getCanvas() {
      return this.canvas;
    }
    canvas = document.createElement("canvas");
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
  class FakePopup {
    setLngLat() {
      return this;
    }
    setText() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  return { Map: FakeMap, Marker: FakeMarker, Popup: FakePopup, addProtocol: vi.fn(), setWorkerUrl: vi.fn() };
});

vi.mock("../../../../src/map/renderer", () => ({
  reportRendererFallback: vi.fn(),
  reportRenderer: vi.fn((_surface: string, snapshot: { event?: { trackerMap?: unknown } } | null) =>
    snapshot?.event?.trackerMap == null ? "google" : mocks.renderer,
  ),
}));

vi.mock("../../../../src/map/loadMaps", async () => {
  const { fakeLibs } = await import("../../map/fakeGoogle");
  return { loadMaps: vi.fn(async () => fakeLibs()) };
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

const BASEMAP = "https://cdn.example/basemap";
const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];

// The event's map, `snapshot.event.trackerMap`, with its archives under BASEMAP.
const TRACKER_MAP = {
  id: 3,
  name: "Valley",
  minZoom: 0,
  maxZoom: 15,
  tilesUrl: `${BASEMAP}/tiles.pmtiles`,
  terrainUrl: `${BASEMAP}/terrain.pmtiles`,
};

function buildBundle(): ContentBundle {
  return {
    content: { pages: [], nav: [] } as unknown as ContentDocument,
    media: {},
    icons: {},
  } as ContentBundle;
}

function setEvent(
  routeMap: unknown,
  trackerMap: unknown = TRACKER_MAP,
  trackerThemes: unknown = ROUTE_THEME_ROWS,
): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: { id: 1, routeMap, trackerMap },
      trackerThemes,
    } as unknown as Snapshot,
  }));
}

function routeMapOf(path: { lat: number; lng: number }[]) {
  return { path, timeline: [], durationMinutes: 5, timed: false };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) {
      await vi.dynamicImportSettled();
      await new Promise((r) => setTimeout(r, 0));
    }
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
  return backgroundOf(style);
}

const LIGHT = { background: backgroundOf(routeStyle("light")), ...routePalette("light").overlay };
const DARK = { background: backgroundOf(routeStyle("dark")), ...routePalette("dark").overlay };

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.renderer = "maplibre";
  installFakeGoogle();
  resetFakeGoogle();
  stubThemeFetch();
  document.documentElement.setAttribute("data-theme", "light");
});

afterEach(() => {
  window.localStorage.removeItem("wmsfo.routeMap.terrain");
  cleanup();
  store.setState(() => ({ ...initialStore }));
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("route_preview map", () => {
  it("renders the heading and the disclaimer around the map frame", async () => {
    setEvent(routeMapOf(PATH));
    const { container } = renderSection({
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
    expect(container.querySelector("img")).toBeNull();
  });

  it("mounts the map for a raw published document carrying style viewer", async () => {
    setEvent(routeMapOf(PATH));
    const { container } = renderSection({ style: "viewer", heading: "The route" });
    await settle();
    expect(container.querySelector('[data-testid="route-preview-map"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    expect(mocks.maps).toHaveLength(1);
  });

  it("feeds routeMap.path to the route line and fits the map to it", async () => {
    setEvent(routeMapOf(PATH));
    renderSection({});
    await settle();
    expect(mocks.maps).toHaveLength(1);
    const options = mocks.maps[0].options;
    const style = options.style as StyleShape;
    const line = style.sources.route.data as { geometry: { type: string; coordinates: number[][] } };
    expect(line.geometry.type).toBe("LineString");
    expect(line.geometry.coordinates).toEqual(PATH.map((p) => [p.lng, p.lat]));
    const ends = style.sources["route-ends"].data as { features: { geometry: { coordinates: number[] } }[] };
    expect(ends.features.map((f) => f.geometry.coordinates)).toEqual([[PATH[2].lng, PATH[2].lat]]);
    const layer = routeLayer(style);
    expect(layer?.type).toBe("line");
    expect(layer?.layout).toMatchObject({ "line-join": "round", "line-cap": "round" });
    expect(options.bounds).toEqual([[-114.0, 46.85], [-113.9, 46.9]]);
    expect(options.fitBoundsOptions).toHaveProperty("padding");
    expect(options).not.toHaveProperty("cooperativeGestures");
    expect(options.minZoom).toBe(0);
    expect(options.maxZoom).toBe(15);
    expect(JSON.stringify(options.attributionControl)).toContain("© OpenStreetMap contributors");
    expect(style.sources.basemap.url).toBe(`pmtiles://${BASEMAP}/tiles.pmtiles`);
    expect(style.glyphs).toBe(`${BASEMAP}/glyphs/{fontstack}/{range}.pbf`);
  });

  it("selects the light style under a light appearance and the dark style under a dark one", async () => {
    setEvent(routeMapOf(PATH));
    renderSection({});
    await settle();
    const light = mocks.maps[0].options.style as StyleShape;
    expect(routeLayer(light)?.paint?.["line-color"]).toBe(LIGHT.routeColor);
    expect(backgroundColor(light)).toBe(LIGHT.background);
    cleanup();

    document.documentElement.setAttribute("data-theme", "dark");
    renderSection({});
    await settle();
    const dark = mocks.maps[1].options.style as StyleShape;
    expect(routeLayer(dark)?.paint?.["line-color"]).toBe(DARK.routeColor);
    expect(backgroundColor(dark)).toBe(DARK.background);
  });

  it("switches the style live when the appearance changes, on the same map", async () => {
    window.localStorage.setItem("wmsfo.routeMap.terrain", "off");
    setEvent(routeMapOf(PATH));
    const { container } = renderSection({});
    await settle();
    expect(mocks.maps).toHaveLength(1);
    const map = mocks.maps[0];
    expect(map.setStyle).not.toHaveBeenCalled();

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    await settle();
    expect(container.querySelector('[data-testid="route-map"]')?.getAttribute("data-map-theme")).toBe("dark");
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    const [dark, opts] = map.setStyle.mock.calls[0] as [StyleShape, { diff?: boolean }];
    expect(opts).toEqual({ diff: true });
    expect(routeLayer(dark)?.paint?.["line-color"]).toBe(DARK.routeColor);
    expect(backgroundColor(dark)).toBe(DARK.background);

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "light");
      await Promise.resolve();
    });
    await settle();
    expect(map.setStyle).toHaveBeenCalledTimes(2);
    const light = map.setStyle.mock.calls[1][0] as StyleShape;
    expect(backgroundColor(light)).toBe(LIGHT.background);
    expect(mocks.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();
  });

  it("removes the map on unmount", async () => {
    setEvent(routeMapOf(PATH));
    const { unmount } = renderSection({});
    await settle();
    unmount();
    expect(mocks.maps[0].remove).toHaveBeenCalledTimes(1);
  });
});

describe("route_preview map fallbacks", () => {
  const EMPTY = "The route is not published yet.";

  function expectEmptyView(container: HTMLElement): void {
    expect(container.querySelector('[data-testid="route-preview-empty"]')).not.toBeNull();
    expect(container.textContent).toContain(EMPTY);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-testid="route-preview-map"]')).toBeNull();
  }

  it("renders the heading and emptyText, and no <img>, when event.routeMap is null", async () => {
    setEvent(null);
    const { container } = renderSection({ heading: "The route", emptyText: EMPTY });
    await settle();
    expectEmptyView(container);
    expect(container.querySelector("h2")?.textContent).toBe("The route");
    expect(mocks.maps).toHaveLength(0);
  });

  it("renders nothing when there is no route map and no emptyText", async () => {
    setEvent(null);
    const { container } = renderSection({ heading: "The route", emptyText: "" });
    await settle();
    expect(container.innerHTML).toBe("");
  });

  it("reports the renderer as the route surface and draws the map on maplibre", async () => {
    vi.mocked(reportRenderer).mockClear();
    setEvent(routeMapOf(PATH));
    renderSection({ emptyText: EMPTY });
    await settle();
    expect(reportRenderer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(reportRenderer).mock.calls[0][0]).toBe("route");
    expect(mocks.maps).toHaveLength(1);
  });

  it("draws the map with Google when the renderer choice is google", async () => {
    vi.mocked(reportRenderer).mockClear();
    mocks.renderer = "google";
    setEvent(routeMapOf(PATH), TRACKER_MAP, [...ROUTE_THEME_ROWS, ...GOOGLE_THEME_ROWS]);
    const { container } = renderSection({ emptyText: EMPTY });
    await settle();
    await settle();
    expect(reportRenderer).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="route-preview-empty"]')).toBeNull();
    expect(container.querySelector('[data-testid="route-map"]')?.getAttribute("data-renderer")).toBe("google");
    expect(FakeMap.instances).toHaveLength(1);
    expect(mocks.maps).toHaveLength(0);
  });

  it("draws the Google map when the event has no trackerMap", async () => {
    setEvent(routeMapOf(PATH), null, GOOGLE_THEME_ROWS);
    const { container } = renderSection({ emptyText: EMPTY });
    await settle();
    await settle();
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    expect(FakeMap.instances).toHaveLength(1);
  });

  it("renders emptyText and logs once when the Google libraries fail after their retries", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(loadMaps).mockClear();
    vi.mocked(loadMaps).mockRejectedValue(new Error("Google Maps did not answer in 15 s"));
    mocks.renderer = "google";
    setEvent(routeMapOf(PATH), TRACKER_MAP, GOOGLE_THEME_ROWS);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { container } = renderSection({ heading: "The route", emptyText: EMPTY });
      for (let i = 0; i < 8; i++) {
        await act(async () => {
          await vi.dynamicImportSettled();
          await vi.advanceTimersByTimeAsync(4000);
        });
      }
      expectEmptyView(container);
      expect(container.querySelector("h2")?.textContent).toBe("The route");
      expect(loadMaps).toHaveBeenCalledTimes(4);
      expect(FakeMap.instances).toHaveLength(0);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.mocked(loadMaps).mockReset();
      vi.mocked(loadMaps).mockImplementation(async () => {
        const { fakeLibs } = await import("../../map/fakeGoogle");
        return fakeLibs();
      });
    }
  });

  it("renders emptyText on google when the event has no Google theme", async () => {
    mocks.renderer = "google";
    setEvent(routeMapOf(PATH));
    const { container } = renderSection({ emptyText: EMPTY });
    await settle();
    expectEmptyView(container);
    expect(mocks.maps).toHaveLength(0);
    expect(FakeMap.instances).toHaveLength(0);
  });

  it("reports no renderer when the path cannot make a map", async () => {
    vi.mocked(reportRenderer).mockClear();
    setEvent(routeMapOf(PATH.slice(0, 1)));
    renderSection({ emptyText: EMPTY });
    await settle();
    expect(reportRenderer).not.toHaveBeenCalled();
  });

  it("renders emptyText when the event has no trackerMap", async () => {
    setEvent(routeMapOf(PATH), null);
    const { container } = renderSection({ emptyText: EMPTY });
    await settle();
    expectEmptyView(container);
    expect(mocks.maps).toHaveLength(0);
  });

  it("falls back, then renders emptyText with no Google theme, when the style body cannot be read", async () => {
    vi.mocked(reportRendererFallback).mockClear();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = ROUTE_THEME_ROWS.map((row) => ({
      ...row,
      styleUrl: `https://cdn.example/themes/missing-${row.key}.json`,
    }));
    setEvent(routeMapOf(PATH), TRACKER_MAP, missing);
    const { container } = renderSection({ emptyText: EMPTY });
    await settle();
    expectEmptyView(container);
    expect(mocks.maps).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(reportRendererFallback).toHaveBeenCalledWith("route", "style_failed");
  });

  it("falls back, then renders emptyText with no Google theme, when the style or tiles fail to load", async () => {
    vi.mocked(reportRendererFallback).mockClear();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setEvent(routeMapOf(PATH));
    const { container } = renderSection({ emptyText: EMPTY });
    await settle();
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    const map = mocks.maps[0];
    await act(async () => {
      map.fire("error", { error: new Error("glyphs 404") });
      map.fire("error", { error: new Error("tile 404") });
    });
    expectEmptyView(container);
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(reportRendererFallback).toHaveBeenCalledTimes(1);
    expect(reportRendererFallback).toHaveBeenCalledWith("route", "style_failed");
  });

  it("keeps the map when a tile fails after the first complete render", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setEvent(routeMapOf(PATH));
    const { container } = renderSection({});
    await settle();
    const map = mocks.maps[0];
    await act(async () => {
      map.fire("idle");
      map.fire("error", { error: new Error("tile 404") });
    });
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("map host chunk", () => {
  it("is imported only when a section with a recording mounts", async () => {
    setEvent(null);
    const { container } = renderSection({});
    await settle();
    expect(container.querySelector('[data-testid="route-map-frame"]')).toBeNull();
    expect(mocks.maps).toHaveLength(0);
    cleanup();
    setEvent(routeMapOf(PATH));
    renderSection({});
    await settle();
    expect(mocks.maps).toHaveLength(1);
  });
});
