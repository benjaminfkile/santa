// docs/site.md section 8.6. `formatDistanceMetres`: feet under one mile,
// miles to two decimals with commas otherwise.

import { describe, it, expect } from "vitest";
import { formatDistanceMetres } from "../../../src/map/userLocation";

describe("formatDistanceMetres", () => {
  it("returns the empty string for invalid input", () => {
    expect(formatDistanceMetres(Number.NaN)).toBe("");
    expect(formatDistanceMetres(-1)).toBe("");
  });

  it("uses feet under one mile", () => {
    expect(formatDistanceMetres(0)).toBe("0 ft");
    expect(formatDistanceMetres(1)).toBe("3 ft");
    expect(formatDistanceMetres(304.8)).toBe("1,000 ft");
    // Just under a mile: still in feet.
    expect(formatDistanceMetres(1609)).toBe("5,279 ft");
  });

  it("uses miles at one mile and above with two decimals", () => {
    expect(formatDistanceMetres(1609.344)).toBe("1.00 mi");
    expect(formatDistanceMetres(2 * 1609.344)).toBe("2.00 mi");
    expect(formatDistanceMetres(3.5 * 1609.344)).toBe("3.50 mi");
  });

  it("groups miles with commas", () => {
    expect(formatDistanceMetres(1000 * 1609.344)).toBe("1,000.00 mi");
  });
});
