// docs/site.md sections 12 and 22.1. The subscription wrappers carry no
// alerts fetch: the alerts ride in the snapshot, and the account email comes
// from the id token through `useAuth()`. The person's state is the one
// `GET /me`; the old `/me/notifications` paths are gone.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as subsApi from "../../../src/api/subscriptions";

describe("api/subscriptions", () => {
  it("exports getMe, no listAlerts, and no listMySubscriptions", () => {
    const names = Object.keys(subsApi);
    expect(names).not.toContain("getMyNotifications");
    expect(names).not.toContain("listAlerts");
    expect(names).not.toContain("listMySubscriptions");
    expect(names.sort()).toEqual([
      "createSubscription",
      "deleteSubscription",
      "getMe",
      "putSeenUpTo",
      "resendVerification",
      "unsubscribe",
      "verifySubscription",
    ]);
  });

  it("names neither /me/alerts nor /me/notifications", () => {
    const src = readFileSync(resolve(__dirname, "..", "..", "..", "src", "api", "subscriptions.ts"), "utf8");
    expect(src).not.toMatch(/\/me\/alerts/);
    expect(src).not.toMatch(/\/me\/notifications/);
  });
});
