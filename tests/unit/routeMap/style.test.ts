// docs/site.md section 8.9. The optional style capabilities of the route
// poster: without options the style is the site map's own, `routeColor`
// recolours the route, `arrows` adds the arrowhead layer over the SDF
// image, and `timeLabels` adds one labelled dot per entry.

import { describe, it, expect } from "vitest";
import type { CircleLayerSpecification, LineLayerSpecification, SymbolLayerSpecification } from "maplibre-gl";
import { ROUTE_PALETTES, type Appearance } from "../../../src/routeMap/flavors";
import {
  ARROWS_LAYER,
  ROUTE_ARROW_ICON,
  ROUTE_SOURCE,
  TIME_LABELS_LAYER,
  TIME_LABELS_SOURCE,
  TIME_LABEL_DOTS_LAYER,
  buildStyle,
  makeRouteArrowImage,
} from "../../../src/routeMap/style";

const BASE = "https://cdn.example/basemap";
const PATH = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 3 }];
const MARKS = [{ lat: 2, lng: 3 }];

function layer<T>(style: ReturnType<typeof buildStyle>, id: string): T {
  const found = style.layers.find((l) => l.id === id);
  expect(found, id).toBeDefined();
  return found as T;
}

describe("route map style options", () => {
  it("reproduces the site style exactly without options", () => {
    for (const appearance of ["light", "dark"] as Appearance[]) {
      for (const terrain of [false, true]) {
        const plain = buildStyle(appearance, BASE, PATH, MARKS, terrain);
        expect(buildStyle(appearance, BASE, PATH, MARKS, terrain, {})).toEqual(plain);
        const unset = buildStyle(appearance, BASE, PATH, MARKS, terrain, {
          routeColor: undefined,
          arrows: false,
          timeLabels: [],
        });
        expect(unset).toEqual(plain);
        expect(JSON.stringify(unset)).toBe(JSON.stringify(plain));
      }
    }
  });

  it("draws the route line and the start marker in the override colour", () => {
    const style = buildStyle("light", BASE, PATH, MARKS, false, { routeColor: "#c62828" });
    const line = layer<LineLayerSpecification>(style, "route-line");
    expect(line.paint?.["line-color"]).toBe("#c62828");
    expect(line.paint?.["line-opacity"]).toBe(ROUTE_PALETTES.light.routeOpacity);
    const ends = layer<CircleLayerSpecification>(style, "route-ends");
    expect(ends.paint?.["circle-color"]).toEqual([
      "match",
      ["get", "end"],
      "start",
      "#c62828",
      ROUTE_PALETTES.light.endFill,
    ]);
    const marks = layer<CircleLayerSpecification>(style, "route-marks");
    expect(marks.paint?.["circle-stroke-color"]).toBe("#c62828");
  });

  it("adds an arrowhead symbol layer along the route line", () => {
    const plain = buildStyle("dark", BASE, PATH, MARKS);
    expect(plain.layers.some((l) => l.id === ARROWS_LAYER)).toBe(false);

    const style = buildStyle("dark", BASE, PATH, MARKS, false, { arrows: true, routeColor: "#ffb74d" });
    const arrows = layer<SymbolLayerSpecification>(style, ARROWS_LAYER);
    expect(arrows.type).toBe("symbol");
    expect(arrows.source).toBe(ROUTE_SOURCE);
    expect(arrows.layout?.["symbol-placement"]).toBe("line");
    expect(arrows.layout?.["icon-image"]).toBe(ROUTE_ARROW_ICON);
    expect(arrows.layout?.["symbol-spacing"]).toBeGreaterThanOrEqual(80);
    expect(arrows.paint?.["icon-color"]).toBe("#ffb74d");
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf(ARROWS_LAYER)).toBeGreaterThan(ids.indexOf("route-line"));
    expect(style.sprite).toBeUndefined();
  });

  it("makes an SDF arrowhead image of a sane size", () => {
    const { data, options } = makeRouteArrowImage();
    expect(options.sdf).toBe(true);
    expect(data.width).toBeGreaterThanOrEqual(16);
    expect(data.width).toBeLessThanOrEqual(128);
    expect(data.height).toBe(data.width);
    expect(data.data).toBeInstanceOf(Uint8ClampedArray);
    expect(data.data.length).toBe(data.width * data.height * 4);
    const alpha = (x: number, y: number) => data.data[(y * data.width + x) * 4 + 3];
    const mid = Math.floor(data.height / 2);
    // Inside the head the distance field is past the edge value, at the
    // corners it falls to nothing, and the head points along +x.
    expect(alpha(Math.floor(data.width * 0.55), mid)).toBeGreaterThan(191);
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(data.width - 1, mid)).toBeLessThan(191);
    expect(alpha(Math.floor(data.width * 0.7), mid)).toBeGreaterThan(191);
  });

  it("adds one labelled dot per time label with the flavor's halo pair", () => {
    const timeLabels = [
      { lat: 1, lng: 2, label: "6:00 PM" },
      { lat: 3, lng: 4, label: "7:00 PM" },
      { lat: 5, lng: 3, label: "8:00 PM" },
    ];
    for (const appearance of ["light", "dark"] as Appearance[]) {
      const style = buildStyle(appearance, BASE, PATH, MARKS, false, { timeLabels });
      const source = style.sources[TIME_LABELS_SOURCE];
      expect(source.type).toBe("geojson");
      const features = (source as { data: { features: { properties: { label: string }; geometry: unknown }[] } }).data.features;
      expect(features).toHaveLength(3);
      expect(features.map((f) => f.properties?.label)).toEqual(["6:00 PM", "7:00 PM", "8:00 PM"]);
      expect(features[1].geometry).toEqual({ type: "Point", coordinates: [4, 3] });

      const labels = layer<SymbolLayerSpecification>(style, TIME_LABELS_LAYER);
      expect(labels.source).toBe(TIME_LABELS_SOURCE);
      expect(labels.layout?.["text-field"]).toEqual(["get", "label"]);
      expect(labels.layout?.["text-font"]).toEqual(["Noto Sans Medium"]);
      expect(labels.layout?.["text-size"]).toBeGreaterThanOrEqual(16);
      expect(labels.layout?.["text-allow-overlap"]).toBeUndefined();
      expect(labels.layout?.["text-ignore-placement"]).toBeUndefined();
      expect(labels.paint?.["text-color"]).toBe(ROUTE_PALETTES[appearance].labelText);
      expect(labels.paint?.["text-halo-color"]).toBe(ROUTE_PALETTES[appearance].labelHalo);
      expect(labels.paint?.["text-halo-width"]).toBeGreaterThanOrEqual(2);

      const dots = layer<CircleLayerSpecification>(style, TIME_LABEL_DOTS_LAYER);
      expect(dots.source).toBe(TIME_LABELS_SOURCE);
      const ids = style.layers.map((l) => l.id);
      expect(ids.indexOf(TIME_LABELS_LAYER)).toBe(ids.length - 1);
    }
    expect(ROUTE_PALETTES.light).toMatchObject({ labelText: "#202124", labelHalo: "#ffffff" });
    expect(ROUTE_PALETTES.dark).toMatchObject({ labelText: "#f2f6ff", labelHalo: "#0f1a2b" });
  });
});
