// docs/site.md section 22.1 rows for applyLive.shouldReplace and applyLive.

import { describe, it, expect } from "vitest";
import { shouldReplace, applyLive } from "../../src/store/applyLive";
import { initialStore } from "../../src/store/types";
import type { LiveObject } from "../../src/contracts";
import type { SiteStore } from "../../src/store/types";

function live(overrides: Partial<LiveObject>): LiveObject {
  return {
    schemaVersion: 1,
    eventId: 42,
    eventStatusId: 3,
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

function stateWith(cur: LiveObject | null): SiteStore {
  return { ...initialStore, live: cur };
}

describe("shouldReplace", () => {
  it("returns true when the store is empty", () => {
    expect(shouldReplace(null, live({}))).toBe(true);
  });

  it("compares publishedAt when the eventId differs (greater wins)", () => {
    const cur = live({ eventId: 1, publishedAt: "2024-12-24T00:00:00Z" });
    const next = live({ eventId: 2, publishedAt: "2024-12-24T00:00:01Z" });
    expect(shouldReplace(cur, next)).toBe(true);
  });

  it("compares publishedAt when the eventId differs (lesser loses)", () => {
    const cur = live({ eventId: 1, publishedAt: "2024-12-24T00:00:05Z" });
    const next = live({ eventId: 2, publishedAt: "2024-12-24T00:00:01Z" });
    expect(shouldReplace(cur, next)).toBe(false);
  });

  it("drops a lower seq for the same event", () => {
    const cur = live({ seq: 10 });
    const next = live({ seq: 9 });
    expect(shouldReplace(cur, next)).toBe(false);
  });

  it("drops a null seq after a non-null seq", () => {
    const cur = live({ seq: 5 });
    const next = live({ seq: null });
    expect(shouldReplace(cur, next)).toBe(false);
  });

  it("drops equal seq with equal or lesser publishedAt", () => {
    const cur = live({ seq: 5, publishedAt: "2024-12-24T00:00:10Z" });
    const equal = live({ seq: 5, publishedAt: "2024-12-24T00:00:10Z" });
    expect(shouldReplace(cur, equal)).toBe(false);
    const lesser = live({ seq: 5, publishedAt: "2024-12-24T00:00:05Z" });
    expect(shouldReplace(cur, lesser)).toBe(false);
  });

  it("accepts both-null seq with a greater publishedAt", () => {
    const cur = live({ seq: null, publishedAt: "2024-12-24T00:00:10Z" });
    const next = live({ seq: null, publishedAt: "2024-12-24T00:00:20Z" });
    expect(shouldReplace(cur, next)).toBe(true);
  });

  it("accepts a higher seq", () => {
    const cur = live({ seq: 5 });
    const next = live({ seq: 6 });
    expect(shouldReplace(cur, next)).toBe(true);
  });
});

describe("applyLive", () => {
  it("sets lastSeqChangeAt on the first apply", () => {
    const result = applyLive(initialStore, live({ seq: 1 }), 1000);
    expect(result.applied).toBe(true);
    expect(result.state.lastSeqChangeAt).toBe(1000);
  });

  it("only bumps lastSeqChangeAt when seq changes", () => {
    const state1 = applyLive(initialStore, live({ seq: 1 }), 1000).state;
    const state2 = applyLive(
      state1,
      live({ seq: 1, publishedAt: "2024-12-24T00:00:05Z" }),
      2000,
    ).state;
    expect(state2.lastSeqChangeAt).toBe(1000);
    const state3 = applyLive(state2, live({ seq: 2 }), 3000).state;
    expect(state3.lastSeqChangeAt).toBe(3000);
  });

  it("reports snapshotUrlChanged against the stored snapshotUrl", () => {
    const state1 = applyLive(
      initialStore,
      live({ snapshotUrl: "https://cdn.example/a.json" }),
      1000,
    );
    expect(state1.snapshotUrlChanged).toBe(true);
    // Simulate the loop having stored the snapshot at URL A.
    const withStoredA: SiteStore = { ...state1.state, snapshotUrl: "https://cdn.example/a.json" };
    const state2 = applyLive(withStoredA, live({ seq: 2, snapshotUrl: "https://cdn.example/a.json" }), 2000);
    expect(state2.snapshotUrlChanged).toBe(false);
    const state3 = applyLive(state2.state, live({ seq: 3, snapshotUrl: "https://cdn.example/b.json" }), 3000);
    expect(state3.snapshotUrlChanged).toBe(true);
  });

  it("marks schemaMismatch and applies nothing when schemaVersion is 2", () => {
    const result = applyLive(initialStore, { schemaVersion: 2 }, 1000);
    expect(result.applied).toBe(false);
    expect(result.state.schemaMismatch).toBe(true);
    expect(result.state.live).toBeNull();
  });

  it("ignores non-objects", () => {
    const result = applyLive(initialStore, null, 1000);
    expect(result.applied).toBe(false);
    expect(result.state.schemaMismatch).toBe(true);
  });

  it("returns applied=false when shouldReplace says no", () => {
    const state1 = applyLive(stateWith(live({ seq: 5 })), live({ seq: 4 }), 1000);
    expect(state1.applied).toBe(false);
    expect(state1.state.live?.seq).toBe(5);
  });
});
