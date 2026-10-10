// docs/site.md section 8.10 (Places). The place filter on a MapLibre
// theme: `applyPlaces` takes Protomaps kinds as the route map hands them;
// the kind table expands the tracker's nine kinds for the live surface. A
// marked layer takes `["all", <its own filter>, ["in", ["get", "kind"],
// ["literal", kinds]]]`, or `["all", <the kind test>]` without one,
// rebuilt from the theme's own layer on every change; a null or empty list
// hides the marked layers; unmarked layers and a theme with no marked layer
// are untouched.

import { describe, it, expect } from "vitest";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { PLACE_KINDS, applyPlaces, protomapsKinds } from "../../../src/mapHost/places";
import { POI_KINDS } from "../../../src/map/poiStyles";
import { routeStyle } from "./routeThemes";

const OWN = [">=", ["zoom"], ["-", ["get", "min_zoom"], 1]];

function styleOf(layers: LayerSpecification[]): StyleSpecification {
  return { version: 8, sources: { basemap: { type: "vector" } }, layers };
}

const MARKED = {
  id: "pois",
  type: "symbol",
  source: "basemap",
  "source-layer": "pois",
  metadata: { "wmsfo:places": true },
  filter: OWN,
  layout: { "text-field": ["get", "name"] },
} as unknown as LayerSpecification;

const MARKED_BARE = {
  id: "pois_bare",
  type: "symbol",
  source: "basemap",
  "source-layer": "pois",
  metadata: { "wmsfo:places": true },
} as unknown as LayerSpecification;

const ROADS = {
  id: "roads_labels",
  type: "symbol",
  source: "basemap",
  "source-layer": "roads",
  filter: ["==", ["get", "kind"], "highway"],
} as unknown as LayerSpecification;

function byId(style: StyleSpecification, id: string) {
  return style.layers.find((l) => l.id === id) as LayerSpecification & {
    filter?: unknown;
    layout?: Record<string, unknown>;
  };
}

describe("the place kind table", () => {
  it("maps each of the nine tracker kinds to Protomaps kinds", () => {
    expect(Object.keys(PLACE_KINDS).sort()).toEqual([...POI_KINDS].sort());
    for (const kind of POI_KINDS) expect(PLACE_KINDS[kind].length, kind).toBeGreaterThan(0);
    expect(PLACE_KINDS.park).toContain("park");
    expect(PLACE_KINDS.place_of_worship).toEqual(["place_of_worship"]);
    expect(PLACE_KINDS.transit).toContain("station");
  });

  it("expands a list in table order and drops unknown kinds", () => {
    expect(protomapsKinds(["school", "park", "peak"])).toEqual([...PLACE_KINDS.park, ...PLACE_KINDS.school]);
    expect(protomapsKinds(null)).toEqual([]);
    expect(protomapsKinds(["peak"])).toEqual([]);
  });
});

describe("applyPlaces", () => {
  it("adds the kind test to a marked layer's own filter", () => {
    const style = applyPlaces(styleOf([MARKED, ROADS]), protomapsKinds(["park", "medical"]));
    expect(byId(style, "pois").filter).toEqual([
      "all",
      OWN,
      ["in", ["get", "kind"], ["literal", protomapsKinds(["park", "medical"])]],
    ]);
    expect(byId(style, "pois").layout).toEqual(MARKED.layout);
    expect(byId(style, "roads_labels")).toBe(ROADS);
  });

  it("filters a marked layer with no own filter by kind alone", () => {
    const style = applyPlaces(styleOf([MARKED_BARE]), PLACE_KINDS.transit);
    expect(byId(style, "pois_bare").filter).toEqual([
      "all",
      ["in", ["get", "kind"], ["literal", PLACE_KINDS.transit]],
    ]);
  });

  it("rebuilds from the theme's own layer on every change", () => {
    const theme = styleOf([MARKED]);
    applyPlaces(theme, PLACE_KINDS.park);
    const second = applyPlaces(theme, PLACE_KINDS.school);
    expect(byId(second, "pois").filter).toEqual([
      "all",
      OWN,
      ["in", ["get", "kind"], ["literal", PLACE_KINDS.school]],
    ]);
    expect(byId(theme, "pois")).toBe(MARKED);
  });

  it("passes the route map's Protomaps kinds through as they are", () => {
    const style = applyPlaces(styleOf([MARKED]), ["park", "dog_park", "picnic_site"]);
    expect(byId(style, "pois").filter).toEqual(["all", OWN, ["in", ["get", "kind"], ["literal", ["park", "dog_park", "picnic_site"]]]]);
  });

  it("hides the marked layers for a null or empty list", () => {
    for (const kinds of [null, undefined, []]) {
      const style = applyPlaces(styleOf([MARKED, ROADS]), kinds);
      expect(byId(style, "pois").layout).toEqual({ ...MARKED.layout, visibility: "none" });
      expect(byId(style, "pois").filter).toEqual(OWN);
      expect(byId(style, "roads_labels")).toBe(ROADS);
    }
  });

  it("leaves a theme with no marked layer untouched", () => {
    const theme = styleOf([ROADS]);
    expect(applyPlaces(theme, ["park"])).toBe(theme);
    expect(applyPlaces(theme, null)).toBe(theme);
  });

  it("finds the seeded themes' marked places layer", () => {
    const body = routeStyle("light");
    const style = applyPlaces(body, ["attraction"]);
    const changed = style.layers.filter((l, i) => l !== body.layers[i]).map((l) => l.id);
    expect(changed).toEqual(["pois"]);
  });
});
