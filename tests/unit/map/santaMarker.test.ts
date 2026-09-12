// docs/site.md sections 7.6, 8.2, 8.7 and S17f. Santa marker rebuilds its
// icon from the tokens on every colour-scheme change and renders nothing
// until the tokens resolve. The brim uses `--text-bright`.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

function paintDarkPalette(): void {
  const root = document.documentElement;
  root.style.setProperty("--accent", "hsl(198 100% 72%)");
  root.style.setProperty("--err", "hsl(4 100% 72%)");
  root.style.setProperty("--text-dim", "hsl(220 20% 62%)");
  root.style.setProperty("--ground", "hsl(220 60% 8%)");
  root.style.setProperty("--text-bright", "hsl(0 0% 96%)");
  root.setAttribute("data-theme", "dark");
}

function paintLightPalette(): void {
  const root = document.documentElement;
  root.style.setProperty("--accent", "hsl(205 88% 37%)");
  root.style.setProperty("--err", "hsl(4 62% 47%)");
  root.style.setProperty("--text-dim", "hsl(220 20% 44%)");
  root.style.setProperty("--ground", "hsl(220 50% 96%)");
  root.style.setProperty("--text-bright", "hsl(220 55% 12%)");
  root.setAttribute("data-theme", "light");
}

function clearPalette(): void {
  const root = document.documentElement;
  for (const name of ["--accent", "--err", "--text-dim", "--ground", "--text-bright"]) {
    root.style.removeProperty(name);
  }
  root.removeAttribute("data-theme");
}

beforeEach(() => {
  FakeMarker.instances = [];
  (globalThis as unknown as { google: unknown }).google = {
    maps: { Point: FakePoint },
  };
  paintDarkPalette();
});

afterEach(() => {
  clearPalette();
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

  it("attaches the marker and paints the brim in --text-bright", () => {
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(marker.map).toBe(map);
    expect(marker.position).toEqual({ lat: 41, lng: -110 });
    expect(iconUrl(marker)).toMatch(/^data:image\/svg/);
    const decoded = decodeURIComponent(iconUrl(marker));
    // The brim and pom-pom carry --text-bright, the pin outline the studio path.
    expect(decoded).toContain(`fill="${document.documentElement.style.getPropertyValue("--text-bright").trim()}"`);
    expect(decoded).toContain('cx="27.5"');
    expect(decoded).toContain('d="M6 10c3-8 14-11 22-6l-2 3H8z"');
  });

  it("rebuilds its icon when the colour scheme flips", async () => {
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("tracking", { lat: 41, lng: -110 });
    const before = iconUrl(marker);
    paintLightPalette();
    // Give the MutationObserver microtask a chance to fire.
    await Promise.resolve();
    await Promise.resolve();
    const after = iconUrl(marker);
    expect(after).not.toBe(before);
  });

  it("renders nothing until the tokens resolve", () => {
    clearPalette();
    const map = { name: "map" } as unknown as google.maps.Map;
    const libs = { marker: { Marker: FakeMarker } } as unknown as { marker: google.maps.MarkerLibrary };
    const santa = createSantaMarker(libs, map);
    const marker = FakeMarker.instances[0];
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(marker.map).toBe(null);
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
