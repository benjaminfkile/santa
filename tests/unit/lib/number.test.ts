// docs/site.md section 2. The tracker's one number format.

import { describe, it, expect } from "vitest";
import { formatCount, formatCountWithUnit } from "../../../src/lib/number";

describe("formatCount", () => {
  it("leaves anything under a thousand alone", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(7)).toBe("7");
    expect(formatCount(999)).toBe("999");
  });

  it("rounds a fraction under a thousand to a whole number", () => {
    expect(formatCount(12.4)).toBe("12");
    expect(formatCount(12.6)).toBe("13");
  });

  it("abbreviates from a thousand up to one decimal", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1100)).toBe("1.1k");
    expect(formatCount(1150)).toBe("1.2k");
    expect(formatCount(4120)).toBe("4.1k");
    expect(formatCount(12345)).toBe("12.3k");
    expect(formatCount(999499)).toBe("999.5k");
  });

  it("drops a trailing zero rather than showing 1.0k", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1049)).toBe("1k");
    expect(formatCount(2000)).toBe("2k");
  });

  it("carries into the next unit when the rounding reaches it", () => {
    // 999.95k would print as "1000k", which is not a reading anyone wants.
    expect(formatCount(999950)).toBe("1M");
    expect(formatCount(1e6)).toBe("1M");
    expect(formatCount(1.25e6)).toBe("1.3M");
    expect(formatCount(1e9)).toBe("1B");
  });

  it("keeps counting in the largest unit past it", () => {
    expect(formatCount(2e12)).toBe("2000B");
  });

  it("keeps the sign on a negative", () => {
    expect(formatCount(-1100)).toBe("-1.1k");
    expect(formatCount(-12)).toBe("-12");
  });

  it("gives an empty string for a value that is not a number", () => {
    expect(formatCount(Number.NaN)).toBe("");
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("formatCountWithUnit", () => {
  it("puts the unit after the abbreviation", () => {
    expect(formatCountWithUnit(1100, "ft")).toBe("1.1k ft");
    expect(formatCountWithUnit(840, "ft")).toBe("840 ft");
  });

  it("gives an empty string when there is no number to show", () => {
    expect(formatCountWithUnit(Number.NaN, "ft")).toBe("");
  });
});
