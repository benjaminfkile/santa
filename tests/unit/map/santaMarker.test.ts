// docs/site.md section 8.7. Santa marker per live state:
// - waitingForFix: no marker on the map, position cleared;
// - tracking: tracking-variant icon at live.lat/lng;
// - signalLost: signal-lost variant, position stays put.

import { describe, it, expect, beforeEach } from "vitest";
import { createSantaMarker } from "../../../src/map/santaMarker";

type MarkerCall = {
  map: unknown;
  position: google.maps.LatLngLiteral | null;
  icon: unknown;
};

class FakeMarker {
  static instances: FakeMarker[] = [];
  map: unknown = null;
  position: google.maps.LatLngLiteral | null = null;
  icon: unknown = null;
  constructor(opts: Partial<MarkerCall>) {
    this.map = opts.map ?? null;
    this.position = opts.position ?? null;
    this.icon = opts.icon ?? null;
    FakeMarker.instances.push(this);
  }
  setMap(map: unknown) {
    this.map = map;
  }
  setPosition(pos: google.maps.LatLngLiteral) {
    this.position = pos;
  }
  setIcon(icon: unknown) {
    this.icon = icon;
  }
  getMap() {
    return this.map;
  }
}

class FakePoint {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

beforeEach(() => {
  FakeMarker.instances = [];
  (globalThis as unknown as { google: unknown }).google = {
    maps: { Point: FakePoint },
  };
});

function iconUrl(marker: FakeMarker): string {
  return (marker.icon as { url: string }).url;
}

describe("createSantaMarker", () => {
  it("starts detached from the map (waiting for a fix)", () => {
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("waitingForFix", { lat: 40, lng: -105 });
    expect(marker.map).toBe(null);
  });

  it("attaches the marker and tracks the fix in the tracking state", () => {
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(marker.map).toBe(map);
    expect(marker.position).toEqual({ lat: 41, lng: -110 });
    expect(iconUrl(marker)).toMatch(/^data:image\/svg/);
    const decoded = decodeURIComponent(iconUrl(marker));
    // Studio recipe: hat inline (`--err` fallback), white brim rectangle,
    // and the pom-pom circle at the tip of the hat.
    expect(decoded).toContain('fill="#ffffff"');
    expect(decoded).toContain('cx="27.5"');
    expect(decoded).toContain('d="M6 10c3-8 14-11 22-6l-2 3H8z"');
  });

  it("keeps the last position when transitioning to signalLost with no new fix", () => {
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("tracking", { lat: 41, lng: -110 });
    const tracking = iconUrl(marker);
    santa.setState("signalLost", null);
    expect(marker.map).toBe(map);
    expect(marker.position).toEqual({ lat: 41, lng: -110 });
    // Signal-lost swaps the body/hat colours to the muted variant.
    expect(iconUrl(marker)).not.toBe(tracking);
  });

  it("hides the marker again when waitingForFix returns", () => {
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(marker.map).toBe(map);
    santa.setState("waitingForFix", null);
    expect(marker.map).toBe(null);
    expect(santa.getPosition()).toBe(null);
  });
});
