import { describe, expect, it } from "vitest";
import { alertKindLabel } from "../../../src/alerts/alertKind";

describe("alertKindLabel", () => {
  it("labels an event_message alert as an update", () => {
    expect(alertKindLabel("event_message")).toBe("update");
  });

  it("labels an event_status alert as a status", () => {
    expect(alertKindLabel("event_status")).toBe("status");
  });

  it("labels a missing kind as a status", () => {
    expect(alertKindLabel(undefined)).toBe("status");
    expect(alertKindLabel(null)).toBe("status");
  });
});
