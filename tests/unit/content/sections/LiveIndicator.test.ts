import { describe, it, expect } from "vitest";
import {
  transportState,
  STALE_AFTER_MS,
} from "../../../../src/content/sections/Map/LiveIndicator";

// site.md 5.2: the pill reads the transport only. A beacon that fixes slower
// than the poll window never moves the label; the hub state and the last
// successful poll do.
describe("LiveIndicator transport state", () => {
  const poll = 5000;

  it("is live whenever the hub is connected, however old the last fix or poll is", () => {
    expect(transportState("connected", null, poll, 100_000)).toBe("live");
    expect(transportState("connected", 0, poll, 100_000)).toBe("live");
  });

  it("is polling while the hub is down and a poll landed within two intervals", () => {
    expect(transportState("reconnecting", 95_000, poll, 100_000)).toBe("polling");
    expect(transportState("disconnected", 90_000, poll, 100_000)).toBe("polling");
    expect(transportState("connecting", 100_000, poll, 100_000)).toBe("polling");
  });

  it("is offline when the hub is down and no poll has landed for two intervals", () => {
    expect(transportState("reconnecting", 89_999, poll, 100_000)).toBe("offline");
    expect(transportState("disconnected", null, poll, 100_000)).toBe("offline");
  });

  it("uses the event's poll interval for the window", () => {
    expect(transportState("reconnecting", 97_999, 1000, 100_000)).toBe("offline");
    expect(transportState("reconnecting", 98_000, 1000, 100_000)).toBe("polling");
  });

  it("shares the marker's signal-lost threshold for the stale counter", () => {
    expect(STALE_AFTER_MS).toBe(30000);
  });
});
