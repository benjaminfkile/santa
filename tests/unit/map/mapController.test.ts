// docs/site.md section 8.3. The controller's lifecycle: `destroy` removes
// the map listeners and the pending zoom redraw, every method afterwards is
// a no-op, a build that fails part way leaves nothing on the map, and the
// user location never starts a watch or reports a change once destroyed.
// The bounds lock (8.2): the map is built with a strict restriction to the
// event box and the fitted minimum zoom, opens on the start view (its
// zoom raised to the minimum) or fits the whole box without one, a fix
// outside the box pans to the nearest in-box point with Santa on the edge,
// `recenter` clamps, and `fitHistory` leaves out points outside the box. `setTheme` awaits the
// theme's style body before applying `poiStyles(style, pois)`.
// The Santa motion (8.7): the first fix is placed at once on whole pixels,
// a second fix within the delay is not yet at its target and glides there
// frame by frame, the pin turns about its tip to the heading, and the
// camera never moves per frame (no `moveCamera`).
// The follow rule (8.3): frames inside the central box make no camera
// call, a frame outside makes one `panTo`, two within 500 ms make one; a
// wheel, a two touch `touchstart`, a pointer drag past 4 px, a double tap,
// or `dragstart` turns Follow off and no pan follows; `zoomBy` keeps it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMapController, type MapControllerOptions } from "../../../src/map/mapController";
import { createUserLocation } from "../../../src/map/userLocation";
import type { MapTheme } from "../../../src/map/themes";
import { poiStyles } from "../../../src/map/poiStyles";
import { fittedMinZoom } from "../../../src/map/bounds";
import { SEEDED, seededStyle } from "./themeFixtures";
import {
  FakeMap,
  FakeMapObject,
  FakeOverlayView,
  fakeLibs,
  installFakeGoogle,
  resetFakeGoogle,
} from "./fakeGoogle";
import { fakeFrames } from "./fakeFrames";

const theme = SEEDED.standard;
const VALLEY = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };

const points = [
  { lat: 40, lng: -105, recordedAt: "2023-12-24T02:00:00Z" },
  { lat: 41, lng: -106, recordedAt: "2023-12-24T02:30:00Z" },
  { lat: 42, lng: -107, recordedAt: "2023-12-24T03:00:00Z" },
];

function options(over: Partial<MapControllerOptions> = {}): MapControllerOptions {
  return {
    theme,
    style: seededStyle("standard"),
    bbox: null,
    startView: { center: { lat: 40, lng: -105 }, zoom: 8 },
    showSantaMarker: true,
    showUserLocation: true,
    ...over,
  };
}

beforeEach(() => {
  installFakeGoogle();
  resetFakeGoogle();
});

function sized(width: number, height: number): HTMLElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: width });
  Object.defineProperty(el, "clientHeight", { value: height });
  return el;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createMapController lifecycle", () => {
  it("destroy removes the map listeners and detaches everything it drew", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    c.setFlightHistory(points);
    c.setToggles({ flightHistory: true, timeLabels: true });
    c.setLiveFix("tracking", { lat: 40, lng: -105 }, true);
    await Promise.resolve();
    const map = FakeMap.instances[0];
    expect(map.listenerCount()).toBeGreaterThan(0);
    expect(FakeMapObject.live.size).toBeGreaterThan(0);
    c.destroy();
    expect(map.listenerCount()).toBe(0);
    expect(FakeMapObject.live.size).toBe(0);
    expect(FakeOverlayView.instances.every((o) => o.getMap() === null)).toBe(true);
  });

  it("a zoom redraw pending at destroy never runs, and a drag afterwards calls nothing", () => {
    vi.useFakeTimers();
    const onFollowChange = vi.fn();
    const c = createMapController(
      fakeLibs(),
      document.createElement("div"),
      options({ onFollowChange }),
    );
    c.setFlightHistory(points);
    c.setToggles({ flightHistory: true, timeLabels: false });
    const map = FakeMap.instances[0];
    map.setZoom(12);
    c.destroy();
    vi.advanceTimersByTime(500);
    map.trigger("dragstart");
    expect(FakeMapObject.live.size).toBe(0);
    expect(onFollowChange).not.toHaveBeenCalled();
  });

  it("every method is a no-op after destroy", async () => {
    const onFollowChange = vi.fn();
    const c = createMapController(
      fakeLibs(),
      document.createElement("div"),
      options({ onFollowChange }),
    );
    c.destroy();
    c.setTheme(theme);
    c.setMapType("roadmap");
    c.setFlightHistory(points);
    c.setToggles({ flightHistory: true, timeLabels: true });
    c.setLiveFix("tracking", { lat: 41, lng: -106 }, true);
    c.follow(true);
    c.recenter({ lat: 41, lng: -106 });
    c.zoomBy(1);
    c.fitHistory();
    await Promise.resolve();
    const map = FakeMap.instances[0];
    expect(FakeMapObject.live.size).toBe(0);
    expect(FakeOverlayView.instances.every((o) => o.getMap() === null)).toBe(true);
    expect(map.mapTypeId).toBe("terrain");
    expect(map.zoom).toBe(8);
    expect(onFollowChange).not.toHaveBeenCalled();
    c.destroy();
  });

  it("draws the viewpoints from zoom 10 while the viewpoints toggle is on, and detaches them on destroy", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    const pane = map.panes.overlayMouseTarget;
    const count = () => pane.querySelectorAll('[data-testid="tracker-viewpoint"]').length;
    c.setViewpoints([
      { name: "Town Hall", lat: 40, lng: -105 },
      { name: "Fire Station", lat: 41, lng: -106 },
    ]);
    await Promise.resolve();
    expect(count()).toBe(0);
    map.setZoom(12);
    await Promise.resolve();
    expect(count()).toBe(2);
    c.setToggles({ landmarks: false });
    expect(count()).toBe(0);
    c.setToggles({ landmarks: true });
    await Promise.resolve();
    expect(count()).toBe(2);
    c.destroy();
    expect(count()).toBe(0);
  });

  it("opens the viewpoint popover in the container's parent when it has one", async () => {
    const host = document.createElement("div");
    const container = document.createElement("div");
    host.appendChild(container);
    const c = createMapController(fakeLibs(), container, options());
    const map = FakeMap.instances[0];
    const pane = map.panes.overlayMouseTarget;
    c.setViewpoints([{ name: "Town Hall", lat: 40, lng: -105 }]);
    map.setZoom(12);
    await Promise.resolve();
    pane.querySelector<HTMLButtonElement>('[data-testid="tracker-viewpoint-badge"]')?.click();
    const popover = host.querySelector('[data-testid="tracker-viewpoint-popover"]');
    expect(popover?.parentElement).toBe(host);
    expect(container.querySelector('[data-testid="tracker-viewpoint-popover"]')).toBeNull();
    c.destroy();
    expect(host.querySelector('[data-testid="tracker-viewpoint-popover"]')).toBeNull();
  });

  it("an equal viewpoint list keeps the badges and an open popover in place", async () => {
    const container = document.createElement("div");
    const c = createMapController(fakeLibs(), container, options());
    const map = FakeMap.instances[0];
    const pane = map.panes.overlayMouseTarget;
    const list = () => [
      { name: "Town Hall", lat: 40, lng: -105, description: "The clock tower" },
      { name: "Fire Station", lat: 41, lng: -106 },
    ];
    c.setViewpoints(list());
    map.setZoom(12);
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-viewpoint-badge"]');
    const first = pane.querySelector('[data-testid="tracker-viewpoint"]');
    badge?.click();
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint-popover"]')).toHaveLength(1);
    // The live poll hands the section a fresh array of the same viewpoints.
    c.setViewpoints(list());
    await Promise.resolve();
    expect(pane.querySelector('[data-testid="tracker-viewpoint"]')).toBe(first);
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint-popover"]')).toHaveLength(1);
    // A real edit still rebuilds.
    c.setViewpoints([{ name: "Town Hall", lat: 40, lng: -105, description: "Repainted" }]);
    await Promise.resolve();
    expect(pane.querySelectorAll('[data-testid="tracker-viewpoint"]')).toHaveLength(1);
    expect(pane.querySelector('[data-testid="tracker-viewpoint"]')).not.toBe(first);
    expect(container.querySelectorAll('[data-testid="tracker-viewpoint-popover"]')).toHaveLength(0);
    c.destroy();
  });

  it("a build that fails part way leaves nothing on the map", () => {
    const libs = fakeLibs();
    const onChange = vi.fn();
    (libs.marker as unknown as { Marker: unknown }).Marker = FakeMapObject;
    (libs.maps as unknown as { OverlayView: unknown }).OverlayView = class {
      constructor() {
        throw new Error("overlay not ready");
      }
    };
    expect(() =>
      createMapController(libs, document.createElement("div"), options({ onUserLocationChange: onChange })),
    ).toThrow("overlay not ready");
    expect(FakeMap.instances[0].listenerCount()).toBe(0);
    expect(FakeMapObject.live.size).toBe(0);
  });
});

describe("createUserLocation after destroy", () => {
  it("an enable whose permission query settles after destroy starts no watch and reports nothing", async () => {
    let settle!: (v: { state: string }) => void;
    const watchPosition = vi.fn(() => 1);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
      permissions: {
        query: () => new Promise<{ state: string }>((res) => (settle = res)),
      },
    });
    const onChange = vi.fn();
    const map = new FakeMap(document.createElement("div"), {});
    const loc = createUserLocation(
      fakeLibs(),
      map as unknown as google.maps.Map,
      theme,
      onChange,
    );
    const pending = loc.enable();
    loc.destroy();
    settle({ state: "granted" });
    await pending;
    loc.setSanta({ lat: 40, lng: -105 });
    expect(watchPosition).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("createMapController place filter", () => {
  const night = SEEDED.night;
  const nightStyle = seededStyle("night");

  it("setPois sets the theme's styles plus the filter, and a theme change keeps it", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.setPois({ kinds: ["park", "school"] });
    expect(map.optionsCalls.at(-1)).toEqual({
      styles: poiStyles(seededStyle("standard"), { kinds: ["park", "school"] }),
    });
    await c.setTheme(night);
    expect(map.optionsCalls.at(-1)).toEqual({
      styles: poiStyles(nightStyle, { kinds: ["park", "school"] }),
    });
    c.setPois(null);
    expect((map.optionsCalls.at(-1) as { styles: unknown }).styles).toEqual(nightStyle);
  });

  it("every call after destroy is a no-op", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.destroy();
    c.setPois({ kinds: ["park"] });
    await c.setTheme(night);
    c.setPois(null);
    expect(map.optionsCalls).toEqual([]);
  });
});

describe("createMapController theme", () => {
  it("setTheme awaits the style body and then applies poiStyles(style, pois)", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.setPois({ kinds: ["park"] });
    let release: (s: google.maps.MapTypeStyle[]) => void = () => {};
    const body = seededStyle("charcoal");
    const slow: MapTheme = {
      ...SEEDED.charcoal,
      getStyle: () => new Promise((res) => (release = res)),
    };
    const calls = map.optionsCalls.length;
    const pending = c.setTheme(slow);
    await Promise.resolve();
    expect(map.optionsCalls.length).toBe(calls);
    release(body);
    await pending;
    expect(map.optionsCalls.at(-1)).toEqual({ styles: poiStyles(body, { kinds: ["park"] }) });
  });

  it("a later setTheme wins over an earlier one still waiting for its body", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    let release: (s: google.maps.MapTypeStyle[]) => void = () => {};
    const slow: MapTheme = {
      ...SEEDED.charcoal,
      getStyle: () => new Promise((res) => (release = res)),
    };
    const first = c.setTheme(slow);
    await c.setTheme(SEEDED.night);
    release(seededStyle("charcoal"));
    await first;
    expect(map.optionsCalls.at(-1)).toEqual({ styles: seededStyle("night") });
  });
});

describe("createMapController bounds", () => {
  it("is built with the strict restriction to the box and the fitted minimum zoom", () => {
    createMapController(fakeLibs(), sized(1280, 800), options({ bbox: VALLEY }));
    const opts = FakeMap.instances[0].createOptions;
    expect(opts.restriction).toEqual({ latLngBounds: VALLEY, strictBounds: true });
    expect(opts.minZoom).toBe(fittedMinZoom(VALLEY, { width: 1280, height: 800 }));
    expect(opts.minZoom).toBeGreaterThan(5);
  });

  it("without a box has no restriction and a minimum zoom of 5", () => {
    createMapController(fakeLibs(), sized(1280, 800), options());
    const opts = FakeMap.instances[0].createOptions;
    expect(opts.restriction).toBeUndefined();
    expect(opts.minZoom).toBe(5);
  });

  it("opens on the start view's centre and zoom", () => {
    createMapController(
      fakeLibs(),
      sized(1280, 800),
      options({ bbox: VALLEY, startView: { center: { lat: 46.9, lng: -114.0 }, zoom: 12 } }),
    );
    const map = FakeMap.instances[0];
    expect(map.createOptions.center).toEqual({ lat: 46.9, lng: -114.0 });
    expect(map.createOptions.zoom).toBe(12);
    expect(map.fitBoundsCalls).toEqual([]);
  });

  it("without a start view fits the whole box with no padding", () => {
    createMapController(fakeLibs(), sized(1280, 800), options({ bbox: VALLEY, startView: null }));
    const map = FakeMap.instances[0];
    expect(map.createOptions.center).toBeUndefined();
    expect(map.fitBoundsCalls).toEqual([VALLEY]);
    expect(map.fitBoundsPaddings).toEqual([0]);
    expect(map.createOptions.restriction).toEqual({ latLngBounds: VALLEY, strictBounds: true });
  });

  it("raises a start zoom below the fitted minimum zoom to it", () => {
    const least = fittedMinZoom(VALLEY, { width: 1280, height: 800 });
    createMapController(
      fakeLibs(),
      sized(1280, 800),
      options({ bbox: VALLEY, startView: { center: { lat: 46.9, lng: -114.0 }, zoom: least - 3 } }),
    );
    const map = FakeMap.instances[0];
    expect(map.createOptions.zoom).toBe(least);
    expect(map.createOptions.minZoom).toBe(least);
  });

  it("a fix outside the box pans to the nearest in-box point and Santa sits on the edge", async () => {
    const frames = fakeFrames().install();
    const c = createMapController(fakeLibs(), sized(400, 800), options({ bbox: VALLEY }));
    const map = FakeMap.instances[0];
    c.setLiveFix("tracking", { lat: 47.5, lng: -113.9 }, true);
    await Promise.resolve();
    expect(map.center).toEqual({ lat: 47.05, lng: -113.9 });
    frames.wait(600);
    c.setLiveFix("tracking", { lat: 46, lng: -115 }, true);
    frames.step(16);
    expect(map.center).toEqual({ lat: 46.75, lng: -114.3 });
    frames.wait(600);
    c.setLiveFix("tracking", { lat: 46.9, lng: -114 }, true);
    frames.step(16);
    expect(map.center).toEqual({ lat: 46.9, lng: -114 });
    expect(map.moveCameraCalls).toEqual([]);
  });

  it("recenter clamps its target to the box", () => {
    const c = createMapController(fakeLibs(), sized(400, 800), options({ bbox: VALLEY }));
    const map = FakeMap.instances[0];
    c.follow(false);
    c.recenter({ lat: 40, lng: -114 });
    expect(map.center).toEqual({ lat: 46.75, lng: -114 });
  });

  it("fitHistory fits only the points inside the box", () => {
    const c = createMapController(fakeLibs(), sized(400, 800), options({ bbox: VALLEY }));
    const map = FakeMap.instances[0];
    c.setFlightHistory([
      { lat: 46.8, lng: -114.1, recordedAt: null },
      { lat: 40, lng: -105, recordedAt: null },
      { lat: 47, lng: -113.9, recordedAt: null },
    ]);
    c.fitHistory();
    const bounds = map.fitBoundsCalls.at(-1) as { points: google.maps.LatLngLiteral[] };
    expect(bounds.points).toEqual([
      { lat: 46.8, lng: -114.1 },
      { lat: 47, lng: -113.9 },
    ]);
  });
});

describe("the Santa motion on Google", () => {
  function pin(map: FakeMap): HTMLImageElement {
    return map.panes.markerLayer.querySelector('[data-testid="santa-marker"]') as HTMLImageElement;
  }

  it("places the first fix at once on whole pixels and makes no camera call", async () => {
    fakeFrames().install();
    FakeOverlayView.shift = { x: 0.4, y: 0.6 };
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 1, headingDeg: 90 }, true);
    await Promise.resolve();
    expect(pin(map).style.left).toBe("-1050px");
    expect(pin(map).style.top).toBe("401px");
    expect(map.moveCameraCalls).toEqual([]);
    expect(map.panToCalls).toEqual([]);
    expect(pin(map).style.transformOrigin).toBe("50% 100%");
    expect(pin(map).style.transform).toBe("translate(-50%, -100%) rotate(90deg)");
  });

  it("a second fix within the delay is not yet at its target and glides there, the camera still", async () => {
    const frames = fakeFrames().install();
    // 100 px per thousandth of a degree, so the glide shows in whole pixels.
    FakeOverlayView.scale = 100_000;
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 1, headingDeg: null }, true);
    await Promise.resolve();
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 40, lng: -104.999, seq: 2, headingDeg: null }, true);
    frames.step(200);
    const left = parseFloat(pin(map).style.left);
    expect(Number.isInteger(left)).toBe(true);
    expect(left).toBeGreaterThan(-10_500_000);
    expect(left).toBeLessThan(-10_499_900);
    frames.step(3000);
    expect(pin(map).style.left).toBe("-10499900px");
    expect(map.moveCameraCalls).toEqual([]);
    expect(map.panToCalls).toEqual([]);
    expect(frames.pending()).toBe(0);
  });

  it("turns the short way about the tip and back upright for no heading", async () => {
    const frames = fakeFrames().install();
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 1, headingDeg: 350 }, true);
    await Promise.resolve();
    expect(pin(map).style.transform).toBe("translate(-50%, -100%) rotate(-10deg)");
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 40, lng: -104.999, seq: 2, headingDeg: 10 }, true);
    frames.step(3000);
    expect(pin(map).style.transform).toBe("translate(-50%, -100%) rotate(10deg)");
    c.setLiveFix("waitingForFix", null, false);
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 3, headingDeg: null }, true);
    await Promise.resolve();
    expect(pin(map).style.transform).toBe("translate(-50%, -100%) rotate(0deg)");
  });

  it("recenter makes one animated pan to the displayed position, then the follow rule applies once idle", async () => {
    const frames = fakeFrames().install();
    // Santa in the middle of the canvas.
    FakeOverlayView.shift = { x: 1250, y: 0 };
    const c = createMapController(fakeLibs(), sized(400, 800), options());
    const map = FakeMap.instances[0];
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 1, headingDeg: null }, true);
    await Promise.resolve();
    map.trigger("dragstart");
    // The drag leaves him 150 px right of the middle, outside the central box.
    FakeOverlayView.shift = { x: 1400, y: 0 };
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 40, lng: -104.999, seq: 2, headingDeg: null }, true);
    frames.step(200);
    // Santa stands outside the central box, but Follow is off.
    expect(map.panToCalls).toHaveLength(0);
    c.recenter({ lat: 40, lng: -104.999 });
    expect(map.panToCalls).toHaveLength(1);
    expect(map.panToCalls[0].lng).toBeGreaterThan(-105);
    expect(map.panToCalls[0].lng).toBeLessThan(-104.999);
    frames.step(100);
    expect(map.panToCalls).toHaveLength(1);
    map.trigger("idle");
    frames.step(16);
    expect(map.panToCalls).toHaveLength(2);
    expect(map.moveCameraCalls).toEqual([]);
  });

  it("stops the frames on destroy", () => {
    const frames = fakeFrames().install();
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 1, headingDeg: null }, true);
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 40, lng: -104.999, seq: 2, headingDeg: null }, true);
    expect(frames.pending()).toBe(1);
    c.destroy();
    expect(frames.pending()).toBe(0);
  });
});

describe("the follow rule on Google", () => {
  // Santa's first fix, (40, -105), in the middle of a 400 by 800 canvas
  // whose central box runs from 80 to 320 across and 160 to 640 down.
  function setup(over: Partial<MapControllerOptions> = {}) {
    const frames = fakeFrames().install();
    FakeOverlayView.shift = { x: 1250, y: 0 };
    const container = sized(400, 800);
    const onFollowChange = vi.fn();
    const c = createMapController(fakeLibs(), container, options({ onFollowChange, ...over }));
    const map = FakeMap.instances[0];
    return { frames, container, onFollowChange, c, map };
  }

  // A fix, then a second one gliding a few metres east, the frames left
  // to run.
  async function glide(c: ReturnType<typeof setup>["c"], frames: ReturnType<typeof setup>["frames"]) {
    c.setLiveFix("tracking", { lat: 40, lng: -105, seq: 1, headingDeg: null }, true);
    await Promise.resolve();
    frames.wait(1000);
    c.setLiveFix("tracking", { lat: 40, lng: -104.999, seq: 2, headingDeg: null }, true);
  }

  // The canvas moves so that Santa stands 150 px right of the middle,
  // outside the central box.
  function leaveBox(): void {
    FakeOverlayView.shift = { x: 1400, y: 0 };
  }

  function touchStart(touches: number): Event {
    const event = new Event("touchstart", { bubbles: true });
    Object.defineProperty(event, "touches", { value: Array.from({ length: touches }, () => ({})) });
    return event;
  }

  it("ten frames inside the central box make no camera call", async () => {
    const { frames, c, map } = setup();
    await glide(c, frames);
    frames.step(160);
    expect(map.panToCalls).toEqual([]);
    expect(map.moveCameraCalls).toEqual([]);
  });

  it("a frame outside the box makes one pan to the displayed position, and two within 500 ms make one", async () => {
    const { frames, c, map } = setup();
    await glide(c, frames);
    leaveBox();
    frames.step(16);
    expect(map.panToCalls).toHaveLength(1);
    expect(map.panToCalls[0].lat).toBe(40);
    expect(map.panToCalls[0].lng).toBeGreaterThanOrEqual(-105);
    frames.step(400);
    expect(map.panToCalls).toHaveLength(1);
    frames.step(160);
    expect(map.panToCalls).toHaveLength(2);
    expect(map.zoom).toBe(8);
    expect(map.moveCameraCalls).toEqual([]);
  });

  it("a wheel on the container turns Follow off and no pan follows", async () => {
    const { frames, container, onFollowChange, c, map } = setup();
    await glide(c, frames);
    container.dispatchEvent(new Event("wheel", { bubbles: true }));
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    leaveBox();
    frames.step(1000);
    expect(map.panToCalls).toEqual([]);
  });

  it("a second touch turns Follow off and no pan follows; one touch keeps it", async () => {
    const { frames, container, onFollowChange, c, map } = setup();
    await glide(c, frames);
    container.dispatchEvent(touchStart(1));
    expect(onFollowChange).not.toHaveBeenCalled();
    container.dispatchEvent(touchStart(2));
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    leaveBox();
    frames.step(1000);
    expect(map.panToCalls).toEqual([]);
  });

  it("a pointer drag past 4 px and a double tap turn Follow off; a press that moves 4 px does not", async () => {
    const { frames, container, onFollowChange, c } = setup();
    await glide(c, frames);
    const pointer = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 0 });
      Object.defineProperty(event, "pointerId", { value: 1 });
      container.dispatchEvent(event);
    };
    pointer("pointerdown", 0);
    pointer("pointermove", 4);
    pointer("pointerup", 4);
    expect(onFollowChange).not.toHaveBeenCalled();
    pointer("pointerdown", 0);
    pointer("pointermove", 5);
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    c.follow(true);
    container.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
  });

  it("a gesture during a follow pan drops its hold, and Follow stays off until it is pressed", async () => {
    const { frames, container, c, map } = setup();
    await glide(c, frames);
    leaveBox();
    frames.step(16);
    expect(map.panToCalls).toHaveLength(1);
    container.dispatchEvent(new Event("wheel", { bubbles: true }));
    frames.step(2000);
    expect(map.panToCalls).toHaveLength(1);
    c.recenter(null);
    expect(map.panToCalls).toHaveLength(2);
  });

  it("zoomBy keeps Follow on and the rule still pans", async () => {
    const { frames, onFollowChange, c, map } = setup();
    await glide(c, frames);
    c.zoomBy(1);
    c.zoomBy(-1);
    expect(onFollowChange).not.toHaveBeenCalled();
    leaveBox();
    frames.step(16);
    expect(map.panToCalls).toHaveLength(1);
  });

  it("destroy removes the container listeners", async () => {
    const { frames, container, onFollowChange, c } = setup();
    await glide(c, frames);
    c.destroy();
    container.dispatchEvent(new Event("wheel", { bubbles: true }));
    expect(onFollowChange).not.toHaveBeenCalled();
  });
});
