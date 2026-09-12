// docs/site.md section 22.1 rows for loop.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Snapshot } from "../../src/contracts";

// Mock env so any transitive imports resolve.
vi.mock("../../src/config/env", () => ({
  env: {
    ENV: "preview",
    CDN_BASE_URL: "https://cdn.example",
    HUB_URL: "wss://hub.example/hub",
    HUB_CHANNEL_PREFIX: "wmsfo-api-dev",
    API_BASE_URL: "https://api.example",
    COGNITO_AUTHORITY: "https://cognito.example/authority",
    COGNITO_DOMAIN: "https://cognito.example",
    COGNITO_CLIENT_ID: "clientid",
    GOOGLE_MAPS_KEY: "key",
    ANALYTICS_ID: "",
    ANALYTICS_ORIGINS: [] as string[],
  },
  LIVE_URL: "https://cdn.example/live/location.json",
  LOCATION_CHANNEL: "wmsfo-api-dev:location",
  IS_PRODUCTION: false,
}));

type Fetchers = {
  fetchLive: ReturnType<typeof vi.fn>;
  fetchSnapshot: ReturnType<typeof vi.fn>;
};

vi.mock("../../src/store/fetchers", () => ({
  fetchLive: vi.fn(),
  fetchSnapshot: vi.fn(),
  CdnError: class CdnError extends Error {},
  SchemaVersionError: class SchemaVersionError extends Error {},
}));

import * as fetchers from "../../src/store/fetchers";
import { createStore } from "../../src/store/store";
import { initialStore } from "../../src/store/types";
import type { LiveObject } from "../../src/contracts";
import { startDataLoop, pollNow, applyIncomingLive, _resetLoopForTests } from "../../src/store/loop";

function live(overrides: Partial<LiveObject>): LiveObject {
  return {
    schemaVersion: 1,
    eventId: 1,
    eventStatusId: 2,
    pollIntervalMs: 5000,
    snapshotUrl: "https://cdn.example/snap-1.json",
    cookieTally: {},
    seq: 1,
    lat: 0,
    lng: 0,
    speedMps: null,
    altitudeM: null,
    headingDeg: null,
    accuracyM: null,
    recordedAt: null,
    receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
    ...overrides,
  };
}

const f = fetchers as unknown as Fetchers;

// Serve fetchers a queue of results; each call shifts one.
function queue<T>(fn: ReturnType<typeof vi.fn>, values: Array<T | Error | Promise<T>>): void {
  fn.mockImplementation(() => {
    const v = values.shift();
    if (v instanceof Error) return Promise.reject(v);
    return Promise.resolve(v);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  f.fetchLive.mockReset();
  f.fetchSnapshot.mockReset();
  _resetLoopForTests();
});

afterEach(() => {
  _resetLoopForTests();
  vi.useRealTimers();
});

describe("loop startup", () => {
  it("retries fetchLive on 1, 2, 3, 5, 5 s and applies on the first success", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [
      new Error("net"),
      new Error("net"),
      new Error("net"),
      new Error("net"),
      new Error("net"),
      live({ seq: 1, snapshotUrl: "https://cdn.example/s1.json" }),
    ]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });

    // Attempt 1 (immediate).
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(1);
    // Wait 1000ms → attempt 2
    now += 1000; await vi.advanceTimersByTimeAsync(1000);
    expect(f.fetchLive).toHaveBeenCalledTimes(2);
    // Wait 2000ms → attempt 3
    now += 2000; await vi.advanceTimersByTimeAsync(2000);
    expect(f.fetchLive).toHaveBeenCalledTimes(3);
    // Wait 3000ms → attempt 4
    now += 3000; await vi.advanceTimersByTimeAsync(3000);
    expect(f.fetchLive).toHaveBeenCalledTimes(4);
    // Wait 5000ms → attempt 5
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetchLive).toHaveBeenCalledTimes(5);
    // Wait another 5000ms → attempt 6 succeeds
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetchLive).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().live?.seq).toBe(1);
  });
});

describe("loop poll timer", () => {
  it("re-arms after each completion and never overlaps", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    // Startup: succeed immediately.
    queue(f.fetchLive, [
      live({ seq: 1 }),
      live({ seq: 2 }),
      live({ seq: 3 }),
    ]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(1);
    // Cadence is 5000ms base (pollIntervalMs). Advance and expect one call.
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetchLive).toHaveBeenCalledTimes(2);
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetchLive).toHaveBeenCalledTimes(3);
  });

  it("picks up the new pollIntervalMs on the next arm", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [
      live({ seq: 1, pollIntervalMs: 5000 }),
      live({ seq: 2, pollIntervalMs: 2000 }),
      live({ seq: 3, pollIntervalMs: 2000 }),
    ]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(1);
    // First arm uses 5000 from the just-applied object.
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetchLive).toHaveBeenCalledTimes(2);
    // Second arm now uses 2000.
    now += 2000; await vi.advanceTimersByTimeAsync(2000);
    expect(f.fetchLive).toHaveBeenCalledTimes(3);
  });

  it("increments consecutivePollFailures on tick errors", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [live({ seq: 1 }), new Error("boom"), new Error("boom")]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().diag.consecutivePollFailures).toBe(0);
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(store.getState().diag.consecutivePollFailures).toBe(1);
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(store.getState().diag.consecutivePollFailures).toBe(2);
    // Store live object stays.
    expect(store.getState().live?.seq).toBe(1);
  });
});

describe("loop visibility and online", () => {
  it("clears the timer when the document becomes hidden and polls when visible", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [live({ seq: 1 }), live({ seq: 2 }), live({ seq: 3 })]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    let hidden = false;
    const doc = {
      get hidden() {
        return hidden;
      },
      addEventListener: document.addEventListener.bind(document),
      removeEventListener: document.removeEventListener.bind(document),
    } as unknown as Document;
    void startDataLoop({ store, now: () => now, document: doc, window });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(1);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetchLive).toHaveBeenCalledTimes(1); // no poll while hidden
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(2); // pollNow fired
  });

  it("triggers pollNow on online", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [live({ seq: 1 }), live({ seq: 2 })]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(2);
    expect(store.getState().diag.online).toBe(true);
  });

  it("sets online=false on offline", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [live({ seq: 1 })]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event("offline"));
    expect(store.getState().diag.online).toBe(false);
  });

  it("pollNow fires an immediate fetch", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [live({ seq: 1 }), live({ seq: 2 })]);
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: {},
    } as Snapshot);
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    pollNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchLive).toHaveBeenCalledTimes(2);
  });
});

describe("loop snapshot", () => {
  it("fetches the snapshot on URL change and discards stale results", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [
      live({ seq: 1, snapshotUrl: "https://cdn.example/A.json" }),
      live({ seq: 2, snapshotUrl: "https://cdn.example/B.json" }),
    ]);
    let resolveA: (v: unknown) => void = () => {};
    f.fetchSnapshot.mockImplementation((url: string) => {
      if (url.endsWith("A.json")) {
        return new Promise((r) => {
          resolveA = r;
        });
      }
      return Promise.resolve({ schemaVersion: 1, event: {} });
    });
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchSnapshot).toHaveBeenCalledWith("https://cdn.example/A.json");
    // Poll again → applies the second object (seq 2, new snapshotUrl).
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(store.getState().live?.snapshotUrl).toBe("https://cdn.example/B.json");
    expect(f.fetchSnapshot).toHaveBeenCalledWith("https://cdn.example/B.json");
    // Now resolve A. It should be discarded.
    resolveA({ schemaVersion: 1, event: {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().snapshotUrl).toBe("https://cdn.example/B.json");
  });

  it("clears the snapshot when the live object's snapshotUrl becomes null", async () => {
    let now = 0;
    const store = createStore({ ...initialStore });
    queue(f.fetchLive, [
      live({ seq: 1, snapshotUrl: "https://cdn.example/A.json" }),
      live({ seq: 2, snapshotUrl: null }),
    ]);
    f.fetchSnapshot.mockResolvedValue({ schemaVersion: 1, event: {} });
    void startDataLoop({ store, now: () => now });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().snapshotUrl).toBe("https://cdn.example/A.json");
    now += 5000; await vi.advanceTimersByTimeAsync(5000);
    expect(store.getState().snapshot).toBeNull();
    expect(store.getState().snapshotUrl).toBeNull();
  });
});

describe("store shape", () => {
  it("does not carry route, routeUrl, or routeFetchFailing anywhere", () => {
    const store = createStore({ ...initialStore });
    const state = store.getState() as Record<string, unknown> & {
      diag: Record<string, unknown>;
    };
    expect("route" in state).toBe(false);
    expect("routeUrl" in state).toBe(false);
    expect("routeFetchFailing" in state.diag).toBe(false);
  });
});

describe("hub-applied live objects", () => {
  it("fetches the snapshot a pushed live object points at, even when a later poll finds it already applied", async () => {
    let now = 0;
    const store = createStore({
      ...initialStore,
      live: live({ seq: 1, snapshotUrl: "https://cdn.example/s1.json", publishedAt: "2024-12-24T00:00:00Z" }),
      snapshot: { schemaVersion: 1, event: { statusId: 1 } } as unknown as Snapshot,
      snapshotUrl: "https://cdn.example/s1.json",
    });
    f.fetchSnapshot.mockResolvedValue({
      schemaVersion: 1,
      event: { statusId: 2 },
    } as unknown as Snapshot);

    // The hub delivers a newer live object whose snapshotUrl moved.
    const pushed = live({ seq: 2, eventStatusId: 2, snapshotUrl: "https://cdn.example/s2.json", publishedAt: "2024-12-24T00:00:10Z" });
    await applyIncomingLive(store, pushed, () => now);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetchSnapshot).toHaveBeenCalledWith("https://cdn.example/s2.json");
    expect(store.getState().snapshotUrl).toBe("https://cdn.example/s2.json");
    expect(store.getState().snapshot?.event?.statusId).toBe(2);

    // A poll that returns the same object again is not applied but changes nothing.
    f.fetchSnapshot.mockClear();
    const applied = await applyIncomingLive(store, pushed, () => now);
    expect(applied).toBe(false);
    expect(f.fetchSnapshot).not.toHaveBeenCalled();
  });
});
