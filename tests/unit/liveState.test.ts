// docs/site.md section 22.1 rows for liveState.

import { describe, it, expect } from "vitest";
import { selectLiveState, selectTimeReady } from "../../src/store/liveState";
import { initialStore } from "../../src/store/types";
import type { SiteStore } from "../../src/store/types";

function stateWithSeq(seq: number | null, lastSeqChangeAt: number | null): SiteStore {
  return {
    ...initialStore,
    live: {
      schemaVersion: 1,
      eventId: 1,
      eventStatusId: 3,
      pollIntervalMs: 5000,
      snapshotUrl: "",
      cookieTally: {},
      seq,
      lat: 0,
      lng: 0,
      speedMps: null,
      altitudeM: null,
      headingDeg: null,
      accuracyM: null,
      recordedAt: null,
      receivedAt: null,
      publishedAt: "2024-12-24T00:00:00Z",
    },
    lastSeqChangeAt,
  };
}

describe("selectLiveState", () => {
  it("returns waitingForFix while seq is null", () => {
    const s = stateWithSeq(null, null);
    expect(selectLiveState(s, 10_000)).toBe("waitingForFix");
  });

  it("tracks at 29 s since the last seq change", () => {
    const s = stateWithSeq(5, 1000);
    expect(selectLiveState(s, 1000 + 29_000)).toBe("tracking");
  });

  it("reports signalLost at 31 s since the last seq change", () => {
    const s = stateWithSeq(5, 1000);
    expect(selectLiveState(s, 1000 + 31_000)).toBe("signalLost");
  });
});

describe("selectTimeReady", () => {
  it("is false when the snapshot event.statusId differs from live.eventStatusId", () => {
    const s: SiteStore = { ...stateWithSeq(1, 0), snapshot: { event: { statusId: 2 } } };
    expect(selectTimeReady(s)).toBe(false);
  });

  it("is true when the snapshot event.statusId matches live.eventStatusId", () => {
    const s: SiteStore = { ...stateWithSeq(1, 0), snapshot: { event: { statusId: 3 } } };
    expect(selectTimeReady(s)).toBe(true);
  });

  it("is true when both are null", () => {
    const s: SiteStore = { ...initialStore, snapshot: { event: null } };
    expect(selectTimeReady(s)).toBe(true);
  });
});
