// docs/site.md sections 12 and 22.1. The subscription wrappers carry no
// `GET /me` and no alerts fetch: the alerts ride in the snapshot, and the
// account email comes from the id token through `useAuth()`.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as subsApi from "../../../src/api/subscriptions";

describe("api/subscriptions", () => {
  it("exports no getMe and no listAlerts", () => {
    const names = Object.keys(subsApi);
    expect(names).not.toContain("getMe");
    expect(names).not.toContain("listAlerts");
    expect(names.sort()).toEqual([
      "createSubscription",
      "deleteSubscription",
      "listMySubscriptions",
      "resendVerification",
      "unsubscribe",
      "verifySubscription",
    ]);
  });

  it("names neither /me alone nor /me/alerts", () => {
    const src = readFileSync(resolve(__dirname, "..", "..", "..", "src", "api", "subscriptions.ts"), "utf8");
    expect(src).not.toMatch(/"\/me"/);
    expect(src).not.toMatch(/\/me\/alerts/);
  });
});
