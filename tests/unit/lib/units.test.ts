// docs/site.md section 22.1. units helpers.

import { describe, it, expect } from "vitest";
import {
  headingToCardinal,
  metresToFeet,
  metresToMiles,
  mpsToMph,
} from "../../../src/lib/units";

describe("mpsToMph", () => {
  it("converts m/s to mph", () => {
    expect(mpsToMph(1)).toBeCloseTo(2.2369362920544, 6);
    expect(mpsToMph(0)).toBe(0);
    expect(mpsToMph(10)).toBeCloseTo(22.369, 3);
  });
});

describe("metresToFeet", () => {
  it("converts metres to feet", () => {
    expect(metresToFeet(1)).toBeCloseTo(3.28084, 4);
    expect(metresToFeet(100)).toBeCloseTo(328.084, 3);
  });
});

describe("metresToMiles", () => {
  it("converts metres to miles", () => {
    // 1609.344 m == 1 mile
    expect(metresToMiles(1609.344)).toBeCloseTo(1, 6);
    expect(metresToMiles(3218.688)).toBeCloseTo(2, 6);
  });

  it("returns feet under a mile and miles over a mile", () => {
    // 800 m ~ 0.497 miles: about 2624 feet
    expect(metresToMiles(800)).toBeLessThan(1);
    expect(metresToFeet(800)).toBeGreaterThan(2600);
    // 2 miles: 3218.688 m: 2 miles
    expect(metresToMiles(3218.688)).toBeCloseTo(2, 5);
  });
});

describe("headingToCardinal", () => {
  it("maps degrees to eight-way cardinals", () => {
    expect(headingToCardinal(0)).toBe("N");
    expect(headingToCardinal(45)).toBe("NE");
    expect(headingToCardinal(90)).toBe("E");
    expect(headingToCardinal(135)).toBe("SE");
    expect(headingToCardinal(180)).toBe("S");
    expect(headingToCardinal(225)).toBe("SW");
    expect(headingToCardinal(270)).toBe("W");
    expect(headingToCardinal(315)).toBe("NW");
    expect(headingToCardinal(360)).toBe("N");
  });

  it("wraps negative and large values", () => {
    expect(headingToCardinal(-90)).toBe("W");
    expect(headingToCardinal(720 + 45)).toBe("NE");
  });

  it("rounds to the nearest cardinal", () => {
    expect(headingToCardinal(22)).toBe("N");
    expect(headingToCardinal(23)).toBe("NE");
    expect(headingToCardinal(67)).toBe("NE");
    expect(headingToCardinal(68)).toBe("E");
  });
});
