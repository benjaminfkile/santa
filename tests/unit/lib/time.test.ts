// docs/site.md section 22.1. time helpers.

import { describe, it, expect } from "vitest";
import { formatCountdown, formatElapsed, formatEventTime, formatClock } from "../../../src/lib/time";

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

describe("formatEventTime", () => {
  it("formats an ISO date in the given zone with its abbreviation", () => {
    expect(formatEventTime("2026-12-22T01:00:00.000Z", "America/Denver")).toBe("Dec 21, 6:00 PM MST");
    expect(formatEventTime("2026-12-22T01:00:00.000Z", "America/New_York")).toBe("Dec 21, 8:00 PM EST");
  });

  it("returns an empty string for null or invalid input", () => {
    expect(formatEventTime(null)).toBe("");
    expect(formatEventTime(undefined)).toBe("");
    expect(formatEventTime("not a date")).toBe("");
  });
});

describe("formatClock", () => {
  it("formats hh:mm:ss on a 24-hour clock in the given zone", () => {
    const ms = Date.parse("2024-12-24T19:04:05Z");
    expect(formatClock(ms, "America/Denver")).toBe("12:04:05");
    expect(formatClock(ms, "Europe/London")).toBe("19:04:05");
  });

  it("returns an empty string for a non-finite value", () => {
    expect(formatClock(Number.NaN)).toBe("");
  });
});
