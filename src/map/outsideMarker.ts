// docs/site.md sections 8.6 and 8.10. The user marker of a visitor outside
// the event box, shared by the Google and the MapLibre user location: the
// marker stands on the clamped point and is shifted OUTSIDE_SHIFT_PX
// toward the inside of the box on each clamped axis (dot radius 8, chevron
// 8, margin 4), so the whole dot and its chevron show at the furthest pan.
// The chevron's centre sits CHEVRON_OFFSET_PX from the dot's centre along
// the initial bearing on the sphere from the drawn point to the true one.

import type { Bbox, LatLng } from "./bounds";

export const OUTSIDE_SHIFT_PX = 20;
export const CHEVRON_OFFSET_PX = 12;
export const CHEVRON_SIZE_PX = 8;

// A chevron 8 px across centred on the origin, pointing up (north).
export const CHEVRON_PATH = "M-4 3L0 -4L4 3L0 1Z";

// The screen shift, in pixels with y down, that moves the marker toward
// the inside of the box on each axis the point lies outside.
export function outsideShift(point: LatLng, bbox: Bbox): { x: number; y: number } {
  const x = point.lng < bbox.west ? OUTSIDE_SHIFT_PX : point.lng > bbox.east ? -OUTSIDE_SHIFT_PX : 0;
  const y = point.lat > bbox.north ? OUTSIDE_SHIFT_PX : point.lat < bbox.south ? -OUTSIDE_SHIFT_PX : 0;
  return { x, y };
}

// The initial bearing on the sphere from `from` to `to`, in degrees
// clockwise from north, in [0, 360).
export function initialBearing(from: LatLng, to: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const p1 = rad(from.lat);
  const p2 = rad(to.lat);
  const dl = rad(to.lng - from.lng);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}
