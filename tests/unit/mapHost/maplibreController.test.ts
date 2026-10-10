// docs/site.md sections 8.2, 8.3, 8.6, 8.7, and 8.10 (Live mode). The
// MapLibre tracker controller against a mocked `maplibre-gl`, over the
// seeded `light` and `dark` bodies:
//  - The first view fits the event box without a fix, centres on a fix in
//    the box at the default zoom, and takes the default centre when the
//    fix lies outside it; the map takes `maxBounds` and the fitted least
//    zoom.
//  - A fix outside the box stands Santa on its edge and pans there;
//    `recenter` and `fitHistory` clamp to the box.
//  - `setMapType` takes exactly the theme's terrain layers out and puts
//    them back; `setPois` filters the marked places layers through
//    places.ts; `setTheme` awaits the body before restyling.
//  - The flight history is one source with a line, an arrow, and a time
//    label layer while the toggle is on; the viewpoints are HTML markers
//    from zoom 10, kept when the list says the same thing; the viewer's
//    location is a marker and a dotted line, on the box edge from outside.
//  - A style error before the first idle or a WebGL context lost for 5 s
//    reports through `onFail`; `destroy` makes every method a no-op.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { FakeMarker, FakeMlMap, resetFakeMaplibre } from "./fakeMaplibre";
import { createMaplibreController, type MaplibreControllerOptions } from "../../../src/mapHost/maplibreController";
import { CONTEXT_RESTORE_MS } from "../../../src/mapHost/handle";
import { loadThemes, type MapTheme } from "../../../src/map/themes";
import { protomapsKinds } from "../../../src/mapHost/places";
import { SIGNAL_LOST_FILTER } from "../../../src/map/santaMarker";
import { ROUTE_THEME_ROWS, routeStyle } from "./routeThemes";

vi.mock("maplibre-gl", async () => (await import("./fakeMaplibre")).fakeMaplibreModule);
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));
vi.mock("pmtiles", () => {
  class Protocol {
    tile = vi.fn();
  }
  return { Protocol };
});

const BOX = { west: -114.5, south: 46.5, east: -113.5, north: 47.2 };
const TRACKER_MAP = {
  tilesUrl: "https://cdn.example/maps/valley/tiles.pmtiles",
  terrainUrl: "https://cdn.example/maps/valley/terrain.pmtiles",
  minZoom: 0,
  maxZoom: 15,
};

function themes(): Record<"light" | "dark", MapTheme> {
  const list = loadThemes({ trackerThemes: ROUTE_THEME_ROWS });
  const light = list.find((t) => t.key === "light")!;
  const dark = list.find((t) => t.key === "dark")!;
  return {
    light: { ...light, getStyle: () => Promise.resolve(routeStyle("light")) },
    dark: { ...dark, getStyle: () => Promise.resolve(routeStyle("dark")) },
  };
}

function options(over: Partial<MaplibreControllerOptions> = {}): MaplibreControllerOptions {
  return {
    theme: themes().light,
    style: routeStyle("light"),
    bbox: BOX,
    trackerMap: TRACKER_MAP,
    fix: null,
    defaultCenter: { lat: 46.87, lng: -114.0 },
    defaultZoom: 11,
    showSantaMarker: true,
    showUserLocation: true,
    onFail: vi.fn(),
    ...over,
  };
}

function build(over: Partial<MaplibreControllerOptions> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const c = createMaplibreController(container, options(over));
  const map = FakeMlMap.instances[FakeMlMap.instances.length - 1];
  return { c, map, container };
}

function layerIds(style: { layers: { id: string }[] }): string[] {
  return style.layers.map((l) => l.id);
}

function santaMarker(): FakeMarker | undefined {
  return [...FakeMarker.live].find((m) => m.element.getAttribute("data-testid") === "santa-marker");
}

const HISTORY = [
  { lat: 46.8, lng: -114.1, recordedAt: "2023-12-24T02:00:00Z" },
  { lat: 46.9, lng: -114.0, recordedAt: "2023-12-24T02:30:00Z" },
  { lat: 47.0, lng: -113.9, recordedAt: "2023-12-24T03:00:00Z" },
  // Outside the box: drawn, never fitted.
  { lat: 48.5, lng: -112.0, recordedAt: "2023-12-24T03:30:00Z" },
];

beforeEach(() => {
  resetFakeMaplibre();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the first view", () => {
  it("fits the event box when there is no fix, with the box as maxBounds", () => {
    const { map } = build();
    expect(map.options.bounds).toEqual([[BOX.west, BOX.south], [BOX.east, BOX.north]]);
    expect(map.options.center).toBeUndefined();
    expect(map.options.maxBounds).toEqual([[BOX.west, BOX.south], [BOX.east, BOX.north]]);
    expect(typeof map.options.minZoom).toBe("number");
    expect(map.options.maxZoom).toBe(15);
  });

  it("centres on a fix inside the box at the default zoom", () => {
    const { map } = build({ fix: { lat: 46.9, lng: -113.9 } });
    expect(map.options.center).toEqual([-113.9, 46.9]);
    expect(map.options.zoom).toBe(11);
    expect(map.options.bounds).toBeUndefined();
  });

  it("takes the default centre when the fix lies outside the box", () => {
    const { map } = build({ fix: { lat: 50, lng: -100 } });
    expect(map.options.center).toEqual([-114.0, 46.87]);
    expect(map.options.zoom).toBe(11);
  });
});

describe("the Santa pin and the camera", () => {
  it("stands the pin on the fix and pans there while following", () => {
    const { c, map } = build();
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    expect(santaMarker()?.lngLat).toEqual([-113.9, 46.9]);
    expect(santaMarker()?.anchor).toBe("bottom");
    expect(map.panTo).toHaveBeenLastCalledWith([-113.9, 46.9], expect.anything());
  });

  it("puts a fix outside the box on the box edge and pans to the nearest in-box point", () => {
    const { c, map } = build();
    c.setLiveFix("tracking", { lat: 48, lng: -112 }, true);
    expect(santaMarker()?.lngLat).toEqual([BOX.east, BOX.north]);
    expect(map.panTo).toHaveBeenLastCalledWith([BOX.east, BOX.north], expect.anything());
  });

  it("hides the pin while waiting for a fix and dims it while the signal is lost", () => {
    const { c } = build();
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    c.setLiveFix("signalLost", { lat: 46.9, lng: -113.9 }, false);
    expect(santaMarker()?.element.style.filter).toBe(SIGNAL_LOST_FILTER);
    expect(santaMarker()?.element.getAttribute("data-variant")).toBe("signalLost");
    c.setLiveFix("waitingForFix", null, false);
    expect(santaMarker()).toBeUndefined();
  });

  it("a drag stops following, so a new fix does not pan", () => {
    const onFollowChange = vi.fn();
    const { c, map } = build({ onFollowChange });
    map.fire("dragstart");
    expect(onFollowChange).toHaveBeenCalledWith(false);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    expect(map.panTo).not.toHaveBeenCalled();
  });

  it("recenter clamps its target to the box and follows again", () => {
    const onFollowChange = vi.fn();
    const { c, map } = build({ onFollowChange });
    c.recenter({ lat: 40, lng: -120 });
    expect(map.panTo).toHaveBeenLastCalledWith([BOX.west, BOX.south], expect.anything());
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
  });

  it("zoomBy steps the zoom", () => {
    const { c, map } = build({ fix: { lat: 46.9, lng: -113.9 } });
    c.zoomBy(1);
    expect(map.getZoom()).toBe(12);
    c.zoomBy(-2);
    expect(map.getZoom()).toBe(10);
  });

  it("fitHistory fits the points inside the box and leaves out the one outside", () => {
    const { c, map } = build();
    c.setFlightHistory(HISTORY);
    c.fitHistory();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.calls[0][0]).toEqual([[-114.1, 46.8], [-113.9, 47.0]]);
  });
});

describe("the style", () => {
  it("setMapType takes out exactly the terrain layers on roadmap and puts them back on terrain", () => {
    const { c, map } = build();
    const terrainIds = layerIds(map.style());
    expect(terrainIds).toContain("terrain-hillshade");
    c.setMapType("roadmap");
    const roadIds = layerIds(map.style());
    expect(roadIds).toEqual(terrainIds.filter((id) => id !== "terrain-hillshade"));
    expect(map.setStyle).toHaveBeenLastCalledWith(expect.anything(), { diff: true });
    c.setMapType("terrain");
    expect(layerIds(map.style())).toEqual(terrainIds);
  });

  it("setPois filters the marked places layers by the expanded Protomaps kinds, the theme's own while null", () => {
    const { c, map } = build();
    const own = map.style().layers.find((l) => l.id === "pois")!;
    const seeded = routeStyle("light").layers.find((l) => l.id === "pois") as { filter?: unknown };
    expect(own.filter).toEqual(seeded.filter);
    c.setPois({ kinds: ["park"] });
    const filtered = map.style().layers.find((l) => l.id === "pois")!;
    expect(JSON.stringify(filtered.filter)).toContain(JSON.stringify(protomapsKinds(["park"])));
    c.setPois({ kinds: [] });
    expect(map.style().layers.find((l) => l.id === "pois")!.layout?.visibility).toBe("none");
  });

  it("setTheme awaits the theme's body before restyling", async () => {
    const { c, map } = build();
    let release: (s: StyleSpecification) => void = () => {};
    const dark = { ...themes().dark, getStyle: () => new Promise<StyleSpecification>((r) => (release = r)) };
    const pending = c.setTheme(dark);
    await Promise.resolve();
    expect(map.setStyle).not.toHaveBeenCalled();
    release(routeStyle("dark"));
    await pending;
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    const background = map.style().layers.find((l) => l.id === "background")!;
    const darkBackground = routeStyle("dark").layers.find((l) => l.id === "background")!;
    expect(background.paint).toEqual(darkBackground.paint);
  });

  it("draws the flight history as one source with a line, an arrow, and a time label layer while it is on", () => {
    const { c, map } = build();
    c.setFlightHistory(HISTORY);
    expect(layerIds(map.style())).not.toContain("flight-history-line");
    c.setToggles({ flightHistory: true, timeLabels: true });
    const style = map.style();
    expect(style.sources["flight-history"]?.type).toBe("geojson");
    for (const id of ["flight-history-line", "flight-history-arrows", "flight-history-labels"]) {
      expect(style.layers.find((l) => l.id === id)?.source).toBe("flight-history");
    }
    // The 30 minute steps cross the 20 minute interval of zoom 8.
    const data = style.sources["flight-history"].data as { features: { properties: { part: string; label?: string } }[] };
    expect(data.features.filter((f) => f.properties.part === "label").map((f) => f.properties.label)).toEqual([
      "20 min",
      "1 hr",
      "1 hr 20 min",
    ]);
    c.setToggles({ flightHistory: false });
    expect(layerIds(map.style())).not.toContain("flight-history-line");
  });

  it("redraws the flight history once on a debounced zoom that changes the tables", () => {
    vi.useFakeTimers();
    const { c, map } = build();
    c.setFlightHistory(HISTORY);
    c.setToggles({ flightHistory: true });
    const before = map.setStyle.mock.calls.length;
    map.setZoom(13);
    map.setZoom(13.5);
    expect(map.setStyle.mock.calls.length).toBe(before);
    vi.advanceTimersByTime(200);
    expect(map.setStyle.mock.calls.length).toBe(before + 1);
  });
});

describe("the viewpoints", () => {
  const LIST = [
    { name: "Ridge", lat: 46.9, lng: -114.0, description: "High up" },
    { name: "Bridge", lat: 46.85, lng: -113.95 },
  ];

  it("stands one HTML marker per viewpoint from zoom 10 while the toggle is on", () => {
    const { c, map, container } = build({ fix: { lat: 46.9, lng: -113.9 } });
    c.setViewpoints(LIST);
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(2);
    c.setToggles({ landmarks: false });
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(0);
    c.setToggles({ landmarks: true });
    map.setZoom(9);
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(0);
  });

  it("leaves the markers alone when the list says the same thing", () => {
    const { c, container } = build({ fix: { lat: 46.9, lng: -113.9 } });
    c.setViewpoints(LIST);
    const first = container.querySelector('[data-testid="tracker-viewpoint"]');
    c.setViewpoints(LIST.map((l) => ({ ...l })));
    expect(container.querySelector('[data-testid="tracker-viewpoint"]')).toBe(first);
  });
});

describe("the viewer's location", () => {
  function stubGeolocation(lat: number, lng: number) {
    const watchPosition = vi.fn((onFix: PositionCallback) => {
      onFix({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition);
      return 1;
    });
    vi.stubGlobal("navigator", { ...navigator, geolocation: { watchPosition, clearWatch: vi.fn() } });
  }

  it("draws a marker and a dotted line to Santa, on the box edge from outside, measuring the true distance", async () => {
    stubGeolocation(48, -110);
    const onUserLocationChange = vi.fn();
    const { c, map } = build({ onUserLocationChange });
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    await c.enableUserLocation();
    const user = [...FakeMarker.live].find((m) => m.element.getAttribute("data-testid") === "user-location-marker");
    expect(user?.lngLat).toEqual([BOX.east, BOX.north]);
    expect(layerIds(map.style())).toContain("user-line");
    const state = c.getUserLocation();
    expect(state?.enabled).toBe(true);
    // About 340 km between the true positions, not the clamped ones.
    expect(state?.distanceMetres).toBeGreaterThan(300_000);
    c.disableUserLocation();
    expect(layerIds(map.style())).not.toContain("user-line");
    expect(c.getUserLocation()?.enabled).toBe(false);
  });
});

describe("failures and destroy", () => {
  it("reports a style error before the first idle once, and none after it", () => {
    const onFail = vi.fn();
    const { map } = build({ onFail });
    map.fire("error", { error: new Error("glyphs 404") });
    map.fire("error", { error: new Error("tile 404") });
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("style_failed");

    const later = vi.fn();
    const second = build({ onFail: later });
    second.map.fire("idle");
    second.map.fire("error", { error: new Error("tile 404") });
    expect(later).not.toHaveBeenCalled();
  });

  it("reports a WebGL context lost and not restored within 5 s", () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    const { map } = build({ onFail });
    map.fire("webglcontextlost");
    vi.advanceTimersByTime(CONTEXT_RESTORE_MS - 100);
    map.fire("webglcontextrestored");
    vi.advanceTimersByTime(1000);
    expect(onFail).not.toHaveBeenCalled();
    map.fire("webglcontextlost");
    vi.advanceTimersByTime(CONTEXT_RESTORE_MS);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("context_lost");
  });

  it("destroy removes the map and its markers, and every method is a no-op after it", async () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    const onFollowChange = vi.fn();
    const { c, map } = build({ onFail, onFollowChange });
    c.setViewpoints([{ name: "Ridge", lat: 46.9, lng: -114.0 }]);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    map.fire("webglcontextlost");
    c.destroy();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(FakeMarker.live.size).toBe(0);
    const styles = map.setStyle.mock.calls.length;
    const pans = map.panTo.mock.calls.length;
    onFollowChange.mockClear();
    await c.setTheme(themes().dark);
    c.setPois({ kinds: ["park"] });
    c.setMapType("roadmap");
    c.setFlightHistory(HISTORY);
    c.setToggles({ flightHistory: true });
    c.setViewpoints([{ name: "Other", lat: 46.8, lng: -114.0 }]);
    c.setLiveFix("tracking", { lat: 46.95, lng: -113.95 }, true);
    c.follow(true);
    c.recenter({ lat: 46.9, lng: -113.9 });
    c.zoomBy(1);
    c.fitHistory();
    await c.enableUserLocation();
    c.disableUserLocation();
    expect(c.getUserLocation()).toBeNull();
    map.fire("dragstart");
    map.fire("zoom");
    vi.advanceTimersByTime(CONTEXT_RESTORE_MS + 1000);
    expect(map.setStyle.mock.calls.length).toBe(styles);
    expect(map.panTo.mock.calls.length).toBe(pans);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(FakeMarker.live.size).toBe(0);
    expect(onFollowChange).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    c.destroy();
    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});
