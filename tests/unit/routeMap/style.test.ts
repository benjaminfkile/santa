// docs/site.md section 8.9. The optional style capabilities of the route
// poster: without options the style is the site map's own, `routeColor`
// recolours the route, `arrows` adds the arrowhead layer over the SDF
// image, `timeLabels` adds one labelled dot per entry, `details` drops
// the basemap's landmark, place name, and road name label layers,
// `poiKinds` filters the POI layers to the listed kinds, and `landmarks`
// adds one smaller labelled dot per entry (no dot and a wider label
// offset for a `badge` landmark), `routeWidthScale` scales the route
// line's width, and the label sizes follow the zoom times `labelScale`.
// The poster's label options (POSTER_LABELS) keep its overlay exactly
// as the fixture records it.

import { describe, it, expect } from "vitest";
import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import type {
  CircleLayerSpecification,
  LayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { POI_COLOURS, ROUTE_PALETTES, type Appearance } from "../../../src/routeMap/flavors";
import {
  ARROWS_LAYER,
  BASEMAP_SOURCE,
  DETAIL_LAYERS,
  LANDMARKS_LAYER,
  LANDMARKS_SOURCE,
  LANDMARK_DOTS_LAYER,
  ROUTE_ARROW_ICON,
  ROUTE_SOURCE,
  TIME_LABELS_LAYER,
  TIME_LABELS_SOURCE,
  TIME_LABEL_DOTS_LAYER,
  POSTER_LABELS,
  buildStyle,
  makeRouteArrowImage,
} from "../../../src/routeMap/style";
import POSTER_FIXTURE from "./posterStyle.fixture.json";

const BASE = "https://cdn.example/basemap";
const PATH = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 3 }];
const MARKS = [{ lat: 2, lng: 3 }];

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
        const unitScale = buildStyle(appearance, BASE, PATH, MARKS, terrain, { arrowScale: 1 });
        expect(JSON.stringify(unitScale)).toBe(JSON.stringify(plain));
        const noDetails = buildStyle(appearance, BASE, PATH, MARKS, terrain, { details: {} });
        expect(JSON.stringify(noDetails)).toBe(JSON.stringify(plain));
        const allDetails = buildStyle(appearance, BASE, PATH, MARKS, terrain, {
          details: { landmarks: true, placeNames: true, roadLabels: true },
        });
        expect(allDetails).toEqual(plain);
        expect(JSON.stringify(allDetails)).toBe(JSON.stringify(plain));
        const noExtras = buildStyle(appearance, BASE, PATH, MARKS, terrain, {
          poiKinds: undefined,
          landmarks: undefined,
        });
        expect(JSON.stringify(noExtras)).toBe(JSON.stringify(plain));
        const noLandmarks = buildStyle(appearance, BASE, PATH, MARKS, terrain, { landmarks: [] });
        expect(JSON.stringify(noLandmarks)).toBe(JSON.stringify(plain));
        const unitWidth = buildStyle(appearance, BASE, PATH, MARKS, terrain, { routeWidthScale: 1 });
        expect(JSON.stringify(unitWidth)).toBe(JSON.stringify(plain));
        for (const routeWidthScale of [undefined, 0, -1]) {
          const unsetWidth = buildStyle(appearance, BASE, PATH, MARKS, terrain, { routeWidthScale });
          expect(JSON.stringify(unsetWidth)).toBe(JSON.stringify(plain));
        }
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

  it("leaves the start circle out with startCircle false, keeping the end circle and the marks", () => {
    const plain = buildStyle("light", BASE, PATH, MARKS, false);
    const unset = buildStyle("light", BASE, PATH, MARKS, false, { startCircle: true });
    expect(JSON.stringify(unset)).toBe(JSON.stringify(plain));
    const style = buildStyle("light", BASE, PATH, MARKS, false, { startCircle: false });
    type Ends = { features: { properties: { end: string }; geometry: { coordinates: number[] } }[] };
    const plainEnds = (plain.sources["route-ends"] as unknown as { data: Ends }).data;
    expect(plainEnds.features.map((f) => f.properties.end)).toEqual(["start", "end"]);
    const ends = (style.sources["route-ends"] as unknown as { data: Ends }).data;
    expect(ends.features.map((f) => f.properties.end)).toEqual(["end"]);
    expect(ends.features[0].geometry.coordinates).toEqual([3, 5]);
    const endLayer = layer<CircleLayerSpecification>(style, "route-ends");
    expect(endLayer.paint?.["circle-radius"]).toBe(6);
    const marks = (style.sources["route-marks"] as unknown as { data: { features: unknown[] } }).data;
    expect(marks.features).toHaveLength(MARKS.length);
    layer<CircleLayerSpecification>(style, "route-marks");
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

  it("scales the arrow icon size and spacing together", () => {
    const arrowsAt = (arrowScale?: number) =>
      layer<SymbolLayerSpecification>(
        buildStyle("light", BASE, PATH, MARKS, false, { arrows: true, arrowScale }),
        ARROWS_LAYER,
      ).layout;
    const defaults = arrowsAt();
    expect(arrowsAt(1)).toEqual(defaults);
    const size = defaults?.["icon-size"] as number;
    const spacing = defaults?.["symbol-spacing"] as number;
    expect(size).toBe(1);
    expect(spacing).toBe(140);
    const scaled = arrowsAt(1.5);
    expect(scaled?.["icon-size"]).toBe(size * 1.5);
    expect(scaled?.["symbol-spacing"]).toBe(spacing * 1.5);
    expect(arrowsAt(0)).toEqual(defaults);
    expect(arrowsAt(-2)).toEqual(defaults);
  });

  it("scales the route line width at every zoom stop", () => {
    const widthAt = (routeWidthScale?: number) =>
      layer<LineLayerSpecification>(
        buildStyle("light", BASE, PATH, MARKS, false, { routeWidthScale }),
        "route-line",
      ).paint?.["line-width"];
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
      expect(labels.layout?.["text-size"]).toEqual(textSize(20, 1));
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

  // The label layers of each detail group, read out of the generated
  // layers by what they draw rather than by id, so a basemap package that
  // renames or splits them no longer matches DETAIL_LAYERS. Place and road
  // names come from the built style. The site flavors set no POI colours,
  // so the package leaves the POI layer out of the built style; its ids
  // come from the package's own layers for a flavor that has them.
  function symbolIds(
    all: readonly LayerSpecification[],
    keep: (l: SymbolLayerSpecification) => boolean,
  ): string[] {
    return all
      .filter((l): l is SymbolLayerSpecification => l.type === "symbol")
      .filter(keep)
      .map((l) => l.id)
      .sort();
  }

  function builtDetailGroups(style: ReturnType<typeof buildStyle>) {
    const basemap = style.layers.filter((l) => "source" in l && l.source === BASEMAP_SOURCE);
    return {
      landmarks: symbolIds(basemap, (l) => l["source-layer"] === "pois"),
      placeNames: symbolIds(
        basemap,
        (l) =>
          l["source-layer"] === "places" &&
          /"(locality|neighbourhood)"/.test(JSON.stringify(l.filter)),
      ),
      roadLabels: symbolIds(basemap, (l) => l["source-layer"] === "roads"),
    };
  }

  const PACKAGE_POIS = symbolIds(
    basemapLayers(BASEMAP_SOURCE, namedFlavor("light"), { lang: "en" }),
    (l) => l["source-layer"] === "pois",
  );

  it("names every detail group's layers as the basemap generates them", () => {
    expect(PACKAGE_POIS.length).toBeGreaterThan(0);
    expect([...DETAIL_LAYERS.landmarks].sort()).toEqual(PACKAGE_POIS);
    for (const appearance of ["light", "dark"] as Appearance[]) {
      const groups = builtDetailGroups(buildStyle(appearance, BASE, PATH, MARKS));
      expect(groups.landmarks).toEqual([]);
      for (const group of ["placeNames", "roadLabels"] as const) {
        expect(groups[group].length, group).toBeGreaterThan(0);
        expect([...DETAIL_LAYERS[group]].sort(), group).toEqual(groups[group]);
      }
    }
  });

  it("drops exactly the layers of each detail group turned off", () => {
    const groupNames = Object.keys(DETAIL_LAYERS) as (keyof typeof DETAIL_LAYERS)[];
    for (const appearance of ["light", "dark"] as Appearance[]) {
      for (const terrain of [false, true]) {
        const plain = buildStyle(appearance, BASE, PATH, MARKS, terrain);
        const groups = builtDetailGroups(plain);
        for (const group of groupNames) {
          const style = buildStyle(appearance, BASE, PATH, MARKS, terrain, {
            details: { [group]: false },
          });
          const dropped = new Set(groups[group]);
          expect(style.layers.map((l) => l.id)).toEqual(
            plain.layers.map((l) => l.id).filter((id) => !dropped.has(id)),
          );
          expect(style.layers).toEqual(plain.layers.filter((l) => !dropped.has(l.id)));
          expect(style.sources).toEqual(plain.sources);
          for (const other of groupNames.filter((g) => g !== group)) {
            for (const id of groups[other]) {
              expect(style.layers.some((l) => l.id === id), id).toBe(true);
            }
          }
        }
        const bare = buildStyle(appearance, BASE, PATH, MARKS, terrain, {
          details: { landmarks: false, placeNames: false, roadLabels: false },
        });
        const all = new Set(groupNames.flatMap((g) => groups[g]));
        expect(bare.layers).toEqual(plain.layers.filter((l) => !all.has(l.id)));
      }
    }
  });

  it("keeps only the listed POI kinds, from the zoom their tile data begins, on exactly the POI layers", () => {
    const kinds = ["peak", "museum", "hospital"];
    for (const appearance of ["light", "dark"] as Appearance[]) {
      for (const terrain of [false, true]) {
        const plain = buildStyle(appearance, BASE, PATH, MARKS, terrain);
        const style = buildStyle(appearance, BASE, PATH, MARKS, terrain, { poiKinds: kinds });
        const pois = new Set(DETAIL_LAYERS.landmarks);
        expect(builtDetailGroups(style).landmarks).toEqual([...DETAIL_LAYERS.landmarks].sort());
        expect(style.layers.filter((l) => !pois.has(l.id))).toEqual(plain.layers);
        expect(style.sources).toEqual(plain.sources);
        for (const id of DETAIL_LAYERS.landmarks) {
          const poi = layer<SymbolLayerSpecification>(style, id);
          expect(poi.filter).toEqual([
            "all",
            ["in", ["get", "kind"], ["literal", kinds]],
            [">=", ["zoom"], ["-", ["get", "min_zoom"], 1]],
          ]);
          expect(poi.minzoom).toBeUndefined();
          expect(Object.keys(poi.layout ?? {}).some((k) => k.startsWith("icon-"))).toBe(false);
          const color = poi.paint?.["text-color"] as unknown[];
          expect(color[0]).toBe("case");
          expect(color[color.length - 1]).toBe(POI_COLOURS[appearance].slategray);
          expect(JSON.stringify(color)).toContain(POI_COLOURS[appearance].green);
        }
        const hidden = buildStyle(appearance, BASE, PATH, MARKS, terrain, {
          poiKinds: kinds,
          details: { landmarks: false },
        });
        expect(hidden).toEqual(plain);
      }
    }
    // The package's own layer gates each feature at its stored min_zoom,
    // one zoom after its tile data begins.
    const packaged = basemapLayers(BASEMAP_SOURCE, namedFlavor("light"), { lang: "en" }).find(
      (l) => l.id === "pois",
    ) as SymbolLayerSpecification;
    expect(JSON.stringify(packaged.filter)).toContain('[">=",["zoom"],["+",["get","min_zoom"],0]]');
  });

  it("drops the POI layers for an empty kind list", () => {
    for (const appearance of ["light", "dark"] as Appearance[]) {
      const plain = buildStyle(appearance, BASE, PATH, MARKS);
      const style = buildStyle(appearance, BASE, PATH, MARKS, false, { poiKinds: [] });
      expect(builtDetailGroups(style).landmarks).toEqual([]);
      for (const id of DETAIL_LAYERS.landmarks) {
        expect(style.layers.some((l) => l.id === id), id).toBe(false);
      }
      expect(style).toEqual(plain);
    }
  });

  it("adds one smaller labelled dot per landmark in the halo pair, apart from the time labels", () => {
    const landmarks = [
      { lat: 46.87, lng: -114.0, label: "Missoula Airport" },
      { lat: 46.9, lng: -113.95, label: "Mount Jumbo" },
    ];
    const timeLabels = [{ lat: 1, lng: 2, label: "15m" }];
    for (const appearance of ["light", "dark"] as Appearance[]) {
      const palette = ROUTE_PALETTES[appearance];
      const style = buildStyle(appearance, BASE, PATH, MARKS, false, { landmarks, timeLabels });
      const source = style.sources[LANDMARKS_SOURCE] as {
        type: string;
        data: { features: { properties: { label: string }; geometry: unknown }[] };
      };
      expect(source.type).toBe("geojson");
      expect(source.data.features.map((f) => f.properties.label)).toEqual([
        "Missoula Airport",
        "Mount Jumbo",
      ]);
      expect(source.data.features[1].geometry).toEqual({ type: "Point", coordinates: [-113.95, 46.9] });

      const labels = layer<SymbolLayerSpecification>(style, LANDMARKS_LAYER);
      const timeLayer = layer<SymbolLayerSpecification>(style, TIME_LABELS_LAYER);
      expect(labels.source).toBe(LANDMARKS_SOURCE);
      expect(labels.minzoom).toBeUndefined();
      expect(labels.layout?.["text-field"]).toEqual(["get", "label"]);
      expect(labels.layout?.["text-font"]).toEqual(["Noto Sans Medium"]);
      expect(labels.layout?.["text-size"]).toEqual(textSize(14, 1));
      expect(labels.layout?.["text-allow-overlap"]).toBeUndefined();
      expect(labels.layout?.["text-ignore-placement"]).toBeUndefined();
      expect(labels.paint?.["text-color"]).toBe(palette.labelText);
      expect(labels.paint?.["text-halo-color"]).toBe(palette.labelHalo);
      expect(labels.paint?.["text-halo-width"]).toBe(timeLayer.paint?.["text-halo-width"]);

      const dots = layer<CircleLayerSpecification>(style, LANDMARK_DOTS_LAYER);
      const timeDots = layer<CircleLayerSpecification>(style, TIME_LABEL_DOTS_LAYER);
      expect(dots.source).toBe(LANDMARKS_SOURCE);
      expect(dots.minzoom).toBeUndefined();
      expect(dots.paint?.["circle-color"]).toBe(palette.landmarkFill);
      expect(dots.paint?.["circle-stroke-color"]).toBe(palette.landmarkStroke);
      expect(dots.paint).not.toEqual(timeDots.paint);

      const ids = style.layers.map((l) => l.id);
      expect(ids.indexOf(LANDMARK_DOTS_LAYER)).toBeGreaterThan(ids.indexOf("route-ends"));
      expect(ids.indexOf(LANDMARKS_LAYER)).toBe(ids.indexOf(LANDMARK_DOTS_LAYER) + 1);
      expect(ids.indexOf(TIME_LABEL_DOTS_LAYER)).toBeGreaterThan(ids.indexOf(LANDMARKS_LAYER));
      expect(ids.filter((id) => id === LANDMARKS_LAYER)).toHaveLength(1);
    }
    expect(ROUTE_PALETTES.light).toMatchObject({ landmarkFill: "#5f6368", landmarkStroke: "#ffffff" });
    expect(ROUTE_PALETTES.dark).toMatchObject({ landmarkFill: "#8fa3c2", landmarkStroke: "#0f1a2b" });
  });

  it("leaves the dot off a badge landmark and sets its label further out", () => {
    const plainLandmarks = [
      { lat: 46.87, lng: -114.0, label: "Missoula Airport" },
      { lat: 46.9, lng: -113.95, label: "Mount Jumbo" },
    ];
    const plain = buildStyle("light", BASE, PATH, MARKS, false, { landmarks: plainLandmarks });
    expect(layer<CircleLayerSpecification>(plain, LANDMARK_DOTS_LAYER).filter).toBeUndefined();
    expect(layer<SymbolLayerSpecification>(plain, LANDMARKS_LAYER).layout?.["text-radial-offset"]).toBe(0.5);
    const explicit = buildStyle("light", BASE, PATH, MARKS, false, {
      landmarks: plainLandmarks.map((l) => ({ ...l, badge: false })),
    });
    expect(JSON.stringify(explicit)).toBe(JSON.stringify(plain));

    const style = buildStyle("light", BASE, PATH, MARKS, false, {
      landmarks: [plainLandmarks[0], { ...plainLandmarks[1], badge: true }],
    });
    const source = style.sources[LANDMARKS_SOURCE] as {
      data: { features: { properties: Record<string, unknown> }[] };
    };
    expect(source.data.features.map((f) => f.properties)).toEqual([
      { label: "Missoula Airport" },
      { label: "Mount Jumbo", badge: true },
    ]);
    expect(layer<CircleLayerSpecification>(style, LANDMARK_DOTS_LAYER).filter).toEqual([
      "!",
      ["has", "badge"],
    ]);
    expect(layer<SymbolLayerSpecification>(style, LANDMARKS_LAYER).layout?.["text-radial-offset"]).toEqual([
      "case",
      ["has", "badge"],
      1.3,
      0.5,
    ]);
  });

  describe("label sizes", () => {
    const timeLabels = [{ lat: 1, lng: 2, label: "15m" }];
    const landmarks = [{ lat: 3, lng: 4, label: "Caras Park" }];
    const sizes = (options: Parameters<typeof buildStyle>[5] = {}) => {
      const style = buildStyle("light", BASE, PATH, MARKS, false, { timeLabels, landmarks, ...options });
      return {
        timeText: layer<SymbolLayerSpecification>(style, TIME_LABELS_LAYER).layout?.["text-size"],
        landmarkText: layer<SymbolLayerSpecification>(style, LANDMARKS_LAYER).layout?.["text-size"],
        timeDot: layer<CircleLayerSpecification>(style, TIME_LABEL_DOTS_LAYER).paint?.["circle-radius"],
        landmarkDot: layer<CircleLayerSpecification>(style, LANDMARK_DOTS_LAYER).paint?.["circle-radius"],
      };
    };

    it("interpolates both text sizes over the zoom, times the label scale", () => {
      for (const scale of [0.8, 1, 1.3]) {
        const { timeText, landmarkText } = sizes({ labelScale: scale });
        expect(timeText).toEqual(textSize(20, scale));
        expect(landmarkText).toEqual(textSize(14, scale));
      }
      expect(sizes().timeText).toEqual(textSize(20, 1));
      expect(sizes().landmarkText).toEqual(textSize(14, 1));
    });

    it("reads a label scale at or under 0 as 1", () => {
      const unit = JSON.stringify(buildStyle("dark", BASE, PATH, MARKS, true, { timeLabels, landmarks }));
      for (const labelScale of [undefined, 0, -1, 1]) {
        expect(
          JSON.stringify(buildStyle("dark", BASE, PATH, MARKS, true, { timeLabels, landmarks, labelScale })),
        ).toBe(unit);
      }
    });

    it("shows about two thirds of the full size at a fitted valley view and the full size at street level, with no jump", () => {
      const { timeText, landmarkText, timeDot, landmarkDot } = sizes();
      for (const [text, full] of [[timeText, 20], [landmarkText, 14]] as const) {
        expect(sizeAt(text, 11)).toBeCloseTo((full * 2) / 3, 2);
        expect(sizeAt(text, 12)).toBeCloseTo((full * 2) / 3, 2);
        expect(sizeAt(text, 16)).toBe(full);
        expect(sizeAt(text, 18)).toBe(full);
      }
      // The dots keep their own growth from zoom 8 to 14 under the curve:
      // today's radius times the curve's factor at each zoom.
      expect(sizeAt(timeDot, 8)).toBeCloseTo((3.5 * 2) / 3, 2);
      expect(sizeAt(timeDot, 16)).toBe(4.5);
      expect(sizeAt(landmarkDot, 8)).toBeCloseTo((2.5 * 2) / 3, 2);
      expect(sizeAt(landmarkDot, 16)).toBe(3.5);
      for (const size of [timeText, landmarkText, timeDot, landmarkDot]) {
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
        expect(sizeAt(large.landmarkDot, zoom)).toBeCloseTo(sizeAt(unit.landmarkDot, zoom) * 1.3, 2);
      }
    });

    it("keeps the full sizes at every zoom on the flat curve", () => {
      const flat = sizes({ labelCurve: "flat" });
      expect(flat.timeText).toBe(20);
      expect(flat.landmarkText).toBe(14);
      expect(flat.timeDot).toEqual(["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 4.5]);
      expect(flat.landmarkDot).toEqual(["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 3.5]);
      const scaled = sizes({ labelCurve: "flat", labelScale: 1.3 });
      expect(scaled.timeText).toBe(26);
      expect(scaled.landmarkText).toBe(18.2);
    });
  });

  it("keeps the poster's route overlay byte for byte with the poster's label options", () => {
    const path = [{ lat: 46.87, lng: -114.02 }, { lat: 46.88, lng: -114.01 }, { lat: 46.89, lng: -114.0 }];
    const marks = [{ lat: 46.875, lng: -114.015 }];
    const poster = {
      routeColor: "#c62828",
      arrows: true,
      arrowScale: 1.5,
      routeWidthScale: 2,
      timeLabels: [
        { lat: 46.875, lng: -114.015, label: "15m" },
        { lat: 46.885, lng: -114.005, label: "30m" },
      ],
      landmarks: [
        { lat: 46.872, lng: -114.012, label: "Caras Park" },
        { lat: 46.882, lng: -114.008, label: "Depot", badge: true },
      ],
      details: { roadLabels: false },
      poiKinds: ["park"],
    };
    expect(POSTER_LABELS).toEqual({ labelScale: 1, labelCurve: "flat" });
    for (const appearance of ["light", "dark"] as Appearance[]) {
      const style = buildStyle(appearance, BASE, path, marks, false, { ...poster, ...POSTER_LABELS });
      const { [BASEMAP_SOURCE]: basemap, ...sources } = style.sources;
      expect(basemap).toBeDefined();
      const overlay = style.layers.slice(style.layers.findIndex((l) => l.id === "route-line"));
      expect(JSON.stringify({ sources, layers: overlay }, null, 2)).toBe(
        JSON.stringify(POSTER_FIXTURE[appearance], null, 2),
      );
      const unlabelled = buildStyle(appearance, BASE, path, marks, false, {
        ...poster,
        timeLabels: [],
        landmarks: [],
      });
      expect(style.layers.slice(0, style.layers.length - overlay.length)).toEqual(
        unlabelled.layers.slice(0, unlabelled.layers.findIndex((l) => l.id === "route-line")),
      );
    }
  });
});
