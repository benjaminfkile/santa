// docs/site.md section 8.10 (Sources). A theme's body for the event's map:
// the seeded `route-light` body keeps every layer unchanged apart from the
// two source URLs, the glyph template, and no `sprite`; a null terrain
// URL drops exactly the `terrain` layers and the source; a sprite URL
// lands as `sprite`; the body is never mutated; and the map takes
// `maxBounds` and the fitted least zoom from the box, with the row's zoom
// range.

import { describe, it, expect } from "vitest";
import {
  glyphTemplate,
  hasTerrainLayers,
  mapBounds,
  themeStyle,
  withoutTerrain,
} from "../../../src/mapHost/themeStyle";
import { fittedMinZoom } from "../../../src/map/bounds";
import { routeStyle } from "./routeThemes";

const MAP = {
  tilesUrl: "https://cdn.example/maps/valley/tiles.pmtiles",
  terrainUrl: "https://cdn.example/maps/valley/terrain.pmtiles",
};

describe("themeStyle", () => {
  it("injects the two source URLs and the glyph template, and touches nothing else", () => {
    const body = routeStyle("route-light");
    const before = JSON.stringify(body);
    const style = themeStyle(body, MAP, null);
    expect(JSON.stringify(body)).toBe(before);
    expect(style.sources.basemap).toEqual({ ...body.sources.basemap, url: `pmtiles://${MAP.tilesUrl}` });
    expect(style.sources.terrain).toEqual({ ...body.sources.terrain, url: `pmtiles://${MAP.terrainUrl}` });
    expect(style.glyphs).toBe("https://cdn.example/basemap/glyphs/{fontstack}/{range}.pbf");
    expect(style.glyphs).toBe(glyphTemplate());
    expect(style).not.toHaveProperty("sprite");
    expect(style.layers).toEqual(body.layers);
    const { sources: _s, glyphs: _g, ...rest } = style;
    const { sources: _bs, glyphs: _bg, sprite: _bsp, ...bodyRest } = body;
    expect(rest).toEqual(bodyRest);
  });

  it("drops exactly the terrain layers and the terrain source without a terrain URL", () => {
    const body = routeStyle("route-light");
    const style = themeStyle(body, { ...MAP, terrainUrl: null }, null);
    expect(style.sources.terrain).toBeUndefined();
    expect(style.sources.basemap).toBeDefined();
    const terrainIds = body.layers.filter((l) => "source" in l && l.source === "terrain").map((l) => l.id);
    expect(terrainIds).toEqual(["terrain-hillshade"]);
    expect(style.layers).toEqual(body.layers.filter((l) => !terrainIds.includes(l.id)));
    expect(hasTerrainLayers(style)).toBe(false);
    expect(hasTerrainLayers(themeStyle(body, MAP, null))).toBe(true);
  });

  it("sets a sprite URL as `sprite`", () => {
    const style = themeStyle(routeStyle("route-dark"), MAP, "https://cdn.example/sprites/abc");
    expect(style.sprite).toBe("https://cdn.example/sprites/abc");
  });

  it("drops a sprite the body names when the theme has none", () => {
    const body = { ...routeStyle("route-dark"), sprite: "https://elsewhere.example/sprite" };
    expect(themeStyle(body, MAP, null)).not.toHaveProperty("sprite");
  });

  it("takes the terrain layers out and keeps the rest", () => {
    const style = themeStyle(routeStyle("route-light"), MAP, null);
    const flat = withoutTerrain(style);
    expect(flat.layers.map((l) => l.id)).toEqual(style.layers.map((l) => l.id).filter((id) => id !== "terrain-hillshade"));
    expect(flat.sources).toBe(style.sources);
    expect(withoutTerrain(flat)).toBe(flat);
  });
});

describe("mapBounds", () => {
  const BOX = { west: -114.2, south: 46.7, east: -113.7, north: 47.0 };
  const VIEW = { width: 800, height: 600 };

  it("gives maxBounds and the fitted least zoom from the box, with the row's zoom range", () => {
    const fitted = fittedMinZoom(BOX, VIEW);
    expect(mapBounds(BOX, VIEW, { minZoom: 0, maxZoom: 15 })).toEqual({
      maxBounds: [[-114.2, 46.7], [-113.7, 47.0]],
      minZoom: fitted,
      maxZoom: 15,
    });
    expect(mapBounds(BOX, VIEW, { minZoom: fitted + 2, maxZoom: 15 }).minZoom).toBe(fitted + 2);
  });

  it("keeps the row's zoom range alone without a box", () => {
    expect(mapBounds(null, VIEW, { minZoom: 3, maxZoom: 14 })).toEqual({ minZoom: 3, maxZoom: 14 });
    expect(mapBounds(null, VIEW, {})).toEqual({});
  });
});
