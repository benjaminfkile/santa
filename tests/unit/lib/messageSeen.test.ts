// docs/site.md sections 7.4 and 7.6. The read mark helper: the storage key,
// reading the stored id, marking a higher id and telling listeners, the
// no-op when the stored id is already that high, and unsubscribing.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  markMessageSeen,
  messageSeenKey,
  readSeenMessageId,
  subscribeMessageSeen,
} from "../../../src/lib/messageSeen";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("messageSeen", () => {
  it("keys the mark by event", () => {
    expect(messageSeenKey(7)).toBe("wmsfo.messages.seen.7");
  });

  it("reads null while nothing or garbage is stored", () => {
    expect(readSeenMessageId(7)).toBeNull();
    window.localStorage.setItem("wmsfo.messages.seen.7", "abc");
    expect(readSeenMessageId(7)).toBeNull();
    window.localStorage.setItem("wmsfo.messages.seen.7", "12");
    expect(readSeenMessageId(7)).toBe(12);
  });

  it("stores a higher id and tells every listener", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeMessageSeen(a);
    const offB = subscribeMessageSeen(b);
    markMessageSeen(7, 12);
    expect(window.localStorage.getItem("wmsfo.messages.seen.7")).toBe("12");
    markMessageSeen(7, 13);
    expect(readSeenMessageId(7)).toBe(13);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
    offA();
    offB();
  });

  it("does nothing when the stored id is already that high", () => {
    window.localStorage.setItem("wmsfo.messages.seen.7", "12");
    const listener = vi.fn();
    const off = subscribeMessageSeen(listener);
    markMessageSeen(7, 12);
    markMessageSeen(7, 11);
    expect(readSeenMessageId(7)).toBe(12);
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it("stops telling a listener once it unsubscribes", () => {
    const listener = vi.fn();
    const off = subscribeMessageSeen(listener);
    off();
    markMessageSeen(7, 12);
    expect(listener).not.toHaveBeenCalled();
    expect(readSeenMessageId(7)).toBe(12);
  });

  it("keeps each event's mark apart", () => {
    markMessageSeen(7, 12);
    expect(readSeenMessageId(6)).toBeNull();
  });
});
