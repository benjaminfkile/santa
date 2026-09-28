// docs/site.md section 8.9. The route map flavors derive from the tracker
// themes: every dark colour is a value of night.ts, the light labels and
// the route palettes come from standard.ts and night.ts, and the built
// style needs no sprite.

import { describe, it, expect } from "vitest";
import { DARK_FLAVOR, LIGHT_FLAVOR, ROUTE_PALETTES } from "../../../src/routeMap/flavors";
import { buildStyle, pathBounds } from "../../../src/routeMap/style";
import { nightTheme } from "../../../src/map/themes/night";
import { standardTheme } from "../../../src/map/themes/standard";

describe("route map flavors", () => {
  it("takes every dark colour from the night tracker theme", () => {
    const night = JSON.stringify(nightTheme).toLowerCase();
    for (const [key, value] of Object.entries(DARK_FLAVOR)) {
      if (typeof value !== "string") continue;
      expect(night, `${key} ${value}`).toContain(value.toLowerCase());
    }
  });

  it("takes the light labels from the standard tracker theme's chrome", () => {
    expect(LIGHT_FLAVOR.city_label).toBe(standardTheme.chrome.text);
    expect(LIGHT_FLAVOR.roads_label_minor).toBe(standardTheme.chrome.fg);
    expect(LIGHT_FLAVOR.city_label_halo).toBe(standardTheme.chrome.bg);
  });

  it("draws the route in each tracker theme's route colour", () => {
    expect(ROUTE_PALETTES.light.routeColor).toBe(standardTheme.routeColor);
    expect(ROUTE_PALETTES.light.routeOpacity).toBe(standardTheme.routeOpacity);
    expect(ROUTE_PALETTES.dark.routeColor).toBe(nightTheme.routeColor);
    expect(ROUTE_PALETTES.dark.routeOpacity).toBe(nightTheme.routeOpacity);
  });

  it("builds both styles with the same source and layer ids and no sprite icons", () => {
    const path = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }];
    const light = buildStyle("light", "https://cdn.example/basemap", path);
    const dark = buildStyle("dark", "https://cdn.example/basemap", path);
    expect(Object.keys(light.sources)).toEqual(Object.keys(dark.sources));
    expect(light.layers.map((l) => l.id)).toEqual(dark.layers.map((l) => l.id));
    expect(light.sprite).toBeUndefined();
    expect(JSON.stringify(light.layers)).not.toContain("icon-image");
    expect(light.layers[light.layers.length - 1].id).toBe("route-ends");
  });

  it("bounds a path by its extreme points", () => {
    expect(pathBounds([])).toBeNull();
    expect(pathBounds([{ lat: 1, lng: -2 }, { lat: -3, lng: 4 }])).toEqual([[-2, -3], [4, 1]]);
  });
});
