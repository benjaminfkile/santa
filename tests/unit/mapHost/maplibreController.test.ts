// docs/site.md sections 8.2, 8.3, 8.6, 8.7, and 8.10 (Live mode). The
// MapLibre tracker controller against a mocked `maplibre-gl`, over the
// seeded `light` and `dark` bodies:
//  - The first view is the start view's centre and zoom, its zoom raised
//    to the fitted least zoom when it is below it; without a start view
//    the event box is fitted; a fix in hand at mount changes neither; the
//    map takes `maxBounds` and the fitted least zoom.
//  - The first fix is placed at once; a second fix within the playback
//    delay is not yet at its target and glides there frame by frame; the
//    pin turns through `setRotation` about its tip; the camera never moves
//    per frame (no `jumpTo`).
//  - The follow rule: frames inside the central box make no camera call,
//    a frame outside makes one `easeTo` of 300 ms with no zoom, two within
//    500 ms make one; a wheel, a two touch `touchstart`, `dragstart`, or a
//    `zoomstart` with an `originalEvent` turns Follow off, stops a running
//    follow pan, and no pan follows; `zoomBy` keeps Follow on.
//  - A fix outside the box stands Santa on its edge and follows there;
//    `recenter` and `fitHistory` clamp to the box.
//  - `setMapType` takes exactly the theme's terrain layers out and puts
//    them back; `setPois` filters the marked places layers through
//    places.ts; `setTheme` awaits the body before restyling.
//  - The flight history is one source with a line, an arrow, and a time
//    label layer while the toggle is on; the viewpoints are HTML markers
//    from zoom 10, kept when the list says the same thing; the viewer's
//    location is a marker and a dotted line; from outside the dot sits
//    20 px inside the viewport edge on the way to the true position with a
//    chevron toward it, follows every `move` through `setLngLat` and the
//    line source's `setData` without a restyle, and the line fades toward
//    the dot; an outside fix already inside that inset is drawn where it
//    is with no chevron; inside the box, no chevron and no fade.
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
import { initialBearing } from "../../../src/map/outsideMarker";
import { distanceMetres } from "../../../src/mapHost/userLocation";
import { fakeFrames } from "../map/fakeFrames";
import { fittedMinZoom } from "../../../src/map/bounds";

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
    startView: null,
    showSantaMarker: true,
    showUserLocation: true,
    onFail: vi.fn(),
    ...over,
  };
}

function build(over: Partial<MaplibreControllerOptions> = {}, size?: { width: number; height: number }) {
  const container = document.createElement("div");
  if (size !== undefined) {
    Object.defineProperty(container, "clientWidth", { value: size.width });
    Object.defineProperty(container, "clientHeight", { value: size.height });
  }
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
  vi.restoreAllMocks();
});

describe("the first view", () => {
  it("fits the event box without a start view, with the box as maxBounds", () => {
    const { map } = build();
    expect(map.options.bounds).toEqual([[BOX.west, BOX.south], [BOX.east, BOX.north]]);
    expect(map.options.center).toBeUndefined();
    expect(map.options.maxBounds).toEqual([[BOX.west, BOX.south], [BOX.east, BOX.north]]);
    expect(typeof map.options.minZoom).toBe("number");
    expect(map.options.maxZoom).toBe(15);
  });

  it("opens on the start view's centre and zoom", () => {
    const { map } = build({ startView: { center: { lat: 46.9, lng: -113.9 }, zoom: 11 } });
    expect(map.options.center).toEqual([-113.9, 46.9]);
    expect(map.options.zoom).toBe(11);
    expect(map.options.bounds).toBeUndefined();
  });

  it("raises a start zoom below the fitted least zoom to it", () => {
    const size = { width: 1280, height: 800 };
    const least = fittedMinZoom(BOX, size);
    expect(least).toBeGreaterThan(6);
    const { map } = build({ startView: { center: { lat: 46.9, lng: -113.9 }, zoom: 6 } }, size);
    expect(map.options.zoom).toBe(least);
    expect(map.options.minZoom).toBe(least);
  });
});

describe("the Santa pin and the camera", () => {
  it("places the first fix at once and makes no camera call", () => {
    fakeFrames().install();
    const { c, map } = build();
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9, seq: 1, headingDeg: 90 }, true);
    expect(santaMarker()?.lngLat).toEqual([-113.9, 46.9]);
    expect(santaMarker()?.anchor).toBe("bottom");
    expect(santaMarker()?.rotationAlignment).toBe("map");
    expect(santaMarker()?.rotation).toBe(90);
    expect(santaMarker()?.element.style.transformOrigin).toBe("50% 100%");
    expect(map.jumpTo).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.panTo).not.toHaveBeenCalled();
  });

  it("a second fix within the delay is not yet at its target and glides there, the camera still", () => {
    const frames = fakeFrames().install();
    const { c, map } = build();
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9, seq: 1, headingDeg: null }, true);
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.899, seq: 2, headingDeg: null }, true);
    frames.step(200);
    const lng = santaMarker()!.lngLat![0];
    expect(lng).toBeGreaterThan(-113.9);
    expect(lng).toBeLessThan(-113.899);
    frames.step(3000);
    expect(santaMarker()?.lngLat).toEqual([-113.899, 46.9]);
    expect(map.jumpTo).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.panTo).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
  });

  it("turns the short way: 350 then 10 passes through 0", () => {
    const frames = fakeFrames().install();
    const { c } = build();
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9, seq: 1, headingDeg: 350 }, true);
    expect(santaMarker()?.rotation).toBe(-10);
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.899, seq: 2, headingDeg: 10 }, true);
    const seen: number[] = [];
    frames.step(3000, () => seen.push(santaMarker()!.rotation));
    expect(seen.every((r) => r >= -10 && r <= 10)).toBe(true);
    expect(seen[seen.length - 1]).toBe(10);
  });

  it("recenter makes one animated pan to the displayed position, then the follow rule applies on moveend", () => {
    const frames = fakeFrames().install();
    const { c, map } = build({}, { width: 400, height: 800 });
    // Santa 150 px right of the middle, outside the central box.
    map.view = { west: -114.25, north: 47.3, scale: 1000 };
    map.fire("dragstart");
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9, seq: 1, headingDeg: null }, true);
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.899, seq: 2, headingDeg: null }, true);
    frames.step(200);
    expect(map.easeTo).not.toHaveBeenCalled();
    c.recenter({ lat: 46.9, lng: -113.899 });
    expect(map.panTo).toHaveBeenCalledTimes(1);
    expect(map.panTo).toHaveBeenLastCalledWith(santaMarker()?.lngLat, { animate: true });
    frames.step(100);
    expect(map.easeTo).not.toHaveBeenCalled();
    map.fire("moveend");
    frames.step(16);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.panTo).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it("puts a fix outside the box on the box edge and pans to the nearest in-box point", () => {
    fakeFrames().install();
    const { c, map } = build({}, { width: 400, height: 800 });
    c.setLiveFix("tracking", { lat: 48, lng: -112 }, true);
    expect(santaMarker()?.lngLat).toEqual([BOX.east, BOX.north]);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo.mock.calls[0][0]).toMatchObject({ center: [BOX.east, BOX.north], duration: 300 });
    expect(map.jumpTo).not.toHaveBeenCalled();
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
    expect(map.jumpTo).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("recenter clamps its target to the box and follows again", () => {
    const onFollowChange = vi.fn();
    const { c, map } = build({ onFollowChange });
    c.recenter({ lat: 40, lng: -120 });
    expect(map.panTo).toHaveBeenLastCalledWith([BOX.west, BOX.south], expect.anything());
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
  });

  it("zoomBy steps the zoom", () => {
    const { c, map } = build({ startView: { center: { lat: 46.9, lng: -113.9 }, zoom: 11 } });
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

describe("the follow rule", () => {
  // Santa's first fix, (46.9, -113.9), in the middle of a 400 by 800
  // container whose central box runs from 80 to 320 across and 160 to
  // 640 down; a thousandth of a degree is one pixel.
  function setup() {
    const frames = fakeFrames().install();
    const onFollowChange = vi.fn();
    const built = build({ onFollowChange }, { width: 400, height: 800 });
    built.map.view = { west: -114.1, north: 47.3, scale: 1000 };
    return { frames, onFollowChange, ...built };
  }

  function glide(c: ReturnType<typeof setup>["c"], frames: ReturnType<typeof setup>["frames"]) {
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9, seq: 1, headingDeg: null }, true);
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.899, seq: 2, headingDeg: null }, true);
  }

  // The view moves so that Santa stands 150 px right of the middle.
  function leaveBox(map: FakeMlMap): void {
    map.view = { west: -114.25, north: 47.3, scale: 1000 };
  }

  function touchStart(touches: number): Event {
    const event = new Event("touchstart", { bubbles: true });
    Object.defineProperty(event, "touches", { value: Array.from({ length: touches }, () => ({})) });
    return event;
  }

  it("ten frames inside the central box make no camera call", () => {
    const { frames, c, map } = setup();
    glide(c, frames);
    frames.step(160);
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.jumpTo).not.toHaveBeenCalled();
    expect(map.panTo).not.toHaveBeenCalled();
  });

  it("a frame outside the box makes one 300 ms eased pan with the zoom untouched, and two within 500 ms make one", () => {
    const { frames, c, map } = setup();
    glide(c, frames);
    leaveBox(map);
    frames.step(16);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    const call = map.easeTo.mock.calls[0][0] as { center: [number, number]; duration: number; easing: (t: number) => number; zoom?: number };
    expect(call.center).toEqual(santaMarker()?.lngLat);
    expect(call.duration).toBe(300);
    expect(call.easing(0)).toBe(0);
    expect(call.easing(1)).toBe(1);
    expect("zoom" in call).toBe(false);
    frames.step(400);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    frames.step(160);
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it("a wheel on the container turns Follow off, stops the running pan, and no pan follows", () => {
    const { frames, c, map, container, onFollowChange } = setup();
    glide(c, frames);
    leaveBox(map);
    frames.step(16);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    container.dispatchEvent(new Event("wheel", { bubbles: true }));
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    expect(map.stop).toHaveBeenCalledTimes(1);
    frames.step(2000);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
  });

  it("a second touch turns Follow off and no pan follows; one touch keeps it", () => {
    const { frames, c, map, container, onFollowChange } = setup();
    glide(c, frames);
    container.dispatchEvent(touchStart(1));
    expect(onFollowChange).not.toHaveBeenCalled();
    container.dispatchEvent(touchStart(2));
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    expect(map.stop).not.toHaveBeenCalled();
    leaveBox(map);
    frames.step(1000);
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("a zoomstart from a gesture turns Follow off; one without an originalEvent keeps it", () => {
    const { frames, c, map, onFollowChange } = setup();
    glide(c, frames);
    map.fire("zoomstart", {});
    map.fire("rotatestart", {});
    expect(onFollowChange).not.toHaveBeenCalled();
    map.fire("zoomstart", { originalEvent: new Event("wheel") });
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    c.follow(true);
    map.fire("rotatestart", { originalEvent: new Event("touchmove") });
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
  });

  it("zoomBy keeps Follow on and the rule still pans", () => {
    const { frames, c, map, onFollowChange } = setup();
    glide(c, frames);
    c.zoomBy(1);
    c.zoomBy(-1);
    expect(onFollowChange).not.toHaveBeenCalled();
    leaveBox(map);
    frames.step(16);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
  });

  it("destroy removes the container listeners", () => {
    const { c, container, onFollowChange } = setup();
    c.destroy();
    container.dispatchEvent(new Event("wheel", { bubbles: true }));
    expect(onFollowChange).not.toHaveBeenCalled();
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
    const { c, map, container } = build({ startView: { center: { lat: 46.9, lng: -113.9 }, zoom: 11 } });
    c.setViewpoints(LIST);
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(2);
    c.setToggles({ landmarks: false });
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(0);
    c.setToggles({ landmarks: true });
    map.setZoom(9);
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(0);
  });

  it("leaves the markers alone when the list says the same thing", () => {
    const { c, container } = build({ startView: { center: { lat: 46.9, lng: -113.9 }, zoom: 11 } });
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

  function userMarker(): FakeMarker | undefined {
    return [...FakeMarker.live].find((m) => m.element.getAttribute("data-testid") === "user-location-marker");
  }

  function userLine(map: FakeMlMap) {
    return map.style().layers.find((l) => l.id === "user-line");
  }

  // A 200 x 100 px viewport, 100 px per degree, its top left corner at
  // (west, north).
  function sizeView(container: HTMLElement, map: FakeMlMap, west: number, north: number) {
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 100 });
    map.view = { west, north, scale: 100 };
  }

  function lineEnd(coordinates: number[][]): number[] {
    return coordinates[coordinates.length - 1];
  }

  function styleLineEnd(map: FakeMlMap): number[] {
    const source = map.style().sources["user-line"] as { data: { geometry: { coordinates: number[][] } } };
    return lineEnd(source.data.geometry.coordinates);
  }

  it("draws a marker and a dotted line to Santa, 20 px inside the viewport edge from outside, measuring the true distance", async () => {
    stubGeolocation(48, -110);
    const onUserLocationChange = vi.fn();
    const { c, map, container } = build({ onUserLocationChange });
    sizeView(container, map, -114.5, 47.2);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    await c.enableUserLocation();
    const user = userMarker();
    // The true position projects to (450, -80): clamped to (180, 20).
    expect(user?.lngLat?.[0]).toBeCloseTo(-112.7);
    expect(user?.lngLat?.[1]).toBeCloseTo(47.0);
    expect(user?.offset).toEqual([0, 0]);
    expect(styleLineEnd(map)[0]).toBeCloseTo(-112.7);
    expect(styleLineEnd(map)[1]).toBeCloseTo(47.0);
    const chevron = user?.element.querySelector('[data-testid="user-location-chevron"]') as SVGElement | null;
    expect(chevron).not.toBeNull();
    const at = { lat: user!.lngLat![1], lng: user!.lngLat![0] };
    const bearing = Math.round(initialBearing(at, { lat: 48, lng: -110 }) * 10) / 10;
    expect(chevron?.style.transform).toContain(`rotate(${bearing}deg)`);
    expect(chevron?.style.transform).toContain("translateY(-12px)");
    expect(layerIds(map.style())).toContain("user-line");
    const source = map.style().sources["user-line"] as { lineMetrics?: boolean };
    expect(source.lineMetrics).toBe(true);
    const gradient = userLine(map)?.paint?.["line-gradient"] as unknown[];
    expect(gradient.slice(0, 3)).toEqual(["interpolate", ["linear"], ["line-progress"]]);
    expect(gradient[5]).toBe(0.6);
    expect(gradient[7]).toBe(1);
    const state = c.getUserLocation();
    expect(state?.enabled).toBe(true);
    expect(state?.outside).toBe(true);
    // About 340 km between the true positions, not the clamped ones.
    expect(state?.distanceMetres).toBeGreaterThan(300_000);
    c.disableUserLocation();
    expect(layerIds(map.style())).not.toContain("user-line");
    expect(c.getUserLocation()?.enabled).toBe(false);
  });

  it("an outside dot follows a move through setLngLat and setData, with no restyle", async () => {
    stubGeolocation(48, -110);
    const { c, map, container } = build({ onUserLocationChange: vi.fn() });
    sizeView(container, map, -114.5, 47.2);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    await c.enableUserLocation();
    const styles = map.setStyle.mock.calls.length;
    // A pan east by half a degree: the clamped point moves with it.
    map.view = { ...map.view, west: -114.0 };
    map.fire("move");
    const user = userMarker();
    expect(user?.lngLat?.[0]).toBeCloseTo(-112.2);
    expect(user?.lngLat?.[1]).toBeCloseTo(47.0);
    const setData = map.sources.get("user-line")?.setData;
    expect(setData).toHaveBeenCalledTimes(1);
    const data = setData?.mock.calls[0][0] as { geometry: { coordinates: number[][] } };
    expect(data.geometry.coordinates[0]).toEqual([-113.9, 46.9]);
    expect(lineEnd(data.geometry.coordinates)[0]).toBeCloseTo(-112.2);
    expect(map.setStyle.mock.calls.length).toBe(styles);
    // A resize does the same.
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 300 });
    map.fire("resize");
    expect(userMarker()?.lngLat?.[0]).toBeCloseTo(-111.2);
    expect(map.setStyle.mock.calls.length).toBe(styles);
    c.destroy();
  });

  it("an outside fix already inside the viewport inset is drawn where it is, with no chevron", async () => {
    stubGeolocation(47.3, -114);
    const { c, map, container } = build({ onUserLocationChange: vi.fn() });
    // The true position projects to (50, 30), inside the inset.
    sizeView(container, map, -114.5, 47.6);
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    await c.enableUserLocation();
    const user = userMarker();
    expect(user?.lngLat).toEqual([-114, 47.3]);
    expect(user?.element.querySelector('[data-testid="user-location-chevron"]')).toBeNull();
    expect(styleLineEnd(map)).toEqual([-114, 47.3]);
    expect(c.getUserLocation()?.outside).toBe(true);
  });

  it("inside the box the marker has no shift or chevron and the line no gradient", async () => {
    stubGeolocation(47, -114);
    const { c, map } = build({ onUserLocationChange: vi.fn() });
    c.setLiveFix("tracking", { lat: 46.9, lng: -113.9 }, true);
    await c.enableUserLocation();
    const user = userMarker();
    expect(user?.lngLat).toEqual([-114, 47]);
    expect(user?.offset).toEqual([0, 0]);
    expect(user?.element.querySelector('[data-testid="user-location-chevron"]')).toBeNull();
    const source = map.style().sources["user-line"] as { lineMetrics?: boolean };
    expect(source.lineMetrics).toBeUndefined();
    expect(userLine(map)?.paint?.["line-gradient"]).toBeUndefined();
    const state = c.getUserLocation();
    expect(state?.outside).toBe(false);
    // About 12 km between the true positions.
    expect(state?.distanceMetres).toBeCloseTo(distanceMetres({ lat: 47, lng: -114 }, { lat: 46.9, lng: -113.9 }));
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
    const jumps = map.jumpTo.mock.calls.length;
    const eases = map.easeTo.mock.calls.length;
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
    expect(map.jumpTo.mock.calls.length).toBe(jumps);
    expect(map.easeTo.mock.calls.length).toBe(eases);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(FakeMarker.live.size).toBe(0);
    expect(onFollowChange).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    c.destroy();
    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});
