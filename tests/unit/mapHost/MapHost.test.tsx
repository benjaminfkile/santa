// docs/site.md sections 8.9 and 8.10. The map host in route mode with
// MapLibre and pmtiles mocked and the seeded route themes served from the
// contracts fixtures:
//  - The route preview hands the host the enabled MapLibre theme carrying
//    the default flag for the page's appearance, else the first one; a
//    scheme change re-resolves it and the host applies it to the same map
//    with `setStyle` and `diff: true`.
//  - The map takes the event box as `maxBounds` and its fitted least
//    zoom, and the row's zoom range.
//  - The path is fitted on mount and again on every resize of the frame.
//  - The terrain toggle hides without a terrain URL and without a terrain
//    layer in the theme; the remembered choice restores.
// And on the `google` renderer, over the fake Google libraries:
//  - The host loads the `map` chunk's loader and route drawing and never
//    builds a MapLibre map.
//  - The route preview hands it the enabled Google theme carrying the
//    default flag for the page's appearance; a scheme change re-resolves
//    it and the host applies its styles to the same map with `setOptions`.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../src/contracts";
import { RoutePreview } from "../../../src/content/sections/RoutePreview/RoutePreview";
import { MapHost, TERRAIN_KEY } from "../../../src/mapHost/MapHost";
import { loadThemes, type MapTheme } from "../../../src/map/themes";
import {
  GOOGLE_THEME_ROWS,
  ROUTE_THEME_ROWS,
  backgroundOf,
  googleStyle,
  routeStyle,
  stubThemeFetch,
} from "./routeThemes";
import { FakeMap, installFakeGoogle, resetFakeGoogle } from "../map/fakeGoogle";
import { loadMaps } from "../../../src/map/loadMaps";

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  setMinZoom: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
  observers: [] as { callback: () => void; targets: Element[] }[],
  renderer: "maplibre" as "maplibre" | "google",
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    setStyle = vi.fn();
    fitBounds = vi.fn();
    resize = vi.fn();
    setMinZoom = vi.fn();
    remove = vi.fn();
    canvas = document.createElement("canvas");
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
    getZoom() {
      return 10;
    }
    getCanvas() {
      return this.canvas;
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
  class FakePopup {}
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

vi.mock("../../../src/map/renderer", () => ({
  reportRendererFallback: vi.fn(),
  reportRenderer: vi.fn(() => mocks.renderer),
}));

vi.mock("../../../src/map/loadMaps", async () => {
  const { fakeLibs } = await import("../map/fakeGoogle");
  return { loadMaps: vi.fn(async () => fakeLibs()) };
});

const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];

const TRACKER_MAP = {
  tilesUrl: "https://cdn.example/maps/valley/tiles.pmtiles",
  terrainUrl: "https://cdn.example/maps/valley/terrain.pmtiles",
  minZoom: 0,
  maxZoom: 15,
};

const BOX = { west: -114.5, south: 46.5, east: -113.5, north: 47.2 };

const FLAT_URL = "https://cdn.example/themes/flat.json";

type StyleShape = { layers: { id: string; source?: string; paint?: Record<string, unknown> }[] };

function lastStyle(map: FakeMapInstance): StyleShape {
  const calls = map.setStyle.mock.calls;
  return (calls.length > 0 ? calls[calls.length - 1][0] : map.options.style) as StyleShape;
}

function hasHillshade(style: StyleShape): boolean {
  return style.layers.some((l) => l.source === "terrain");
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) {
      await vi.dynamicImportSettled();
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

function themeOf(key: string, rows = ROUTE_THEME_ROWS): MapTheme {
  const theme = loadThemes({ trackerThemes: rows }).find((t) => t.key === key);
  if (theme === undefined) throw new Error(key);
  return theme;
}

function q(root: ParentNode, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

async function renderHost(
  theme: MapTheme,
  props: Partial<Parameters<typeof MapHost>[0]> = {},
) {
  const result = render(
    <MapHost
      mode="route"
      theme={theme}
      trackerMap={TRACKER_MAP}
      trackerBbox={null}
      path={PATH}
      terrainControl
      fullscreenControl
      onToggleFullscreen={() => {}}
      onFail={() => {}}
      {...props}
    />,
  );
  await settle();
  return result;
}

function buildBundle(): ContentBundle {
  return {
    content: { pages: [], nav: [] } as unknown as ContentDocument,
    media: {},
    icons: {},
  } as unknown as ContentBundle;
}

async function renderSection(trackerThemes: unknown = ROUTE_THEME_ROWS) {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        routeMap: { path: PATH, timeline: [], durationMinutes: 10, timed: false },
        trackerMap: { id: 3, ...TRACKER_MAP },
      },
      trackerThemes,
    } as unknown as Snapshot,
  }));
  const result = render(
    <MemoryRouter>
      <RoutePreview data={{}} items={[]} bundle={buildBundle()} />
    </MemoryRouter>,
  );
  await settle();
  return result;
}

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.observers.length = 0;
  mocks.renderer = "maplibre";
  installFakeGoogle();
  resetFakeGoogle();
  window.localStorage.clear();
  const flat = routeStyle("route-light");
  stubThemeFetch({
    extra: { [FLAT_URL]: { ...flat, layers: flat.layers.filter((l) => l.id !== "terrain-hillshade") } },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      entry: { callback: () => void; targets: Element[] };
      constructor(callback: () => void) {
        this.entry = { callback, targets: [] };
        mocks.observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.targets.push(target);
      }
      disconnect() {
        this.entry.targets = [];
      }
    },
  );
  document.documentElement.setAttribute("data-theme", "light");
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("route mode theme", () => {
  it("draws the theme flagged for each appearance", async () => {
    await renderSection();
    expect(backgroundOf(mocks.maps[0].options.style as StyleShape)).toBe(backgroundOf(routeStyle("route-light")));
    cleanup();

    document.documentElement.setAttribute("data-theme", "dark");
    const { container } = await renderSection();
    expect(backgroundOf(mocks.maps[1].options.style as StyleShape)).toBe(backgroundOf(routeStyle("route-dark")));
    expect(q(container, "route-map")?.getAttribute("data-map-theme")).toBe("route-dark");
  });

  it("draws the first enabled MapLibre theme when none carries the flag", async () => {
    const rows = ROUTE_THEME_ROWS.map((row) => ({ ...row, defaultLightMode: false, defaultDarkMode: false }));
    document.documentElement.setAttribute("data-theme", "dark");
    const { container } = await renderSection(rows);
    expect(q(container, "route-map")?.getAttribute("data-map-theme")).toBe("route-light");
  });

  it("re-resolves on a scheme change and diffs the style on the same map", async () => {
    const { container } = await renderSection();
    const map = mocks.maps[0];
    expect(map.setStyle).not.toHaveBeenCalled();
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    await settle();
    expect(mocks.maps).toHaveLength(1);
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    const [style, options] = map.setStyle.mock.calls[0] as [StyleShape, unknown];
    expect(options).toEqual({ diff: true });
    expect(backgroundOf(style)).toBe(backgroundOf(routeStyle("route-dark")));
    expect(q(container, "route-map")?.getAttribute("data-map-theme")).toBe("route-dark");
  });

  it("applies a new theme prop to the same map as a diff", async () => {
    const { rerender } = render(
      <MapHost mode="route" theme={themeOf("route-light")} trackerMap={TRACKER_MAP} trackerBbox={null} path={PATH} onFail={() => {}} />,
    );
    await settle();
    rerender(
      <MapHost mode="route" theme={themeOf("route-dark")} trackerMap={TRACKER_MAP} trackerBbox={null} path={PATH} onFail={() => {}} />,
    );
    await settle();
    expect(mocks.maps).toHaveLength(1);
    expect(mocks.maps[0].setStyle).toHaveBeenCalledWith(expect.anything(), { diff: true });
  });
});

describe("route mode bounds and fit", () => {
  it("takes the box as maxBounds with its fitted least zoom, and the row's zoom range", async () => {
    await renderHost(themeOf("route-light"), { trackerBbox: BOX });
    const options = mocks.maps[0].options;
    expect(options.maxBounds).toEqual([[-114.5, 46.5], [-113.5, 47.2]]);
    expect(typeof options.minZoom).toBe("number");
    expect(options.maxZoom).toBe(15);
  });

  it("fits the path on mount and again on every resize", async () => {
    await renderHost(themeOf("route-light"), { trackerBbox: BOX });
    const map = mocks.maps[0];
    expect(map.options.bounds).toEqual([[-114.0, 46.85], [-113.9, 46.9]]);
    expect(mocks.observers).toHaveLength(1);
    act(() => mocks.observers[0].callback());
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.setMinZoom).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.calls[0][0]).toEqual([[-114.0, 46.85], [-113.9, 46.9]]);
  });

  it("clamps the fitted path to the box only where it leaves it", async () => {
    await renderHost(themeOf("route-light"), { trackerBbox: { ...BOX, east: -113.95 } });
    expect(mocks.maps[0].options.bounds).toEqual([[-114.0, 46.85], [-113.95, 46.9]]);
  });
});

describe("route mode terrain", () => {
  it("shows the toggle, on, with a terrain URL and a terrain layer", async () => {
    const { container } = await renderHost(themeOf("route-light"));
    expect(q(container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("true");
    expect(hasHillshade(lastStyle(mocks.maps[0]))).toBe(true);
  });

  it("hides the toggle without a terrain URL", async () => {
    const { container } = await renderHost(themeOf("route-light"), {
      trackerMap: { ...TRACKER_MAP, terrainUrl: null },
    });
    expect(q(container, "route-map-terrain")).toBeNull();
    expect(q(container, "route-map-fullscreen")).not.toBeNull();
    expect(hasHillshade(lastStyle(mocks.maps[0]))).toBe(false);
  });

  it("hides the toggle when the theme has no terrain layer", async () => {
    const rows = [{ ...ROUTE_THEME_ROWS[0], key: "flat", styleUrl: FLAT_URL }];
    const { container } = await renderHost(themeOf("flat", rows));
    expect(q(container, "route-map-terrain")).toBeNull();
    expect(hasHillshade(lastStyle(mocks.maps[0]))).toBe(false);
  });

  it("remembers the choice and restores it on the next mount", async () => {
    const first = await renderHost(themeOf("route-light"));
    await act(async () => {
      fireEvent.click(q(first.container, "route-map-terrain")!);
    });
    expect(window.localStorage.getItem(TERRAIN_KEY)).toBe("off");
    expect(hasHillshade(lastStyle(mocks.maps[0]))).toBe(false);
    expect(mocks.maps[0].setStyle).toHaveBeenLastCalledWith(expect.anything(), { diff: true });
    cleanup();

    const second = await renderHost(themeOf("route-light"));
    expect(q(second.container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("false");
    expect(hasHillshade(lastStyle(mocks.maps[1]))).toBe(false);
  });
});

describe("route mode on Google", () => {
  const BOTH = [...ROUTE_THEME_ROWS, ...GOOGLE_THEME_ROWS];

  function googleStyles(map: FakeMap): google.maps.MapTypeStyle[] {
    const calls = map.optionsCalls.filter((c) => "styles" in c);
    return (calls.length > 0 ? calls[calls.length - 1].styles : map.createOptions.styles) as google.maps.MapTypeStyle[];
  }

  function startsWith(styles: google.maps.MapTypeStyle[], theme: google.maps.MapTypeStyle[]): boolean {
    return JSON.stringify(styles.slice(0, theme.length)) === JSON.stringify(theme);
  }

  it("loads the map chunk's Google route mode and never builds a MapLibre map", async () => {
    vi.mocked(loadMaps).mockClear();
    mocks.renderer = "google";
    const { container } = await renderSection(BOTH);
    await settle();
    expect(loadMaps).toHaveBeenCalledTimes(1);
    expect(FakeMap.instances).toHaveLength(1);
    expect(mocks.maps).toHaveLength(0);
    expect(q(container, "route-map")?.getAttribute("data-renderer")).toBe("google");
    expect(q(container, "route-map-terrain")).not.toBeNull();
  });

  it("draws the Google theme flagged for each appearance", async () => {
    mocks.renderer = "google";
    const light = await renderSection(BOTH);
    expect(q(light.container, "route-map")?.getAttribute("data-map-theme")).toBe("standard");
    expect(startsWith(googleStyles(FakeMap.instances[0]), googleStyle("standard"))).toBe(true);
    cleanup();

    document.documentElement.setAttribute("data-theme", "dark");
    const dark = await renderSection(BOTH);
    expect(q(dark.container, "route-map")?.getAttribute("data-map-theme")).toBe("night");
    expect(startsWith(googleStyles(FakeMap.instances[1]), googleStyle("night"))).toBe(true);
  });

  it("draws the first enabled Google theme when none carries the flag", async () => {
    mocks.renderer = "google";
    const rows = BOTH.map((row) => ({ ...row, defaultLightMode: false, defaultDarkMode: false }));
    const { container } = await renderSection(rows);
    expect(q(container, "route-map")?.getAttribute("data-map-theme")).toBe("standard");
  });

  it("re-resolves on a scheme change and applies the styles to the same map", async () => {
    mocks.renderer = "google";
    const { container } = await renderSection(BOTH);
    const map = FakeMap.instances[0];
    expect(map.optionsCalls.some((c) => "styles" in c)).toBe(false);
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    await settle();
    expect(FakeMap.instances).toHaveLength(1);
    expect(startsWith(googleStyles(map), googleStyle("night"))).toBe(true);
    expect(q(container, "route-map")?.getAttribute("data-map-theme")).toBe("night");
  });

  it("switches the map type with the terrain toggle and remembers the choice", async () => {
    mocks.renderer = "google";
    const { container } = await renderSection(BOTH);
    const map = FakeMap.instances[0];
    expect(map.createOptions.mapTypeId).toBe("terrain");
    await act(async () => {
      fireEvent.click(q(container, "route-map-terrain")!);
    });
    expect(map.mapTypeId).toBe("roadmap");
    expect(window.localStorage.getItem(TERRAIN_KEY)).toBe("off");
  });
});
