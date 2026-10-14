// docs/site.md sections 8.6 and 8.10. `clampToViewport`: a point in
// container pixels clamped to the rectangle 20 px inside the viewport,
// reporting whether the clamp moved it, on each edge, at a corner, and
// inside.

import { describe, it, expect } from "vitest";
import { clampToViewport, OUTSIDE_SHIFT_PX } from "../../../src/map/outsideMarker";

const SIZE = { width: 1493, height: 1180 };

describe("clampToViewport", () => {
  it("leaves a point inside the inset where it is", () => {
    expect(clampToViewport({ x: 700, y: 500 }, SIZE)).toEqual({ point: { x: 700, y: 500 }, moved: false });
    expect(clampToViewport({ x: 20, y: 1160 }, SIZE)).toEqual({ point: { x: 20, y: 1160 }, moved: false });
  });

  it("clamps past each edge on that axis only", () => {
    expect(clampToViewport({ x: -300, y: 500 }, SIZE)).toEqual({ point: { x: 20, y: 500 }, moved: true });
    expect(clampToViewport({ x: 2000, y: 500 }, SIZE)).toEqual({ point: { x: 1473, y: 500 }, moved: true });
    expect(clampToViewport({ x: 700, y: -5 }, SIZE)).toEqual({ point: { x: 700, y: 20 }, moved: true });
    expect(clampToViewport({ x: 700, y: 1170 }, SIZE)).toEqual({ point: { x: 700, y: 1160 }, moved: true });
  });

  it("clamps past a corner on both axes", () => {
    expect(clampToViewport({ x: 2877, y: 2647 }, SIZE)).toEqual({ point: { x: 1473, y: 1160 }, moved: true });
  });

  it("takes the inset it is given, 20 px by default", () => {
    expect(OUTSIDE_SHIFT_PX).toBe(20);
    expect(clampToViewport({ x: 0, y: 0 }, SIZE, 5)).toEqual({ point: { x: 5, y: 5 }, moved: true });
  });

  it("puts an axis shorter than twice the inset at its middle", () => {
    expect(clampToViewport({ x: 500, y: 10 }, { width: 30, height: 100 })).toEqual({
      point: { x: 15, y: 20 },
      moved: true,
    });
  });
});
