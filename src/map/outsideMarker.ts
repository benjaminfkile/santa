// docs/site.md sections 8.6 and 8.10. The user marker of a visitor outside
// the event box, shared by the Google and the MapLibre user location: the
// true position in container pixels is clamped to the rectangle inset
// OUTSIDE_SHIFT_PX from every viewport edge (dot radius 8, chevron 8,
// margin 4), so the whole dot and its chevron show on screen at any view.
// The chevron's centre sits CHEVRON_OFFSET_PX from the dot's centre along
// the initial bearing on the sphere from the drawn point to the true one.

import type { LatLng } from "./bounds";

export const OUTSIDE_SHIFT_PX = 20;
export const CHEVRON_OFFSET_PX = 12;
export const CHEVRON_SIZE_PX = 8;

// A chevron 8 px across centred on the origin, pointing up (north).
export const CHEVRON_PATH = "M-4 3L0 -4L4 3L0 1Z";

export type Pixel = { x: number; y: number };

// `point`, in container pixels with y down, clamped to the rectangle
// `inset` px inside a viewport of `size`, and whether the clamp moved it.
// A viewport narrower or shorter than twice the inset clamps that axis to
// its middle.
export function clampToViewport(
  point: Pixel,
  size: { width: number; height: number },
  inset: number = OUTSIDE_SHIFT_PX,
): { point: Pixel; moved: boolean } {
  const axis = (v: number, length: number) =>
    length < 2 * inset ? length / 2 : Math.min(Math.max(v, inset), length - inset);
  const x = axis(point.x, size.width);
  const y = axis(point.y, size.height);
  return { point: { x, y }, moved: x !== point.x || y !== point.y };
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
