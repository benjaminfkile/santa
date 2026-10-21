// docs/site.md sections 7.7 and 22.1. The read marker: `read` returns the
// stored number (or null), `raise` writes only upward and says whether it
// advanced, and `subscribe` tells listeners of each change.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ALERTS_OLD_SEEN_KEY,
  ALERTS_SEEN_KEY,
  seenMarker,
} from "../../../src/alerts/seenMarker";

beforeEach(() => {
  window.localStorage.clear();
});

describe("seenMarker", () => {
  it("keeps the key wmsfo.alerts.seenId", () => {
    expect(ALERTS_SEEN_KEY).toBe("wmsfo.alerts.seenId");
  });

  it("reads null when absent or unparsable, else the stored number", () => {
    expect(seenMarker.read()).toBeNull();
    window.localStorage.setItem(ALERTS_SEEN_KEY, "abc");
    expect(seenMarker.read()).toBeNull();
    window.localStorage.setItem(ALERTS_SEEN_KEY, "42");
    expect(seenMarker.read()).toBe(42);
  });

  it("removes the old key on read", () => {
    window.localStorage.setItem(ALERTS_OLD_SEEN_KEY, "[1,2]");
    seenMarker.read();
    expect(window.localStorage.getItem(ALERTS_OLD_SEEN_KEY)).toBeNull();
  });

  it("raises only upward and says whether it advanced", () => {
    expect(seenMarker.raise(10)).toBe(true);
    expect(seenMarker.read()).toBe(10);
    expect(seenMarker.raise(10)).toBe(false);
    expect(seenMarker.raise(4)).toBe(false);
    expect(seenMarker.read()).toBe(10);
    expect(seenMarker.raise(11)).toBe(true);
    expect(window.localStorage.getItem(ALERTS_SEEN_KEY)).toBe("11");
  });

  it("tells subscribers of each advance and nothing else, until unsubscribed", () => {
    const listener = vi.fn();
    const off = seenMarker.subscribe(listener);
    seenMarker.raise(3);
    seenMarker.raise(2);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    seenMarker.raise(9);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
