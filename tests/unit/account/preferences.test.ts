// docs/site.md sections 6.1 step 4, 7.7, and 22.1. The account sync of the
// theme and tracker choices: the local object, the server copy applied
// without a push, and one debounced `PUT /me/preferences` per burst of
// changes while signed in, none signed out or for a preview override, and
// a failed save swallowed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/api/preferences", () => ({
  putPreferences: vi.fn(),
}));

import * as prefsApi from "../../../src/api/preferences";
import {
  applyServerPreferences,
  localPreferences,
  startPreferencesSync,
} from "../../../src/account/preferences";
import { THEME_KEY, clearTheme, getChoice, releaseTheme, setTheme } from "../../../src/content/theme/colorScheme";
import {
  TRACKER_SETTINGS_KEY,
  readTrackerSettings,
  resetTrackerTogglesForTests,
  writeTrackerMapType,
  writeTrackerToggle,
} from "../../../src/content/sections/Map/trackerToggles";

const FULL = {
  flightHistory: true,
  timeLabels: false,
  landmarks: true,
  flightDock: false,
  cookieTally: true,
  snow: true,
  mapType: "roadmap" as const,
};

let stop: (() => void) | null = null;

beforeEach(() => {
  window.localStorage.clear();
  resetTrackerTogglesForTests();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  vi.mocked(prefsApi.putPreferences).mockReset();
  vi.mocked(prefsApi.putPreferences).mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  stop?.();
  stop = null;
  releaseTheme();
  vi.useRealTimers();
  resetTrackerTogglesForTests();
  window.localStorage.clear();
});

describe("localPreferences", () => {
  it("reads the system choice as a null theme and an empty tracker object", () => {
    expect(localPreferences()).toEqual({ theme: null, tracker: {} });
  });

  it("reads light and dark", () => {
    window.localStorage.setItem(THEME_KEY, "light");
    expect(localPreferences().theme).toBe("light");
    window.localStorage.setItem(THEME_KEY, "dark");
    expect(localPreferences().theme).toBe("dark");
  });

  it("carries a full tracker object", () => {
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify(FULL));
    expect(localPreferences()).toEqual({ theme: null, tracker: FULL });
  });
});

describe("applyServerPreferences", () => {
  it("sets the theme, replaces the tracker object, and triggers no push", () => {
    stop = startPreferencesSync(() => true);
    writeTrackerToggle("snow", true);
    vi.advanceTimersByTime(1000);
    expect(prefsApi.putPreferences).toHaveBeenCalledTimes(1);
    vi.mocked(prefsApi.putPreferences).mockClear();

    applyServerPreferences({ theme: "dark", tracker: { flightHistory: true, mapType: "terrain" } });
    expect(getChoice()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    // `snow`, absent on the server, is removed locally.
    expect(readTrackerSettings()).toEqual({ flightHistory: true, mapType: "terrain" });
    vi.advanceTimersByTime(5000);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });

  it("a null theme clears the stored choice", () => {
    setTheme("light");
    applyServerPreferences({ theme: null, tracker: {} });
    expect(getChoice()).toBe("system");
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it("keeps a preview session's override on screen", () => {
    setTheme("light", { persist: false });
    applyServerPreferences({ theme: "dark", tracker: {} });
    expect(getChoice()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("startPreferencesSync", () => {
  it("pushes once 1 s after a burst of three changes with the full local object", () => {
    stop = startPreferencesSync(() => true);
    setTheme("dark");
    writeTrackerToggle("flightHistory", true);
    writeTrackerMapType("roadmap");
    vi.advanceTimersByTime(999);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(prefsApi.putPreferences).toHaveBeenCalledTimes(1);
    expect(prefsApi.putPreferences).toHaveBeenCalledWith({
      theme: "dark",
      tracker: { flightHistory: true, mapType: "roadmap" },
    });
    vi.advanceTimersByTime(5000);
    expect(prefsApi.putPreferences).toHaveBeenCalledTimes(1);
  });

  it("restarts the wait on a change during it", () => {
    stop = startPreferencesSync(() => true);
    writeTrackerToggle("snow", true);
    vi.advanceTimersByTime(800);
    clearTheme();
    vi.advanceTimersByTime(800);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(prefsApi.putPreferences).toHaveBeenCalledTimes(1);
  });

  it("pushes nothing while signed out", () => {
    stop = startPreferencesSync(() => false);
    setTheme("dark");
    writeTrackerToggle("snow", true);
    vi.advanceTimersByTime(5000);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });

  it("pushes nothing for a non-persisted override", () => {
    stop = startPreferencesSync(() => true);
    setTheme("dark", { persist: false });
    vi.advanceTimersByTime(5000);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });

  it("pushes nothing at boot", () => {
    window.localStorage.setItem(THEME_KEY, "dark");
    window.localStorage.setItem(TRACKER_SETTINGS_KEY, JSON.stringify(FULL));
    stop = startPreferencesSync(() => true);
    vi.advanceTimersByTime(5000);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });

  it("swallows a rejected request and keeps the local copy", async () => {
    vi.mocked(prefsApi.putPreferences).mockRejectedValueOnce(new Error("network"));
    stop = startPreferencesSync(() => true);
    setTheme("dark");
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();
    expect(prefsApi.putPreferences).toHaveBeenCalledTimes(1);
    expect(getChoice()).toBe("dark");
  });

  it("stops following the stores after the teardown", () => {
    stop = startPreferencesSync(() => true);
    writeTrackerToggle("snow", true);
    stop();
    stop = null;
    vi.advanceTimersByTime(5000);
    writeTrackerToggle("snow", false);
    vi.advanceTimersByTime(5000);
    expect(prefsApi.putPreferences).not.toHaveBeenCalled();
  });
});
