// docs/site.md sections 8.9 and 8.10. What the site draws over a theme's
// style in route mode, as GeoJSON sources and layers the host appends
// above the theme's last layer: the route path as a line, the timeline
// marks as small dots on it, and the end marker as a circle (the start
// marker is an HTML marker the host stands on the first point). Every
// colour comes from the theme's `overlay` and `chrome`:
//  - the line in `overlay.routeColor` at `overlay.routeOpacity`;
//  - the marks filled in `chrome.bg` and ringed in the route colour;
//  - the end circle filled in `chrome.text` and ringed in `chrome.bg`;
//  - the arrowheads in `overlay.arrowColor`;
//  - the time label and viewpoint text in `overlay.timeLabelFg` with a
//    halo in `overlay.timeLabelBg`;
//  - the time label dots in the route colour ringed in `chrome.bg`, and
//    the viewpoint dots in `chrome.fg` ringed in `chrome.bg`.
// The options:
//  - `arrows` adds a symbol layer along the route line that repeats the
//    ROUTE_ARROW_ICON arrowhead at an even spacing, turned along the line
//    direction and tinted through icon-color. The icon is the SDF image
//    makeRouteArrowImage returns; the map owner adds it under
//    ROUTE_ARROW_ICON, the layers only name it. `arrowScale` (default 1,
//    values at or under 0 read as 1) multiplies both the icon size and
//    the spacing, so larger arrowheads sit further apart.
//  - `routeWidthScale` (default 1, values at or under 0 read as 1)
//    multiplies the route line's width at every zoom stop. The line has
//    no casing, so nothing else reads it.
//  - `timeLabels` adds, for each entry, a dot slightly larger than the
//    marks at its point and its ready made `label` beside it, in Noto Sans
//    Medium (20 px at full size, see the label sizes below), with a strong
//    halo. MapLibre's collision handling places the labels, so no two
//    overlap.
//  - `viewpoints` adds, for each entry, a dot (`route-landmark-dots`) and
//    its `label` beside it (`route-landmarks`) in Noto Sans Medium smaller
//    than the time labels, with the same halo pair. Both are drawn at
//    every zoom. The time label layers sit above them, so a time label
//    wins a collision with a viewpoint. A viewpoint with `badge` set has
//    no dot (the map owner stands its own marker there) and its label
//    sits VIEWPOINT_BADGE_OFFSET ems out, clear of that marker. Without a
//    `badge` viewpoint both layers are exactly as above.
// The time label and viewpoint sizes (the text and the dots under it)
// follow the zoom: LABEL_CURVE multiplies each by LABEL_MIN_FACTOR at
// LABEL_ZOOM_LOW and under (the fitted view of a whole route) and grows
// it linearly to its full size at LABEL_ZOOM_HIGH and over (street
// level). `labelScale` (default 1, values at or under 0 read as 1)
// multiplies every one of those sizes at every zoom.
// `labelMinZoom`, when set, gives the two text layers (`route-landmarks`
// and `route-time-labels`) that `minzoom`, so the names and times hide
// below it while the dot layers stay at every zoom. Without it no layer
// carries a `minzoom`.

import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
} from "maplibre-gl";
import type { MapTheme } from "../map/themes";

export type LatLng = { lat: number; lng: number };

export const ROUTE_SOURCE = "route";
export const ENDS_SOURCE = "route-ends";
export const MARKS_SOURCE = "route-marks";
export const ROUTE_LAYER = "route-line";
export const MARKS_LAYER = "route-marks";
export const ENDS_LAYER = "route-ends";
export const ARROWS_LAYER = "route-arrows";
export const TIME_LABELS_SOURCE = "route-time-labels";
export const TIME_LABEL_DOTS_LAYER = "route-time-label-dots";
export const TIME_LABELS_LAYER = "route-time-labels";
export const VIEWPOINTS_SOURCE = "route-landmarks";
export const VIEWPOINT_DOTS_LAYER = "route-landmark-dots";
export const VIEWPOINTS_LAYER = "route-landmarks";
export const ROUTE_ARROW_ICON = "route-arrow";

export type TimeLabel = { lat: number; lng: number; label: string };
export type Viewpoint = { lat: number; lng: number; label: string; badge?: boolean };

// The part of a theme the overlay paints with.
export type OverlayPalette = Pick<MapTheme, "overlay" | "chrome">;

export type RouteLayerOptions = {
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  timeLabels?: readonly TimeLabel[];
  viewpoints?: readonly Viewpoint[];
  labelScale?: number;
  labelMinZoom?: number;
};

export type RouteLayers = {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
};

// The arrowhead image: ARROW_SIZE device pixels square at ARROW_PIXEL_RATIO,
// a notched head pointing along +x (the line direction of a line placed
// symbol), encoded as a signed distance field over ARROW_SDF_RADIUS pixels
// with the edge at ARROW_SDF_CUTOFF, the encoding MapLibre's SDF icons read.
const ARROW_SIZE = 32;
const ARROW_PIXEL_RATIO = 2;
const ARROW_SDF_RADIUS = 8;
const ARROW_SDF_CUTOFF = 0.25;
const ARROW_OUTLINE: readonly (readonly [number, number])[] = [
  [24, 16],
  [9, 7],
  [13, 16],
  [9, 25],
];

// Pixels between arrowheads along the line, and the icon size, both at
// an arrow scale of 1.
const ARROW_SPACING = 140;
const ARROW_ICON_SIZE = 1;

// The route line width in pixels at zoom 8 and zoom 14, at a route width
// scale of 1.
const ROUTE_WIDTH_Z8 = 3;
const ROUTE_WIDTH_Z14 = 5;

// The viewpoint label's offset in ems: beside the dot, and beside the owner's
// marker (a badge about 28 px across) for a `badge` viewpoint.
const VIEWPOINT_OFFSET = 0.5;
const VIEWPOINT_BADGE_OFFSET = 1.3;

// The full label sizes: the text in pixels, and the dot radius in pixels
// as [zoom, radius] stops.
const TIME_LABEL_TEXT_SIZE = 20;
const VIEWPOINT_TEXT_SIZE = 14;
const TIME_LABEL_DOT_STOPS: readonly Stop[] = [[8, 3.5], [14, 4.5]];
const VIEWPOINT_DOT_STOPS: readonly Stop[] = [[8, 2.5], [14, 3.5]];

// The zoom curve of the label sizes: LABEL_MIN_FACTOR of the full size at
// LABEL_ZOOM_LOW and under, the full size at LABEL_ZOOM_HIGH and over, and
// linear between.
const LABEL_ZOOM_LOW = 12;
const LABEL_ZOOM_HIGH = 16;
const LABEL_MIN_FACTOR = 2 / 3;
export const LABEL_CURVE: readonly Stop[] = [
  [LABEL_ZOOM_LOW, LABEL_MIN_FACTOR],
  [LABEL_ZOOM_HIGH, 1],
];

type Stop = readonly [zoom: number, value: number];

// The value of piecewise linear stops at a zoom, held flat past either end.
function atZoom(stops: readonly Stop[], zoom: number): number {
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z1, v1] = stops[i];
    if (zoom <= z1) {
      const [z0, v0] = stops[i - 1];
      return v0 + ((v1 - v0) * (zoom - z0)) / (z1 - z0);
    }
  }
  return stops[stops.length - 1][1];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// A label size: the base stops (one stop for a text size) times the zoom
// curve and the scale, as a zoom interpolation over every stop of both.
function labelSize(base: readonly Stop[], scale: number): ExpressionSpecification {
  const baseZooms = base.length === 1 ? [] : base.map(([zoom]) => zoom);
  const zooms = [...new Set([...baseZooms, LABEL_ZOOM_LOW, LABEL_ZOOM_HIGH])].sort((a, b) => a - b);
  const stops = zooms.flatMap((zoom) => [
    zoom,
    round(atZoom(base, zoom) * atZoom(LABEL_CURVE, zoom) * scale),
  ]);
  return ["interpolate", ["linear"], ["zoom"], ...stops] as ExpressionSpecification;
}

export type RouteArrowImage = {
  data: { width: number; height: number; data: Uint8ClampedArray };
  options: { sdf: true; pixelRatio: number };
};

function segmentDistance(
  px: number,
  py: number,
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideOutline(px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = ARROW_OUTLINE.length - 1; i < ARROW_OUTLINE.length; j = i++) {
    const [xi, yi] = ARROW_OUTLINE[i];
    const [xj, yj] = ARROW_OUTLINE[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Draws the arrowhead on a small RGBA canvas, white with the signed
// distance to its outline in the alpha channel, ready for
// map.addImage(ROUTE_ARROW_ICON, data, options).
export function makeRouteArrowImage(): RouteArrowImage {
  const data = new Uint8ClampedArray(ARROW_SIZE * ARROW_SIZE * 4);
  for (let y = 0; y < ARROW_SIZE; y++) {
    for (let x = 0; x < ARROW_SIZE; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let distance = Infinity;
      for (let i = 0; i < ARROW_OUTLINE.length; i++) {
        const next = ARROW_OUTLINE[(i + 1) % ARROW_OUTLINE.length];
        distance = Math.min(distance, segmentDistance(px, py, ARROW_OUTLINE[i], next));
      }
      const signed = insideOutline(px, py) ? -distance : distance;
      const at = (y * ARROW_SIZE + x) * 4;
      data[at] = 255;
      data[at + 1] = 255;
      data[at + 2] = 255;
      data[at + 3] = Math.round(255 - 255 * (signed / ARROW_SDF_RADIUS + ARROW_SDF_CUTOFF));
    }
  }
  return {
    data: { width: ARROW_SIZE, height: ARROW_SIZE, data },
    options: { sdf: true, pixelRatio: ARROW_PIXEL_RATIO },
  };
}

// [[west, south], [east, north]] around the path, or null when it is empty.
export function pathBounds(path: readonly LatLng[]): [[number, number], [number, number]] | null {
  if (path.length === 0) return null;
  let west = path[0].lng;
  let east = path[0].lng;
  let south = path[0].lat;
  let north = path[0].lat;
  for (const p of path) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return [[west, south], [east, north]];
}

function scaleOf(value: number | undefined): number {
  return value !== undefined && value > 0 ? value : 1;
}

function points<T extends LatLng>(
  list: readonly T[],
  properties: (item: T) => Record<string, unknown>,
): SourceSpecification {
  return {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: list.map((item) => ({
        type: "Feature" as const,
        properties: properties(item),
        geometry: { type: "Point" as const, coordinates: [item.lng, item.lat] },
      })),
    },
  };
}

export function routeLayers(
  palette: OverlayPalette,
  path: readonly LatLng[],
  marks: readonly LatLng[] = [],
  options: RouteLayerOptions = {},
): RouteLayers {
  const { overlay, chrome } = palette;
  const routeColor = overlay.routeColor;
  const timeLabels = options.timeLabels ?? [];
  const viewpoints = options.viewpoints ?? [];
  const arrowScale = scaleOf(options.arrowScale);
  const routeWidthScale = scaleOf(options.routeWidthScale);
  const labelScale = scaleOf(options.labelScale);
  const textMinZoom =
    options.labelMinZoom !== undefined ? { minzoom: options.labelMinZoom } : {};
  const badges = viewpoints.some((viewpoint) => viewpoint.badge === true);
  const ends = path.length === 0 ? [] : [path[path.length - 1]];
  const sources: Record<string, SourceSpecification> = {
    [ROUTE_SOURCE]: {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: path.map((p) => [p.lng, p.lat]) },
      },
    },
    [MARKS_SOURCE]: points(marks, () => ({})),
    [ENDS_SOURCE]: points(ends, () => ({ end: "end" })),
    ...(timeLabels.length > 0
      ? { [TIME_LABELS_SOURCE]: points(timeLabels, ({ label }) => ({ label })) }
      : {}),
    ...(viewpoints.length > 0
      ? {
          [VIEWPOINTS_SOURCE]: points(viewpoints, ({ label, badge }) =>
            badge === true ? { label, badge: true } : { label },
          ),
        }
      : {}),
  };
  const textPaint = {
    "text-color": overlay.timeLabelFg,
    "text-halo-color": overlay.timeLabelBg,
    "text-halo-width": 3,
  };
  const layers: LayerSpecification[] = [
    {
      id: ROUTE_LAYER,
      type: "line",
      source: ROUTE_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": routeColor,
        "line-opacity": overlay.routeOpacity,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          ROUTE_WIDTH_Z8 * routeWidthScale,
          14,
          ROUTE_WIDTH_Z14 * routeWidthScale,
        ],
      },
    },
    ...(options.arrows === true
      ? [
          {
            id: ARROWS_LAYER,
            type: "symbol" as const,
            source: ROUTE_SOURCE,
            layout: {
              "symbol-placement": "line" as const,
              "symbol-spacing": ARROW_SPACING * arrowScale,
              "icon-image": ROUTE_ARROW_ICON,
              "icon-size": ARROW_ICON_SIZE * arrowScale,
              "icon-rotation-alignment": "map" as const,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
            paint: {
              "icon-color": overlay.arrowColor,
              "icon-opacity": overlay.routeOpacity,
            },
          } satisfies LayerSpecification,
        ]
      : []),
    {
      id: MARKS_LAYER,
      type: "circle",
      source: MARKS_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 3],
        "circle-color": chrome.bg,
        "circle-opacity": 0.9,
        "circle-stroke-color": routeColor,
        "circle-stroke-width": 1,
      },
    },
    {
      id: ENDS_LAYER,
      type: "circle",
      source: ENDS_SOURCE,
      paint: {
        "circle-radius": 6,
        "circle-color": chrome.text,
        "circle-stroke-color": chrome.bg,
        "circle-stroke-width": 2,
      },
    },
    ...(viewpoints.length > 0
      ? [
          {
            id: VIEWPOINT_DOTS_LAYER,
            type: "circle" as const,
            source: VIEWPOINTS_SOURCE,
            ...(badges ? { filter: ["!", ["has", "badge"]] } : {}),
            paint: {
              "circle-radius": labelSize(VIEWPOINT_DOT_STOPS, labelScale),
              "circle-color": chrome.fg,
              "circle-stroke-color": chrome.bg,
              "circle-stroke-width": 1,
            },
          } satisfies LayerSpecification,
          {
            id: VIEWPOINTS_LAYER,
            type: "symbol" as const,
            ...textMinZoom,
            source: VIEWPOINTS_SOURCE,
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Medium"],
              "text-size": labelSize([[0, VIEWPOINT_TEXT_SIZE]], labelScale),
              "text-variable-anchor": ["left", "right", "top", "bottom"],
              "text-radial-offset": badges
                ? ["case", ["has", "badge"], VIEWPOINT_BADGE_OFFSET, VIEWPOINT_OFFSET]
                : VIEWPOINT_OFFSET,
              "text-justify": "auto",
            },
            paint: textPaint,
          } satisfies LayerSpecification,
        ]
      : []),
    ...(timeLabels.length > 0
      ? [
          {
            id: TIME_LABEL_DOTS_LAYER,
            type: "circle" as const,
            source: TIME_LABELS_SOURCE,
            paint: {
              "circle-radius": labelSize(TIME_LABEL_DOT_STOPS, labelScale),
              "circle-color": routeColor,
              "circle-stroke-color": chrome.bg,
              "circle-stroke-width": 1.5,
            },
          } satisfies LayerSpecification,
          {
            id: TIME_LABELS_LAYER,
            type: "symbol" as const,
            ...textMinZoom,
            source: TIME_LABELS_SOURCE,
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Medium"],
              "text-size": labelSize([[0, TIME_LABEL_TEXT_SIZE]], labelScale),
              "text-variable-anchor": ["left", "right", "top", "bottom"],
              "text-radial-offset": 0.6,
              "text-justify": "auto",
            },
            paint: textPaint,
          } satisfies LayerSpecification,
        ]
      : []),
  ];
  return { sources, layers };
}
