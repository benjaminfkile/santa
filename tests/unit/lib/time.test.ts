// docs/site.md section 22.1. time helpers.

import { describe, it, expect } from "vitest";
import { formatCountdown, formatElapsed, formatMountainTime } from "../../../src/lib/time";

describe("formatCountdown", () => {
  it("formats a positive duration as Xd Xh Xm Xs", () => {
    const seven = 7 * 24 * 3600 * 1000;
    expect(formatCountdown(seven + 3600000 + 60000 * 15 + 42_000)).toBe("7d 1h 15m 42s");
  });

  it("returns 0d 0h 0m 0s at or below zero", () => {
    expect(formatCountdown(0)).toBe("0d 0h 0m 0s");
    expect(formatCountdown(-1000)).toBe("0d 0h 0m 0s");
  });

  it("handles sub-second durations as zero seconds", () => {
    expect(formatCountdown(500)).toBe("0d 0h 0m 0s");
  });
});

describe("formatElapsed", () => {
  it("formats minutes only when under an hour", () => {
    expect(formatElapsed(60_000 * 42)).toBe("42m");
  });

  it("formats hours and minutes when at or over an hour", () => {
    expect(formatElapsed(3600000 + 60000 * 12)).toBe("1h 12m");
  });

  it("returns 0m at or below zero", () => {
    expect(formatElapsed(0)).toBe("0m");
    expect(formatElapsed(-100)).toBe("0m");
  });
});

describe("formatMountainTime", () => {
  it("formats an ISO date in America/Denver with a zone abbreviation", () => {
    // 2026-12-22T01:00:00Z is Dec 21 6:00 PM MST
    const out = formatMountainTime("2026-12-22T01:00:00.000Z");
    expect(out).toMatch(/Dec\s+21/);
    expect(out).toMatch(/6:00/);
    expect(out).toMatch(/PM/);
    expect(out).toMatch(/M[SD]T/);
  });

  it("returns an empty string for null or invalid input", () => {
    expect(formatMountainTime(null)).toBe("");
    expect(formatMountainTime(undefined)).toBe("");
    expect(formatMountainTime("not a date")).toBe("");
  });
});
