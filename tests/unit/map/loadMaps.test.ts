// docs/site.md section 8.1. The Google Maps loader races its three library
// imports against a 15 s timer: an import that never settles fails with a
// named reason and the next call starts a new attempt; an import that
// settles at once resolves and leaves no timer behind.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { importLibrary } from "@googlemaps/js-api-loader";
import { LOAD_TIMEOUT_MS, loadMaps, resetMapsLoaderForTests } from "../../../src/map/loadMaps";

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(),
}));

const importMock = vi.mocked(importLibrary);

beforeEach(() => {
  vi.useFakeTimers();
  importMock.mockReset();
  resetMapsLoaderForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadMaps", () => {
  it("waits 15 s", () => {
    expect(LOAD_TIMEOUT_MS).toBe(15_000);
  });

  it("rejects after 15 s when an import never settles, and the next call starts a new attempt", async () => {
    importMock.mockImplementation(() => new Promise(() => {}));
    const first = loadMaps();
    const outcome = first.then(
      () => "resolved",
      (e: unknown) => (e as Error).message,
    );
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS - 1);
    expect(importMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toBe("Google Maps did not answer in 15 s");

    const second = loadMaps();
    expect(second).not.toBe(first);
    expect(importMock).toHaveBeenCalledTimes(6);
    second.catch(() => {});
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
  });

  it("resolves when the imports settle at once and clears the timer", async () => {
    importMock.mockImplementation((name: string) => Promise.resolve({ name } as never));
    const libs = await loadMaps();
    expect(libs).toEqual({ maps: { name: "maps" }, marker: { name: "marker" }, geometry: { name: "geometry" } });
    expect(vi.getTimerCount()).toBe(0);
  });
});
