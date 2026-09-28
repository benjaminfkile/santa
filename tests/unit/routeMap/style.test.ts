// docs/site.md section 8.9. The optional style capabilities of the route
// poster: without options the style is the site map's own, `routeColor`
// recolours the route, `arrows` adds the arrowhead layer over the SDF
// image, `timeLabels` adds one labelled dot per entry, `details` drops
// the basemap's landmark, place name, and road name label layers,
// `poiKinds` filters the POI layers to the listed kinds, and `landmarks`
// adds one smaller labelled dot per entry.

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
      expect(labels.layout?.["text-size"]).toBe(14);
      expect(labels.layout?.["text-size"]).toBeLessThan(timeLayer.layout?.["text-size"] as number);
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
});
