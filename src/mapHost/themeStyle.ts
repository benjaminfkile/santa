// docs/site.md section 8.10 (Sources). A MapLibre theme's fetched style
// body made ready for the event's map: the `basemap` source reads
// `pmtiles://<trackerMap.tilesUrl>` and the `terrain` source
// `pmtiles://<trackerMap.terrainUrl>`; with no terrain URL the `terrain`
// source and every layer whose `source` is `terrain` are removed. `glyphs`
// is the CDN glyph template and `sprite` the theme's `spriteUrl`, absent
// when null. Nothing else in the body is touched, and the body itself is
// never mutated. `withoutTerrain` takes the terrain layers out of a style
// (the terrain view off) and `hasTerrainLayers` says whether a style has
// any. `mapBounds` gives the map its pan limit and zoom range: the event
// box as `maxBounds` with the zoom that fits it (bounds.ts) as the least
// zoom, never under the map row's `minZoom`, and the row's `maxZoom`.

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { env } from "../config/env";
import { fittedMinZoom, type Bbox, type Viewport } from "../map/bounds";

export const BASEMAP_SOURCE = "basemap";
export const TERRAIN_SOURCE = "terrain";

// The event's map (`snapshot.event.trackerMap`).
export type TrackerMap = {
  tilesUrl: string;
  terrainUrl: string | null;
  minZoom?: number;
  maxZoom?: number;
};

// The glyph template on the CDN; the fonts do not depend on the map.
export function glyphTemplate(): string {
  return `${env.CDN_BASE_URL}/basemap/glyphs/{fontstack}/{range}.pbf`;
}

function isTerrainLayer(layer: LayerSpecification): boolean {
  return "source" in layer && layer.source === TERRAIN_SOURCE;
}

export function hasTerrainLayers(style: StyleSpecification): boolean {
  return style.layers.some(isTerrainLayer);
}

export function withoutTerrain(style: StyleSpecification): StyleSpecification {
  if (!hasTerrainLayers(style)) return style;
  return { ...style, layers: style.layers.filter((layer) => !isTerrainLayer(layer)) };
}

export function themeStyle(
  body: StyleSpecification,
  trackerMap: Pick<TrackerMap, "tilesUrl" | "terrainUrl">,
  spriteUrl: string | null,
): StyleSpecification {
  const terrainUrl = trackerMap.terrainUrl === "" ? null : trackerMap.terrainUrl;
  const sources: StyleSpecification["sources"] = {};
  for (const [id, source] of Object.entries(body.sources)) {
    if (id === BASEMAP_SOURCE && source.type === "vector") {
      sources[id] = { ...source, url: `pmtiles://${trackerMap.tilesUrl}` };
    } else if (id === TERRAIN_SOURCE && source.type === "raster-dem") {
      if (terrainUrl !== null) sources[id] = { ...source, url: `pmtiles://${terrainUrl}` };
    } else {
      sources[id] = source;
    }
  }
  const style: StyleSpecification = { ...body, glyphs: glyphTemplate(), sources };
  delete style.sprite;
  if (spriteUrl !== null && spriteUrl !== "") style.sprite = spriteUrl;
  return terrainUrl === null ? withoutTerrain(style) : style;
}

export type MapBounds = {
  maxBounds?: [[number, number], [number, number]];
  minZoom?: number;
  maxZoom?: number;
};

export function mapBounds(
  bbox: Bbox | null,
  viewport: Viewport,
  trackerMap: Pick<TrackerMap, "minZoom" | "maxZoom">,
): MapBounds {
  const rowMin = trackerMap.minZoom;
  const out: MapBounds = {};
  if (bbox !== null) {
    out.maxBounds = [[bbox.west, bbox.south], [bbox.east, bbox.north]];
    const fitted = fittedMinZoom(bbox, viewport);
    out.minZoom = rowMin !== undefined ? Math.max(rowMin, fitted) : fitted;
  } else if (rowMin !== undefined) {
    out.minZoom = rowMin;
  }
  if (trackerMap.maxZoom !== undefined) out.maxZoom = trackerMap.maxZoom;
  return out;
}
