// docs/site.md sections 8.1, 8.9, 8.10 (Runtime fallback), and 16. A
// MapLibre surface falls back to Google at runtime:
//  - Live, in MapView: a failed MapLibre chunk (`chunk_failed`), a failed
//    style body or MapLibre style (`style_failed`), and a lost WebGL
//    context (`context_lost`) each tear the MapLibre controller down and
//    build the Google controller in the same container with the Google
//    theme the caller answers.
//  - Live, in the Map section: the Google theme keeps the viewer's stored
//    key when a Google theme has it and resolves the appearance's default
//    otherwise; one `map_renderer_fallback` event carries `surface` and
//    `reason`; the toggles and the flight history reach the Google map;
//    the picker then offers the Google themes; a Google failure after
//    that keeps the "map unavailable" panel.
//  - Route: a style error or a lost context rebuilds the same view
//    through route mode on Google with one event; a Google failure after
//    that renders `emptyText`.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MapView, type MapViewOptions, type MaplibreModule } from "../../../src/map/MapView";
import { loadMaps } from "../../../src/map/loadMaps";
import { sendEvent } from "../../../src/lib/analytics";
import { resetRendererReportsForTests, type FallbackReason } from "../../../src/map/renderer";
import { loadThemes, THEME_STORAGE_KEY, type MapTheme } from "../../../src/map/themes";
import type { MapController } from "../../../src/map/mapController";
import type { MaplibreControllerOptions } from "../../../src/mapHost/maplibreController";
import { store } from "../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../src/contracts";
import { RoutePreview } from "../../../src/content/sections/RoutePreview/RoutePreview";
import { CONTEXT_RESTORE_MS } from "../../../src/mapHost/handle";
import { resetTrackerTogglesForTests } from "../../../src/content/sections/Map/trackerToggles";
import { FakeMap, FakeMapObject, fakeLibs, installFakeGoogle, resetFakeGoogle } from "./fakeGoogle";
import { FakeMlMap, resetFakeMaplibre } from "../mapHost/fakeMaplibre";
import {
  GOOGLE_THEME_ROWS,
  ROUTE_THEME_ROWS,
  googleStyle,
  stubThemeFetch,
} from "../mapHost/routeThemes";

const mocks = vi.hoisted(() => ({
  // The MapLibre controllers the Map section's chunk built, with the
  // `onFail` each was given.
  built: [] as { controller: Record<string, ReturnType<typeof vi.fn>>; onFail: (reason: string, error: unknown) => void }[],
}));

vi.mock("maplibre-gl", async () => (await import("../mapHost/fakeMaplibre")).fakeMaplibreModule);
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));
vi.mock("pmtiles", () => {
  class Protocol {
    tile = vi.fn();
  }
  return { Protocol };
});
vi.mock("../../../src/map/loadMaps", () => ({ loadMaps: vi.fn() }));
vi.mock("../../../src/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/analytics")>();
  return { ...actual, sendEvent: vi.fn() };
});
vi.mock("../../../src/map/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/map/renderer")>();
  return { ...actual, reportRenderer: vi.fn(() => "maplibre") };
});
// The Map section's MapLibre chunk: a controller that records its calls
// and hands its `onFail` to the test.
vi.mock("../../../src/mapHost/maplibreController", () => ({
  createMaplibreController: vi.fn((_container: HTMLElement, opts: MaplibreControllerOptions) => {
    const controller = {
      setTheme: vi.fn(async () => {}),
      setPois: vi.fn(),
      setMapType: vi.fn(),
      setFlightHistory: vi.fn(),
      setViewpoints: vi.fn(),
      setToggles: vi.fn(),
      setLiveFix: vi.fn(),
      follow: vi.fn(),
      recenter: vi.fn(),
      zoomBy: vi.fn(),
      fitHistory: vi.fn(),
      enableUserLocation: vi.fn(async () => {}),
      disableUserLocation: vi.fn(),
      getUserLocation: vi.fn(() => null),
      destroy: vi.fn(),
    };
    mocks.built.push({ controller, onFail: opts.onFail });
    return controller;
  }),
}));

const loadMapsMock = vi.mocked(loadMaps);
const sendEventMock = vi.mocked(sendEvent);

const BOX = { west: -114.5, south: 46.5, east: -113.5, north: 47.2 };
const TRACKER_MAP = {
  id: 3,
  name: "Valley",
  minZoom: 0,
  maxZoom: 15,
  tilesUrl: "https://cdn.example/basemap/tiles.pmtiles",
  terrainUrl: "https://cdn.example/basemap/terrain.pmtiles",
};

function themeList(): MapTheme[] {
  return loadThemes({ trackerThemes: [...ROUTE_THEME_ROWS, ...GOOGLE_THEME_ROWS] });
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i++) {
      await vi.dynamicImportSettled();
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

beforeEach(() => {
  installFakeGoogle();
  resetFakeGoogle();
  resetFakeMaplibre();
  resetRendererReportsForTests();
  resetTrackerTogglesForTests();
  mocks.built.length = 0;
  sendEventMock.mockClear();
  loadMapsMock.mockReset();
  loadMapsMock.mockImplementation(async () => fakeLibs() as never);
  stubThemeFetch();
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.setAttribute("data-theme", "light");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the live surface in MapView", () => {
  function fakeModule(): MaplibreModule {
    return {
      createMaplibreController: vi.fn((_c: HTMLElement, opts: MaplibreControllerOptions) => {
        const controller = { destroy: vi.fn() } as unknown as MapController;
        mocks.built.push({ controller: controller as never, onFail: opts.onFail });
        return controller;
      }),
    } as unknown as MaplibreModule;
  }

  function mount(load: () => Promise<MaplibreModule>, mlTheme?: MapTheme) {
    const themes = themeList();
    const google = themes.find((t) => t.key === "night")!;
    const onFallback = vi.fn((_reason: FallbackReason) => google);
    const seen: (MapController | null)[] = [];
    const options: MapViewOptions = {
      theme: mlTheme ?? themes.find((t) => t.key === "light")!,
      renderer: "maplibre",
      maplibre: { load, trackerMap: TRACKER_MAP, fix: () => null, onFallback },
      bbox: BOX,
      defaultCenter: { lat: 46.87, lng: -114 },
      defaultZoom: 11,
      showSantaMarker: true,
      showUserLocation: false,
    };
    const utils = render(<MapView options={options} onController={(c) => seen.push(c)} className="host" />);
    return { utils, onFallback, seen };
  }

  function canvas(utils: ReturnType<typeof render>): HTMLElement {
    return utils.container.querySelector("[data-map-canvas]") as HTMLElement;
  }

  it("builds the MapLibre controller from the chunk and never loads Google", async () => {
    const mod = fakeModule();
    const { utils, seen } = mount(() => Promise.resolve(mod));
    await flush();
    expect(mod.createMaplibreController).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mod.createMaplibreController).mock.calls[0][0]).toBe(canvas(utils));
    expect(loadMapsMock).not.toHaveBeenCalled();
    expect(seen[seen.length - 1]).not.toBeNull();
  });

  it("chunk_failed: a failed chunk builds the Google controller in the same container", async () => {
    const { utils, onFallback } = mount(() => Promise.reject(new Error("chunk 404")));
    await flush();
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("chunk_failed");
    expect(FakeMap.instances).toHaveLength(1);
    expect(FakeMap.instances[0].container).toBe(canvas(utils));
    expect(FakeMap.instances[0].createOptions.styles).toEqual(googleStyle("night"));
  });

  it("style_failed: a failed style body builds the Google controller", async () => {
    const mod = fakeModule();
    const broken = { ...themeList()[0], getStyle: () => Promise.reject(new Error("style 404")) };
    const { onFallback } = mount(() => Promise.resolve(mod), broken);
    await flush();
    expect(onFallback).toHaveBeenCalledWith("style_failed");
    expect(mod.createMaplibreController).not.toHaveBeenCalled();
    expect(FakeMap.instances).toHaveLength(1);
  });

  it("style_failed and context_lost from the MapLibre map tear it down and build Google once", async () => {
    for (const reason of ["style_failed", "context_lost"] as const) {
      cleanup();
      resetFakeGoogle();
      mocks.built.length = 0;
      const mod = fakeModule();
      const { utils, onFallback, seen } = mount(() => Promise.resolve(mod));
      await flush();
      const ml = mocks.built[0];
      act(() => ml.onFail(reason, new Error(reason)));
      await flush();
      act(() => ml.onFail(reason, new Error(reason)));
      await flush();
      expect(ml.controller.destroy).toHaveBeenCalledTimes(1);
      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(onFallback).toHaveBeenCalledWith(reason);
      expect(FakeMap.instances).toHaveLength(1);
      expect(FakeMap.instances[0].container).toBe(canvas(utils));
      expect(seen[seen.length - 1]).not.toBeNull();
      expect(seen[seen.length - 1]).not.toBe(ml.controller);
    }
  });
});

describe("the live surface in the Map section", () => {
  function presentation() {
    return { width: "wide", align: "center", background: { kind: "none" }, spacing: "normal" };
  }

  function seed(): void {
    act(() => {
      store.setState({
        ...initialStore,
        snapshot: {
          schemaVersion: 1,
          media: {},
          icons: {},
          content: { settings: {}, pages: [] } as unknown as ContentDocument,
          event: {
            id: 1,
            trackerBbox: BOX,
            trackerMap: TRACKER_MAP,
            flightHistory: {
              points: [
                { lat: 46.8, lng: -114.1, recordedAt: "2023-12-24T02:00:00Z" },
                { lat: 46.9, lng: -114.0, recordedAt: "2023-12-24T02:30:00Z" },
              ],
            },
          },
          trackerThemes: [...ROUTE_THEME_ROWS, ...GOOGLE_THEME_ROWS],
        } as unknown as Snapshot,
      });
    });
  }

  async function mountMap() {
    seed();
    const { Map } = await import("../../../src/content/sections/Map/Map");
    const bundle = { content: null, media: {}, icons: {} } as unknown as ContentBundle;
    const utils = render(
      <MemoryRouter>
        <Map
          data={{ flightHistoryDefault: true, controls: { themePicker: true }, presentation: presentation() }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    await flush();
    return utils;
  }

  function fail(reason: FallbackReason): void {
    act(() => mocks.built[0].onFail(reason, new Error(reason)));
  }

  function fallbackEvents() {
    return sendEventMock.mock.calls.filter(([name]) => name === "map_renderer_fallback");
  }

  it("keeps the viewer's stored key when a Google theme has it, and sends one event", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "night");
    const utils = await mountMap();
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("light");
    expect(mocks.built).toHaveLength(1);
    fail("context_lost");
    await flush();
    expect(mocks.built[0].controller.destroy).toHaveBeenCalled();
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("night");
    expect(FakeMap.instances).toHaveLength(1);
    expect(FakeMap.instances[0].createOptions.styles).toEqual(googleStyle("night"));
    expect(fallbackEvents()).toEqual([["map_renderer_fallback", { surface: "live", reason: "context_lost" }]]);
  });

  it("resolves the appearance's Google default when the stored key names no Google theme", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const utils = await mountMap();
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("dark");
    fail("style_failed");
    await flush();
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("standard");
    expect(fallbackEvents()).toEqual([["map_renderer_fallback", { surface: "live", reason: "style_failed" }]]);
  });

  it("carries the flight history over and offers the Google themes in the picker", async () => {
    const utils = await mountMap();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    const before = utils
      .getAllByRole("radio")
      .map((b) => b.getAttribute("data-testid"))
      .filter((id) => id?.startsWith("tracker-menu-theme-"));
    expect(before).toEqual(["tracker-menu-theme-light", "tracker-menu-theme-dark"]);
    fail("context_lost");
    await flush();
    const google = FakeMap.instances[0];
    expect([...FakeMapObject.live].filter((o) => o.map === google && "path" in o.opts).length).toBeGreaterThan(0);
    const after = utils
      .getAllByRole("radio")
      .map((b) => b.getAttribute("data-testid"))
      .filter((id) => id?.startsWith("tracker-menu-theme-"));
    expect(after).toEqual(["tracker-menu-theme-standard", "tracker-menu-theme-night"]);
  });

  it("keeps the map unavailable panel when Google fails after the fallback", async () => {
    loadMapsMock.mockImplementation(() => Promise.reject(new Error("Google Maps did not answer in 15 s")));
    const utils = await mountMap();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fail("chunk_failed");
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
    }
    expect(utils.getByTestId("map-unavailable")).toBeTruthy();
    expect(fallbackEvents()).toHaveLength(1);
  });
});

describe("the route surface", () => {
  const EMPTY = "The route is not published yet.";
  const PATH = [
    { lat: 46.87, lng: -114.0 },
    { lat: 46.9, lng: -113.95 },
    { lat: 46.85, lng: -113.9 },
  ];

  function mountRoute() {
    act(() => {
      store.setState((s) => ({
        ...s,
        snapshot: {
          schemaVersion: 1,
          event: {
            id: 1,
            routeMap: { path: PATH, timeline: [], durationMinutes: 5, timed: false },
            trackerMap: TRACKER_MAP,
            trackerBbox: BOX,
          },
          trackerThemes: [...ROUTE_THEME_ROWS, ...GOOGLE_THEME_ROWS],
        } as unknown as Snapshot,
      }));
    });
    const bundle = { content: { pages: [] }, media: {}, icons: {} } as unknown as ContentBundle;
    return render(
      <MemoryRouter>
        <RoutePreview data={{ emptyText: EMPTY }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
  }

  function fallbackEvents() {
    return sendEventMock.mock.calls.filter(([name]) => name === "map_renderer_fallback");
  }

  it("rebuilds the view through route mode on Google after a style error", async () => {
    const utils = mountRoute();
    await flush();
    expect(FakeMlMap.instances).toHaveLength(1);
    const ml = FakeMlMap.instances[0];
    expect(ml.style().layers.some((l) => l.id === "background")).toBe(true);
    act(() => ml.fire("error", { error: new Error("glyphs 404") }));
    await flush();
    await flush();
    expect(ml.remove).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId("route-map").getAttribute("data-renderer")).toBe("google");
    expect(FakeMap.instances).toHaveLength(1);
    const body = googleStyle("standard");
    const styles = FakeMap.instances[0].createOptions.styles as unknown[];
    expect(styles.slice(0, body.length)).toEqual(body);
    expect(fallbackEvents()).toEqual([["map_renderer_fallback", { surface: "route", reason: "style_failed" }]]);
  });

  it("rebuilds on Google when the WebGL context stays lost for 5 s", async () => {
    const utils = mountRoute();
    await flush();
    const ml = FakeMlMap.instances[0];
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    act(() => ml.fire("webglcontextlost"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_MS);
    });
    vi.useRealTimers();
    await flush();
    await flush();
    expect(utils.getByTestId("route-map").getAttribute("data-renderer")).toBe("google");
    expect(fallbackEvents()).toEqual([["map_renderer_fallback", { surface: "route", reason: "context_lost" }]]);
  });

  it("renders emptyText when Google fails after the fallback", async () => {
    loadMapsMock.mockImplementation(() => Promise.reject(new Error("Google Maps did not answer in 15 s")));
    const utils = mountRoute();
    await flush();
    const ml = FakeMlMap.instances[0];
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    act(() => ml.fire("error", { error: new Error("tile 404") }));
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await vi.dynamicImportSettled();
        await vi.advanceTimersByTimeAsync(4000);
      });
    }
    vi.useRealTimers();
    await flush();
    expect(utils.getByTestId("route-preview-empty").textContent).toContain(EMPTY);
    expect(fallbackEvents()).toEqual([["map_renderer_fallback", { surface: "route", reason: "style_failed" }]]);
  });
});
