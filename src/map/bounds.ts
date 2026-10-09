// docs/site.md section 8.2. The event box (`snapshot.event.trackerBbox`)
// both map controllers are locked to. `toBbox` reads the snapshot's box,
// null unless all four edges are finite and the box is not empty.
// `fittedMinZoom` is the zoom at which the box's Mercator extent fits the
// viewport, floored and never below MIN_ZOOM_FLOOR. `clampToBbox` moves a
// point onto the box edge on each axis it lies outside; `nearestInBox`
// gives the same point together with whether the original was inside.

export type Bbox = { west: number; south: number; east: number; north: number };
export type LatLng = { lat: number; lng: number };
export type Viewport = { width: number; height: number };

export const MIN_ZOOM_FLOOR = 5;
// The world is one 256 px tile across at zoom 0.
const TILE_SIZE = 256;

export function toBbox(raw: Partial<Bbox> | null | undefined): Bbox | null {
  if (raw === null || raw === undefined) return null;
  const { west, south, east, north } = raw;
  if (
    typeof west !== "number" || !Number.isFinite(west) ||
    typeof south !== "number" || !Number.isFinite(south) ||
    typeof east !== "number" || !Number.isFinite(east) ||
    typeof north !== "number" || !Number.isFinite(north)
  ) {
    return null;
  }
  if (east <= west || north <= south) return null;
  return { west, south, east, north };
}

function mercatorY(lat: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export function fittedMinZoom(bbox: Bbox, viewport: Viewport): number {
  const { width, height } = viewport;
  if (!(width > 0) || !(height > 0)) return MIN_ZOOM_FLOOR;
  // The box's share of the world's width and of its Mercator height.
  const xShare = (bbox.east - bbox.west) / 360;
  const yShare = (mercatorY(bbox.north) - mercatorY(bbox.south)) / (2 * Math.PI);
  if (!(xShare > 0) || !(yShare > 0)) return MIN_ZOOM_FLOOR;
  const zoomX = Math.log2(width / (TILE_SIZE * xShare));
  const zoomY = Math.log2(height / (TILE_SIZE * yShare));
  const zoom = Math.floor(Math.min(zoomX, zoomY));
  return Math.max(MIN_ZOOM_FLOOR, zoom);
}

export function inBox(point: LatLng, bbox: Bbox): boolean {
  return (
    point.lat >= bbox.south && point.lat <= bbox.north &&
    point.lng >= bbox.west && point.lng <= bbox.east
  );
}

export function clampToBbox(point: LatLng, bbox: Bbox): LatLng {
  return {
    lat: Math.min(bbox.north, Math.max(bbox.south, point.lat)),
    lng: Math.min(bbox.east, Math.max(bbox.west, point.lng)),
  };
}

export function nearestInBox(point: LatLng, bbox: Bbox): { point: LatLng; inside: boolean } {
  const inside = inBox(point, bbox);
  return { point: inside ? point : clampToBbox(point, bbox), inside };
}
