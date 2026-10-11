// docs/site.md section 8.5: the tracker's choices are stored under one
// localStorage key, the content default applies until the viewer has
// chosen, and a blocked storage still keeps a choice for the page load.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRACKER_SETTINGS_KEY,
  readTrackerMapType,
  readTrackerToggle,
  resetTrackerTogglesForTests,
  writeTrackerMapType,
  writeTrackerToggle,
} from "../../../../src/content/sections/Map/trackerToggles";

beforeEach(() => resetTrackerTogglesForTests());
afterEach(() => {
  vi.restoreAllMocks();
  resetTrackerTogglesForTests();
});

describe("trackerToggles", () => {
  it("falls back to the content default until the viewer has chosen", () => {
    expect(readTrackerToggle("flightHistory", false)).toBe(false);
    expect(readTrackerToggle("flightHistory", true)).toBe(true);
    expect(readTrackerMapType("terrain")).toBe("terrain");
  });

  it("stores every choice under one localStorage key", () => {
    writeTrackerToggle("flightHistory", true);
    writeTrackerToggle("timeLabels", false);
    writeTrackerMapType("roadmap");
    expect(JSON.parse(window.localStorage.getItem(TRACKER_SETTINGS_KEY) ?? "{}")).toEqual({
      flightHistory: true,
      timeLabels: false,
      mapType: "roadmap",
    });
  });

  it("reads a choice a previous page load stored", () => {
    window.localStorage.setItem(
      TRACKER_SETTINGS_KEY,
      JSON.stringify({ flightHistory: true, cookieTally: false, mapType: "roadmap" }),
    );
    expect(readTrackerToggle("flightHistory", false)).toBe(true);
    expect(readTrackerToggle("cookieTally", true)).toBe(false);
    expect(readTrackerToggle("landmarks", true)).toBe(true);
    expect(readTrackerMapType("terrain")).toBe("roadmap");
  });

  it("ignores a stored value of the wrong shape", () => {
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify({ flightHistory: "yes", mapType: "moon" }));
    expect(readTrackerToggle("flightHistory", false)).toBe(false);
    expect(readTrackerMapType("terrain")).toBe("terrain");
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, "not json");
    expect(readTrackerToggle("flightHistory", true)).toBe(true);
  });

  it("keeps a choice in memory while storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    writeTrackerToggle("landmarks", false);
    expect(readTrackerToggle("landmarks", true)).toBe(false);
  });
});
