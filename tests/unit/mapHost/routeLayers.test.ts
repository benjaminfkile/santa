// docs/site.md sections 8.9 and 8.10. The route overlay over a theme's
// style: the line, the marks, and the end circle in the theme's overlay
// and chrome colours (the seeded route themes give the route map's
// palette exactly); `arrows` adds the arrowhead layer over the SDF image,
// `arrowScale` scales it, `routeWidthScale` scales the line, `timeLabels`
// adds one labelled dot per entry, `viewpoints` one smaller labelled dot
// per entry (no dot and a wider label offset for a `badge` viewpoint),
// the label sizes follow the zoom curve times `labelScale`, and
// `labelMinZoom` gates the two text layers only.

import { describe, it, expect } from "vitest";
import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import {
  ARROWS_LAYER,
  ENDS_LAYER,
  ENDS_SOURCE,
  LABEL_CURVE,
  MARKS_LAYER,
  ROUTE_ARROW_ICON,
  ROUTE_LAYER,
  ROUTE_SOURCE,
  TIME_LABELS_LAYER,
  TIME_LABELS_SOURCE,
  TIME_LABEL_DOTS_LAYER,
  VIEWPOINTS_LAYER,
  VIEWPOINTS_SOURCE,
  VIEWPOINT_DOTS_LAYER,
  makeRouteArrowImage,
  routeLayers,
  type RouteLayerOptions,
} from "../../../src/mapHost/routeLayers";
import { routePalette, type RouteKey } from "./routeThemes";

const PATH = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 3 }];
const MARKS = [{ lat: 2, lng: 3 }];
const LIGHT = routePalette("light");

function build(options: RouteLayerOptions = {}, key: RouteKey = "light") {
  return routeLayers(routePalette(key), PATH, MARKS, options);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// A label text size on the zoom curve: two thirds of `full` at zoom 12
// and under, `full` at zoom 16 and over, times the scale.
function textSize(full: number, scale: number): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 12, round((full * 2 * scale) / 3), 16, round(full * scale)];
}

// Evaluates a linear zoom interpolation (or a plain number) at a zoom.
function sizeAt(value: unknown, zoom: number): number {
  if (typeof value === "number") return value;
  const stops = (value as unknown[]).slice(3) as number[];
  if (zoom <= stops[0]) return stops[1];
  for (let i = 2; i < stops.length; i += 2) {
    if (zoom <= stops[i]) {
      const [z0, v0, z1, v1] = [stops[i - 2], stops[i - 1], stops[i], stops[i + 1]];
      return v0 + ((v1 - v0) * (zoom - z0)) / (z1 - z0);
    }
  }
  return stops[stops.length - 1];
}

function layer<T>(built: ReturnType<typeof routeLayers>, id: string): T {
  const found = built.layers.find((l) => l.id === id);
  expect(found, id).toBeDefined();
  return found as T;
}

describe("route layers", () => {
  it("draws the line, the marks, and the end circle in the route map's palette", () => {
    const expected = {
      "light": { route: "#1a56c4", opacity: 0.9, stroke: "#ffffff", end: "#202124" },
      "dark": { route: "#33d6ff", opacity: 0.85, stroke: "#0f1a2b", end: "#f2f6ff" },
    } as const;
    for (const key of ["light", "dark"] as const) {
      const built = build({}, key);
      const colours = expected[key];
      expect(built.layers.map((l) => l.id)).toEqual([ROUTE_LAYER, MARKS_LAYER, ENDS_LAYER]);
      const line = layer<LineLayerSpecification>(built, ROUTE_LAYER);
      expect(line.source).toBe(ROUTE_SOURCE);
      expect(line.layout).toEqual({ "line-join": "round", "line-cap": "round" });
      expect(line.paint?.["line-color"]).toBe(colours.route);
      expect(line.paint?.["line-opacity"]).toBe(colours.opacity);
      const marks = layer<CircleLayerSpecification>(built, MARKS_LAYER);
      expect(marks.paint?.["circle-color"]).toBe(colours.stroke);
      expect(marks.paint?.["circle-stroke-color"]).toBe(colours.route);
      const ends = layer<CircleLayerSpecification>(built, ENDS_LAYER);
      expect(ends.paint?.["circle-color"]).toBe(colours.end);
      expect(ends.paint?.["circle-stroke-color"]).toBe(colours.stroke);
    }
  });

  it("feeds the path to the line and leaves only the end circle for the end marker source", () => {
    const built = build();
    const line = built.sources[ROUTE_SOURCE] as { data: { geometry: { coordinates: number[][] } } };
    expect(line.data.geometry.coordinates).toEqual(PATH.map((p) => [p.lng, p.lat]));
    const ends = built.sources[ENDS_SOURCE] as { data: { features: { geometry: { coordinates: number[] } }[] } };
    expect(ends.data.features.map((f) => f.geometry.coordinates)).toEqual([[3, 5]]);
  });

  it("adds an arrowhead symbol layer along the route line in the arrow colour", () => {
    expect(build().layers.some((l) => l.id === ARROWS_LAYER)).toBe(false);
    const built = build({ arrows: true }, "dark");
    const arrows = layer<SymbolLayerSpecification>(built, ARROWS_LAYER);
    expect(arrows.type).toBe("symbol");
    expect(arrows.source).toBe(ROUTE_SOURCE);
    expect(arrows.layout?.["symbol-placement"]).toBe("line");
    expect(arrows.layout?.["icon-image"]).toBe(ROUTE_ARROW_ICON);
    expect(arrows.layout?.["symbol-spacing"]).toBeGreaterThanOrEqual(80);
    expect(arrows.paint?.["icon-color"]).toBe(routePalette("dark").overlay.arrowColor);
    const ids = built.layers.map((l) => l.id);
    expect(ids.indexOf(ARROWS_LAYER)).toBeGreaterThan(ids.indexOf(ROUTE_LAYER));
  });

  it("scales the arrow icon size and spacing together", () => {
    const arrowsAt = (arrowScale?: number) =>
      layer<SymbolLayerSpecification>(build({ arrows: true, arrowScale }), ARROWS_LAYER).layout;
    const defaults = arrowsAt();
    expect(arrowsAt(1)).toEqual(defaults);
    expect(defaults?.["icon-size"]).toBe(1);
    expect(defaults?.["symbol-spacing"]).toBe(140);
    const scaled = arrowsAt(1.5);
    expect(scaled?.["icon-size"]).toBe(1.5);
    expect(scaled?.["symbol-spacing"]).toBe(210);
    expect(arrowsAt(0)).toEqual(defaults);
    expect(arrowsAt(-2)).toEqual(defaults);
  });

  it("scales the route line width at every zoom stop", () => {
    const widthAt = (routeWidthScale?: number) =>
      layer<LineLayerSpecification>(build({ routeWidthScale }), ROUTE_LAYER).paint?.["line-width"];
    expect(widthAt()).toEqual(["interpolate", ["linear"], ["zoom"], 8, 3, 14, 5]);
    expect(widthAt(0.75)).toEqual(["interpolate", ["linear"], ["zoom"], 8, 2.25, 14, 3.75]);
    expect(widthAt(2)).toEqual(["interpolate", ["linear"], ["zoom"], 8, 6, 14, 10]);
    expect(widthAt(0)).toEqual(widthAt());
    expect(widthAt(-3)).toEqual(widthAt());
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

  it("adds one labelled dot per time label in the theme's label pair", () => {
    const timeLabels = [
      { lat: 1, lng: 2, label: "15m" },
      { lat: 3, lng: 4, label: "30m" },
      { lat: 5, lng: 3, label: "45m" },
    ];
    for (const key of ["light", "dark"] as const) {
      const { overlay } = routePalette(key);
      const built = build({ timeLabels }, key);
      const source = built.sources[TIME_LABELS_SOURCE] as {
        type: string;
        data: { features: { properties: { label: string }; geometry: unknown }[] };
      };
      expect(source.type).toBe("geojson");
      expect(source.data.features.map((f) => f.properties.label)).toEqual(["15m", "30m", "45m"]);
      expect(source.data.features[1].geometry).toEqual({ type: "Point", coordinates: [4, 3] });

      const labels = layer<SymbolLayerSpecification>(built, TIME_LABELS_LAYER);
      expect(labels.source).toBe(TIME_LABELS_SOURCE);
      expect(labels.layout?.["text-field"]).toEqual(["get", "label"]);
      expect(labels.layout?.["text-font"]).toEqual(["Noto Sans Medium"]);
      expect(labels.layout?.["text-size"]).toEqual(textSize(20, 1));
      expect(labels.layout?.["text-allow-overlap"]).toBeUndefined();
      expect(labels.paint?.["text-color"]).toBe(overlay.timeLabelFg);
      expect(labels.paint?.["text-halo-color"]).toBe(overlay.timeLabelBg);
      expect(labels.paint?.["text-halo-width"]).toBeGreaterThanOrEqual(2);

      const dots = layer<CircleLayerSpecification>(built, TIME_LABEL_DOTS_LAYER);
      expect(dots.source).toBe(TIME_LABELS_SOURCE);
      const ids = built.layers.map((l) => l.id);
      expect(ids.indexOf(TIME_LABELS_LAYER)).toBe(ids.length - 1);
    }
    expect(routePalette("light").overlay).toMatchObject({ timeLabelFg: "#202124", timeLabelBg: "#ffffff" });
    expect(routePalette("dark").overlay).toMatchObject({ timeLabelFg: "#f2f6ff", timeLabelBg: "#0f1a2b" });
  });

  it("adds one smaller labelled dot per viewpoint, apart from the time labels", () => {
    const viewpoints = [
      { lat: 46.87, lng: -114.0, label: "Missoula Airport" },
      { lat: 46.9, lng: -113.95, label: "Mount Jumbo" },
    ];
    const timeLabels = [{ lat: 1, lng: 2, label: "15m" }];
    for (const key of ["light", "dark"] as const) {
      const { overlay, chrome } = routePalette(key);
      const built = build({ viewpoints, timeLabels }, key);
      const source = built.sources[VIEWPOINTS_SOURCE] as {
        data: { features: { properties: { label: string }; geometry: unknown }[] };
      };
      expect(source.data.features.map((f) => f.properties.label)).toEqual(["Missoula Airport", "Mount Jumbo"]);
      expect(source.data.features[1].geometry).toEqual({ type: "Point", coordinates: [-113.95, 46.9] });

      const labels = layer<SymbolLayerSpecification>(built, VIEWPOINTS_LAYER);
      const timeLayer = layer<SymbolLayerSpecification>(built, TIME_LABELS_LAYER);
      expect(labels.source).toBe(VIEWPOINTS_SOURCE);
      expect(labels.minzoom).toBeUndefined();
      expect(labels.layout?.["text-size"]).toEqual(textSize(14, 1));
      expect(labels.paint?.["text-color"]).toBe(overlay.timeLabelFg);
      expect(labels.paint?.["text-halo-color"]).toBe(overlay.timeLabelBg);
      expect(labels.paint?.["text-halo-width"]).toBe(timeLayer.paint?.["text-halo-width"]);

      const dots = layer<CircleLayerSpecification>(built, VIEWPOINT_DOTS_LAYER);
      const timeDots = layer<CircleLayerSpecification>(built, TIME_LABEL_DOTS_LAYER);
      expect(dots.minzoom).toBeUndefined();
      expect(dots.paint?.["circle-color"]).toBe(chrome.fg);
      expect(dots.paint?.["circle-stroke-color"]).toBe(chrome.bg);
      expect(dots.paint).not.toEqual(timeDots.paint);

      const ids = built.layers.map((l) => l.id);
      expect(ids.indexOf(VIEWPOINT_DOTS_LAYER)).toBeGreaterThan(ids.indexOf(ENDS_LAYER));
      expect(ids.indexOf(VIEWPOINTS_LAYER)).toBe(ids.indexOf(VIEWPOINT_DOTS_LAYER) + 1);
      expect(ids.indexOf(TIME_LABEL_DOTS_LAYER)).toBeGreaterThan(ids.indexOf(VIEWPOINTS_LAYER));
    }
    expect(routePalette("light").chrome).toMatchObject({ fg: "#5f6368", bg: "#ffffff" });
    expect(routePalette("dark").chrome).toMatchObject({ fg: "#8fa3c2", bg: "#0f1a2b" });
  });

  it("leaves the dot off a badge viewpoint and sets its label further out", () => {
    const plainViewpoints = [
      { lat: 46.87, lng: -114.0, label: "Missoula Airport" },
      { lat: 46.9, lng: -113.95, label: "Mount Jumbo" },
    ];
    const plain = build({ viewpoints: plainViewpoints });
    expect(layer<CircleLayerSpecification>(plain, VIEWPOINT_DOTS_LAYER).filter).toBeUndefined();
    expect(layer<SymbolLayerSpecification>(plain, VIEWPOINTS_LAYER).layout?.["text-radial-offset"]).toBe(0.5);
    const explicit = build({ viewpoints: plainViewpoints.map((l) => ({ ...l, badge: false })) });
    expect(JSON.stringify(explicit)).toBe(JSON.stringify(plain));

    const built = build({ viewpoints: [plainViewpoints[0], { ...plainViewpoints[1], badge: true }] });
    const source = built.sources[VIEWPOINTS_SOURCE] as {
      data: { features: { properties: Record<string, unknown> }[] };
    };
    expect(source.data.features.map((f) => f.properties)).toEqual([
      { label: "Missoula Airport" },
      { label: "Mount Jumbo", badge: true },
    ]);
    expect(layer<CircleLayerSpecification>(built, VIEWPOINT_DOTS_LAYER).filter).toEqual(["!", ["has", "badge"]]);
    expect(layer<SymbolLayerSpecification>(built, VIEWPOINTS_LAYER).layout?.["text-radial-offset"]).toEqual([
      "case",
      ["has", "badge"],
      1.3,
      0.5,
    ]);
  });

  describe("label sizes", () => {
    const timeLabels = [{ lat: 1, lng: 2, label: "15m" }];
    const viewpoints = [{ lat: 3, lng: 4, label: "Caras Park" }];
    const sizes = (options: RouteLayerOptions = {}) => {
      const built = build({ timeLabels, viewpoints, ...options });
      return {
        timeText: layer<SymbolLayerSpecification>(built, TIME_LABELS_LAYER).layout?.["text-size"],
        viewpointText: layer<SymbolLayerSpecification>(built, VIEWPOINTS_LAYER).layout?.["text-size"],
        timeDot: layer<CircleLayerSpecification>(built, TIME_LABEL_DOTS_LAYER).paint?.["circle-radius"],
        viewpointDot: layer<CircleLayerSpecification>(built, VIEWPOINT_DOTS_LAYER).paint?.["circle-radius"],
      };
    };

    it("follows LABEL_CURVE: two thirds at zoom 12, the full size at 16", () => {
      expect(LABEL_CURVE).toEqual([[12, 2 / 3], [16, 1]]);
    });

    it("interpolates both text sizes over the zoom, times the label scale", () => {
      for (const scale of [0.8, 1, 1.3]) {
        const { timeText, viewpointText } = sizes({ labelScale: scale });
        expect(timeText).toEqual(textSize(20, scale));
        expect(viewpointText).toEqual(textSize(14, scale));
      }
    });

    it("reads a label scale at or under 0 as 1", () => {
      const unit = JSON.stringify(build({ timeLabels, viewpoints }));
      for (const labelScale of [undefined, 0, -1, 1]) {
        expect(JSON.stringify(build({ timeLabels, viewpoints, labelScale }))).toBe(unit);
      }
    });

    it("shows about two thirds of the full size at a fitted valley view and the full size at street level, with no jump", () => {
      const { timeText, viewpointText, timeDot, viewpointDot } = sizes();
      for (const [text, full] of [[timeText, 20], [viewpointText, 14]] as const) {
        expect(sizeAt(text, 11)).toBeCloseTo((full * 2) / 3, 2);
        expect(sizeAt(text, 12)).toBeCloseTo((full * 2) / 3, 2);
        expect(sizeAt(text, 16)).toBe(full);
        expect(sizeAt(text, 18)).toBe(full);
      }
      expect(sizeAt(timeDot, 8)).toBeCloseTo((3.5 * 2) / 3, 2);
      expect(sizeAt(timeDot, 16)).toBe(4.5);
      expect(sizeAt(viewpointDot, 8)).toBeCloseTo((2.5 * 2) / 3, 2);
      expect(sizeAt(viewpointDot, 16)).toBe(3.5);
      for (const size of [timeText, viewpointText, timeDot, viewpointDot]) {
        let previous = sizeAt(size, 6);
        for (let zoom = 6; zoom <= 20; zoom += 0.25) {
          const now = sizeAt(size, zoom);
          expect(now).toBeGreaterThanOrEqual(previous);
          expect(now - previous).toBeLessThan(0.5);
          previous = now;
        }
      }
    });

    it("scales the dots in proportion to the text", () => {
      const unit = sizes();
      const large = sizes({ labelScale: 1.3 });
      for (const zoom of [8, 11, 12, 14, 16]) {
        expect(sizeAt(large.timeDot, zoom)).toBeCloseTo(sizeAt(unit.timeDot, zoom) * 1.3, 2);
        expect(sizeAt(large.viewpointDot, zoom)).toBeCloseTo(sizeAt(unit.viewpointDot, zoom) * 1.3, 2);
      }
    });
  });

  it("sets labelMinZoom as the minzoom of the two text layers only", () => {
    const options = {
      timeLabels: [{ lat: 1, lng: 2, label: "5m" }],
      viewpoints: [{ lat: 2, lng: 3, label: "Town Hall" }],
    };
    const plain = build(options);
    for (const l of plain.layers) expect(l.minzoom, l.id).toBeUndefined();
    const gated = build({ ...options, labelMinZoom: 12 });
    expect(gated.layers.filter((l) => l.minzoom !== undefined).map((l) => l.id)).toEqual([
      VIEWPOINTS_LAYER,
      TIME_LABELS_LAYER,
    ]);
    expect(layer<{ minzoom?: number }>(gated, VIEWPOINTS_LAYER).minzoom).toBe(12);
    expect(layer<{ minzoom?: number }>(gated, TIME_LABELS_LAYER).minzoom).toBe(12);
    expect(layer<{ minzoom?: number }>(gated, VIEWPOINT_DOTS_LAYER).minzoom).toBeUndefined();
    expect(layer<{ minzoom?: number }>(gated, TIME_LABEL_DOTS_LAYER).minzoom).toBeUndefined();
  });

  it("names no colour of its own: every paint colour is the theme's", () => {
    const built = build({ arrows: true, timeLabels: [{ lat: 1, lng: 2, label: "15m" }], viewpoints: [{ lat: 3, lng: 4, label: "A" }] });
    const palette = new Set([...Object.values(LIGHT.overlay), ...Object.values(LIGHT.chrome)]);
    for (const l of built.layers) {
      for (const [key, value] of Object.entries((l as { paint?: Record<string, unknown> }).paint ?? {})) {
        if (key.endsWith("-color")) expect(palette.has(value as string), `${l.id} ${key}`).toBe(true);
      }
    }
  });
});
