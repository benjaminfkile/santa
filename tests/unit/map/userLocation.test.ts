// docs/site.md section 8.6 and S17f. `formatDistanceMetres`: feet under
// one mile, miles to two decimals otherwise, both through the tracker's
// shared abbreviation from a thousand up. The user dot
// rebuilds its icon from the tokens on every colour-scheme change and
// renders nothing until the tokens resolve. A fix outside the event box
// reports `outside`, stands the marker 20 px inside the viewport edge on
// the way to the true position with an SVG icon centred there and a
// chevron turned to the bearing toward the true position, follows
// `bounds_changed` once per frame on the same marker and polylines, and
// splits the line into today's polyline for the first 60 percent and five
// fading ones after it; an outside fix already inside that inset is drawn
// where it is with no chevron; a fix inside keeps today's marker and one
// line. The distance is between the
// true positions either way.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUserLocation, formatDistanceMetres } from "../../../src/map/userLocation";
import { initialBearing } from "../../../src/map/outsideMarker";
import { FakeMap, FakeMapObject, FakeOverlayView, fakeLibs, installFakeGoogle, resetFakeGoogle } from "./fakeGoogle";
import { SEEDED } from "./themeFixtures";

describe("formatDistanceMetres", () => {
  it("returns the empty string for invalid input", () => {
    expect(formatDistanceMetres(Number.NaN)).toBe("");
    expect(formatDistanceMetres(-1)).toBe("");
  });

  it("uses feet under one mile", () => {
    expect(formatDistanceMetres(0)).toBe("0 ft");
    expect(formatDistanceMetres(1)).toBe("3 ft");
    expect(formatDistanceMetres(304.8)).toBe("1k ft");
    // Just under a mile: still in feet.
    expect(formatDistanceMetres(1609)).toBe("5.3k ft");
  });

  it("uses miles at one mile and above with two decimals", () => {
    expect(formatDistanceMetres(1609.344)).toBe("1.00 mi");
    expect(formatDistanceMetres(2 * 1609.344)).toBe("2.00 mi");
    expect(formatDistanceMetres(3.5 * 1609.344)).toBe("3.50 mi");
  });

  it("abbreviates miles from a thousand up", () => {
    expect(formatDistanceMetres(1000 * 1609.344)).toBe("1k mi");
  });
});

describe("createUserLocation and the event box", () => {
  const BOX = { west: -114.5, south: 46.5, east: -113.5, north: 47.2 };
  const SANTA = { lat: 46.9, lng: -113.9 };
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    installFakeGoogle();
    resetFakeGoogle();
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    document.documentElement.style.setProperty("--link", "#3366ff");
    document.documentElement.style.setProperty("--text-bright", "#ffffff");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--link");
    document.documentElement.style.removeProperty("--text-bright");
  });

  function flushFrames() {
    const run = frames;
    frames = [];
    for (const cb of run) cb(0);
  }

  // A 200 x 100 px viewport; the fake projection puts a point at
  // (lng * 10, lat * 10) plus `shift`.
  async function fixAt(lat: number, lng: number, shift = { x: 1300, y: -420 }) {
    FakeOverlayView.shift = shift;
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: (onFix: PositionCallback) => {
          onFix({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition);
          return 1;
        },
        clearWatch: vi.fn(),
      },
    });
    const libs = fakeLibs();
    const distance = vi.fn(() => 1234);
    (libs.geometry.spherical as unknown as { computeDistanceBetween: unknown }).computeDistanceBetween = distance;
    const onChange = vi.fn();
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 100 });
    const map = new FakeMap(container, {});
    const loc = createUserLocation(libs, map as unknown as google.maps.Map, SEEDED.standard, onChange, BOX);
    loc.setSanta(SANTA);
    // The projection overlay attaches on a microtask and asks for a frame.
    await Promise.resolve();
    await loc.enable();
    flushFrames();
    const objects = [...FakeMapObject.live];
    const marker = objects.find((o) => "icon" in o.opts)!;
    const lines = objects.filter((o) => "path" in o.opts);
    return { loc, map, marker, lines, distance };
  }

  function currentIcon(marker: FakeMapObject): Record<string, unknown> {
    return (marker.icons.at(-1) ?? marker.opts.icon) as Record<string, unknown>;
  }

  function fillOpacities(lines: FakeMapObject[]): number[] {
    return lines.map(
      (l) => ((l.opts.icons as { icon: { fillOpacity: number } }[])[0].icon.fillOpacity),
    );
  }

  function lineEnd(lines: FakeMapObject[]): google.maps.LatLngLiteral {
    return (lines.at(-1)!.opts.path as google.maps.LatLngLiteral[])[1];
  }

  it("a fix outside reports outside, draws the dot 20 px inside the viewport edge, turns the chevron, and fades the line", async () => {
    // The true position projects to (200, 60): clamped to (180, 60).
    const { loc, marker, lines, distance } = await fixAt(48, -110);
    const state = loc.getState();
    expect(state.outside).toBe(true);
    expect(state.position).toEqual({ lat: 48, lng: -110 });
    const at = { lat: 48, lng: -112 };
    expect(marker.opts.position).toEqual(at);

    const icon = currentIcon(marker);
    // The dot at the centre of a 40 px image, anchored there.
    expect(icon.anchor).toEqual({ x: 20, y: 20 });
    const svg = decodeURIComponent(icon.url as string);
    const bearing = Math.round(initialBearing(at, { lat: 48, lng: -110 }) * 10) / 10;
    expect(bearing).toBeGreaterThan(0);
    expect(bearing).toBeLessThan(90);
    expect(svg).toContain(`rotate(${bearing})`);
    expect(svg).toContain("translate(0 -12)");
    expect(svg).toContain('fill="#3366ff"');

    expect(lines).toHaveLength(6);
    expect(fillOpacities(lines)).toEqual([1, 0.8, 0.6, 0.45, 0.3, 0.15]);
    const from = { lat: SANTA.lat, lng: SANTA.lng };
    const paths = lines.map((l) => l.opts.path as google.maps.LatLngLiteral[]);
    expect(paths[0][0]).toEqual(from);
    expect(paths[0][1].lat).toBeCloseTo(from.lat + (at.lat - from.lat) * 0.6);
    expect(lineEnd(lines)).toEqual(at);
    for (let i = 1; i < paths.length; i++) expect(paths[i][0]).toEqual(paths[i - 1][1]);

    // The distance is between the true positions.
    const [a, b] = distance.mock.calls.at(-1) as unknown as [google.maps.LatLngLiteral, google.maps.LatLngLiteral];
    expect({ lat: a.lat, lng: a.lng }).toEqual({ lat: 48, lng: -110 });
    expect({ lat: b.lat, lng: b.lng }).toEqual(SANTA);
    expect(state.distanceMetres).toBe(1234);
  });

  it("bounds_changed moves the dot and the line end to the new clamped point once per frame", async () => {
    const { map, marker, lines } = await fixAt(48, -110);
    FakeOverlayView.shift = { x: 1320, y: -420 };
    map.trigger("bounds_changed");
    map.trigger("bounds_changed");
    expect(frames).toHaveLength(1);
    flushFrames();
    expect(marker.opts.position).toEqual({ lat: 48, lng: -114 });
    expect(lineEnd(lines)).toEqual({ lat: 48, lng: -114 });
    // The same polylines and marker, moved.
    expect([...FakeMapObject.live].filter((o) => "path" in o.opts)).toEqual(lines);
  });

  it("an outside fix already inside the viewport inset is drawn at the true position with no chevron", async () => {
    // The true position projects to (60, 53).
    const { loc, marker, lines } = await fixAt(47.3, -114, { x: 1200, y: -420 });
    expect(loc.getState().outside).toBe(true);
    expect(marker.opts.position).toEqual({ lat: 47.3, lng: -114 });
    const icon = currentIcon(marker);
    expect(icon.url).toBeUndefined();
    expect(icon.scale).toBe(8);
    expect(lineEnd(lines)).toEqual({ lat: 47.3, lng: -114 });
  });

  it("destroy removes the bounds listener and the projection overlay", async () => {
    const { loc, map } = await fixAt(48, -110);
    loc.destroy();
    expect(map.listenerCount()).toBe(0);
    expect(FakeMapObject.live.size).toBe(0);
  });

  it("a fix inside reports not outside with today's marker and one line", async () => {
    const { loc, marker, lines, distance } = await fixAt(47, -114);
    expect(loc.getState().outside).toBe(false);
    expect(marker.opts.position).toEqual({ lat: 47, lng: -114 });
    const icon = currentIcon(marker);
    expect(icon.url).toBeUndefined();
    expect(icon.scale).toBe(8);
    expect(lines).toHaveLength(1);
    expect(fillOpacities(lines)).toEqual([1]);
    const [a] = distance.mock.calls.at(-1) as unknown as [google.maps.LatLngLiteral];
    expect({ lat: a.lat, lng: a.lng }).toEqual({ lat: 47, lng: -114 });
  });

  it("without a box nothing is outside", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: (onFix: PositionCallback) => {
          onFix({ coords: { latitude: 10, longitude: 10 } } as GeolocationPosition);
          return 1;
        },
        clearWatch: vi.fn(),
      },
    });
    const map = new FakeMap(document.createElement("div"), {});
    const loc = createUserLocation(fakeLibs(), map as unknown as google.maps.Map, SEEDED.standard, vi.fn());
    await loc.enable();
    expect(loc.getState().outside).toBe(false);
  });
});
