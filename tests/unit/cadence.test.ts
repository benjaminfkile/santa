// docs/site.md section 22.1 rows for cadence.

import { describe, it, expect } from "vitest";
import { isHubQuiet, pollCadenceMs } from "../../src/store/cadence";
import { initialStore } from "../../src/store/types";
import type { SiteStore, HubStatus } from "../../src/store/types";

function stateWith({
  statusId,
  hub,
  lastHubLocationAt,
  pollIntervalMs = 5000,
}: {
  statusId: number | null;
  hub: HubStatus;
  lastHubLocationAt: number | null;
  pollIntervalMs?: number;
}): SiteStore {
  return {
    ...initialStore,
    hub,
    lastHubLocationAt,
    live: {
      schemaVersion: 1,
      eventId: 1,
      eventStatusId: statusId,
      pollIntervalMs,
      snapshotUrl: "",
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
    },
  };
}

describe("isHubQuiet", () => {
  it("is false outside status 3", () => {
    for (const statusId of [null, 1, 2, 4, 5]) {
      const s = stateWith({ statusId, hub: "connected", lastHubLocationAt: 0 });
      expect(isHubQuiet(s, 999_999)).toBe(false);
    }
  });

  it("is true when hub is not connected in status 3", () => {
    const s = stateWith({ statusId: 3, hub: "reconnecting", lastHubLocationAt: 0 });
    expect(isHubQuiet(s, 1000)).toBe(true);
  });

  it("is true when lastHubLocationAt is null in status 3", () => {
    const s = stateWith({ statusId: 3, hub: "connected", lastHubLocationAt: null });
    expect(isHubQuiet(s, 1000)).toBe(true);
  });

  it("is true when it has been more than 2 * pollIntervalMs since the last hub event", () => {
    const s = stateWith({ statusId: 3, hub: "connected", lastHubLocationAt: 1000, pollIntervalMs: 5000 });
    expect(isHubQuiet(s, 1000 + 10_001)).toBe(true);
    expect(isHubQuiet(s, 1000 + 9000)).toBe(false);
  });
});

describe("pollCadenceMs", () => {
  it("returns the base interval when not quiet", () => {
    const s = stateWith({ statusId: 2, hub: "connected", lastHubLocationAt: 0, pollIntervalMs: 4000 });
    expect(pollCadenceMs(s, 1000)).toBe(4000);
  });

  it("returns max(1000, base / 2) when quiet", () => {
    const s = stateWith({ statusId: 3, hub: "disconnected", lastHubLocationAt: 0, pollIntervalMs: 4000 });
    expect(pollCadenceMs(s, 1000)).toBe(2000);
  });

  it("floors quiet cadence at 1000 ms", () => {
    const s = stateWith({ statusId: 3, hub: "disconnected", lastHubLocationAt: 0, pollIntervalMs: 1500 });
    expect(pollCadenceMs(s, 1000)).toBe(1000);
  });

  it("falls back to 5000 ms base when the live object is missing pollIntervalMs", () => {
    const s: SiteStore = { ...initialStore };
    expect(pollCadenceMs(s, 1000)).toBe(5000);
  });
});
