// docs/site.md section 8.3. The controller's lifecycle: `destroy` removes
// the map listeners and the pending zoom redraw, every method afterwards is
// a no-op, a build that fails part way leaves nothing on the map, and the
// user location never starts a watch or reports a change once destroyed.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMapController, type MapControllerOptions } from "../../../src/map/mapController";
import { createUserLocation } from "../../../src/map/userLocation";
import { resolveOfferedThemes } from "../../../src/map/themes";
import { poiStyles } from "../../../src/map/poiStyles";
import {
  FakeMap,
  FakeMapObject,
  FakeOverlayView,
  fakeLibs,
  installFakeGoogle,
  resetFakeGoogle,
} from "./fakeGoogle";

const theme = resolveOfferedThemes(null)[0];

const points = [
  { lat: 40, lng: -105, recordedAt: "2023-12-24T02:00:00Z" },
  { lat: 41, lng: -106, recordedAt: "2023-12-24T02:30:00Z" },
  { lat: 42, lng: -107, recordedAt: "2023-12-24T03:00:00Z" },
];

function options(over: Partial<MapControllerOptions> = {}): MapControllerOptions {
  return {
    theme,
    defaultCenter: { lat: 40, lng: -105 },
    defaultZoom: 8,
    showSantaMarker: true,
    showUserLocation: true,
    ...over,
  };
}

beforeEach(() => {
  installFakeGoogle();
  resetFakeGoogle();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

  it("draws the landmarks from zoom 10 while the landmarks toggle is on, and detaches them on destroy", async () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    const pane = map.panes.overlayMouseTarget;
    const count = () => pane.querySelectorAll('[data-testid="tracker-landmark"]').length;
    c.setLandmarks([
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

  it("opens the landmark popover in the container's parent when it has one", async () => {
    const host = document.createElement("div");
    const container = document.createElement("div");
    host.appendChild(container);
    const c = createMapController(fakeLibs(), container, options());
    const map = FakeMap.instances[0];
    const pane = map.panes.overlayMouseTarget;
    c.setLandmarks([{ name: "Town Hall", lat: 40, lng: -105 }]);
    map.setZoom(12);
    await Promise.resolve();
    pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')?.click();
    const popover = host.querySelector('[data-testid="tracker-landmark-popover"]');
    expect(popover?.parentElement).toBe(host);
    expect(container.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
    c.destroy();
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
  });

  it("an equal landmark list keeps the badges and an open popover in place", async () => {
    const container = document.createElement("div");
    const c = createMapController(fakeLibs(), container, options());
    const map = FakeMap.instances[0];
    const pane = map.panes.overlayMouseTarget;
    const list = () => [
      { name: "Town Hall", lat: 40, lng: -105, description: "The clock tower" },
      { name: "Fire Station", lat: 41, lng: -106 },
    ];
    c.setLandmarks(list());
    map.setZoom(12);
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]');
    const first = pane.querySelector('[data-testid="tracker-landmark"]');
    badge?.click();
    expect(container.querySelectorAll('[data-testid="tracker-landmark-popover"]')).toHaveLength(1);
    // The live poll hands the section a fresh array of the same landmarks.
    c.setLandmarks(list());
    await Promise.resolve();
    expect(pane.querySelector('[data-testid="tracker-landmark"]')).toBe(first);
    expect(container.querySelectorAll('[data-testid="tracker-landmark-popover"]')).toHaveLength(1);
    // A real edit still rebuilds.
    c.setLandmarks([{ name: "Town Hall", lat: 40, lng: -105, description: "Repainted" }]);
    await Promise.resolve();
    expect(pane.querySelectorAll('[data-testid="tracker-landmark"]')).toHaveLength(1);
    expect(pane.querySelector('[data-testid="tracker-landmark"]')).not.toBe(first);
    expect(container.querySelectorAll('[data-testid="tracker-landmark-popover"]')).toHaveLength(0);
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
  const night = resolveOfferedThemes(["night"])[0];

  it("setPois sets the theme's styles plus the filter, and a theme change keeps it", () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.setPois({ kinds: ["park", "school"] });
    expect(map.optionsCalls.at(-1)).toEqual({
      styles: poiStyles(theme.styles, { kinds: ["park", "school"] }),
    });
    c.setTheme(night);
    expect(map.optionsCalls.at(-1)).toEqual({
      styles: poiStyles(night.styles, { kinds: ["park", "school"] }),
    });
    c.setPois(null);
    expect((map.optionsCalls.at(-1) as { styles: unknown }).styles).toBe(night.styles);
  });

  it("every call after destroy is a no-op", () => {
    const c = createMapController(fakeLibs(), document.createElement("div"), options());
    const map = FakeMap.instances[0];
    c.destroy();
    c.setPois({ kinds: ["park"] });
    c.setTheme(night);
    c.setPois(null);
    expect(map.optionsCalls).toEqual([]);
  });
});
