// docs/site.md section 8.2. The event box helpers: `fittedMinZoom` is the
// floored zoom at which the box's Mercator extent fits the viewport, never
// below 5; `clampToBbox` and `nearestInBox` move a point onto the box edge
// on each axis it lies outside and leave a point inside where it is.

import { describe, it, expect } from "vitest";
import { clampToBbox, fittedMinZoom, nearestInBox, toBbox } from "../../../src/map/bounds";

// The valley box of the contracts fixture snapshot.
const VALLEY = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };

describe("fittedMinZoom", () => {
  it("fits the valley box on a phone, limited by its width", () => {
    expect(fittedMinZoom(VALLEY, { width: 390, height: 844 })).toBe(10);
  });

  it("fits the valley box on a desktop, limited by its height", () => {
    expect(fittedMinZoom(VALLEY, { width: 1440, height: 900 })).toBe(11);
  });

  it("is never below 5", () => {
    const continent = { west: -130, south: 20, east: -60, north: 55 };
    expect(fittedMinZoom(continent, { width: 390, height: 844 })).toBe(5);
    expect(fittedMinZoom(VALLEY, { width: 0, height: 0 })).toBe(5);
  });
});

describe("clampToBbox and nearestInBox", () => {
  it("leave a point inside the box where it is", () => {
    const p = { lat: 46.9, lng: -114 };
    expect(clampToBbox(p, VALLEY)).toEqual(p);
    expect(nearestInBox(p, VALLEY)).toEqual({ point: p, inside: true });
  });

  it("move a point outside on one axis onto that edge", () => {
    expect(clampToBbox({ lat: 47.5, lng: -114 }, VALLEY)).toEqual({ lat: 47.05, lng: -114 });
    expect(clampToBbox({ lat: 46.9, lng: -113 }, VALLEY)).toEqual({ lat: 46.9, lng: -113.8 });
    expect(nearestInBox({ lat: 46, lng: -114 }, VALLEY)).toEqual({
      point: { lat: 46.75, lng: -114 },
      inside: false,
    });
  });

  it("move a point outside on both axes onto the corner", () => {
    expect(clampToBbox({ lat: 48, lng: -116 }, VALLEY)).toEqual({ lat: 47.05, lng: -114.3 });
    expect(nearestInBox({ lat: 45, lng: -112 }, VALLEY)).toEqual({
      point: { lat: 46.75, lng: -113.8 },
      inside: false,
    });
  });
});

describe("toBbox", () => {
  it("reads a complete box and refuses a partial or empty one", () => {
    expect(toBbox(VALLEY)).toEqual(VALLEY);
    expect(toBbox({ west: -114.3, south: 46.75, east: -113.8 })).toBeNull();
    expect(toBbox({ west: -113, south: 46.75, east: -114, north: 47 })).toBeNull();
    expect(toBbox(null)).toBeNull();
  });
});
