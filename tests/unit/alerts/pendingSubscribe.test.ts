// docs/site.md sections 7.7, 11.2 and 22.1. The sign-up alerts intent:
// stored as an address only, read as none for any other shape, and
// completed after a sign-in through `POST /me/subscriptions` with each
// response branch against a mocked API client.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiRequestError } from "../../../src/api/client";
import { SUBSCRIPTION_FLAG_KEY, readFlag } from "../../../src/alerts/subscriptionFlag";
import {
  PENDING_SUBSCRIBE_KEY,
  clearPendingSubscribe,
  completePendingSubscribe,
  readPendingSubscribe,
  setPendingSubscribe,
} from "../../../src/alerts/pendingSubscribe";

vi.mock("../../../src/api/subscriptions", () => ({
  createSubscription: vi.fn(),
  getMe: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const EMAIL = "a@e.com";

function row(id: number, verifiedAt: string | null) {
  return { id, channel: "email", address: EMAIL, verifiedAt, unsubscribedAt: null, createdAt: "" } as never;
}

function apiError(status: number, code: string) {
  return new ApiRequestError(status, { code, message: "x", details: null, requestId: "r" } as never, null);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(subsApi.createSubscription).mockReset();
  vi.mocked(subsApi.getMe).mockReset();
});

describe("the stored intent", () => {
  it("holds the lowercased address only", () => {
    setPendingSubscribe(" A@E.com ");
    expect(window.localStorage.getItem(PENDING_SUBSCRIBE_KEY)).toBe(EMAIL);
    expect(readPendingSubscribe()).toBe(EMAIL);
    clearPendingSubscribe();
    expect(window.localStorage.getItem(PENDING_SUBSCRIBE_KEY)).toBeNull();
    expect(readPendingSubscribe()).toBeNull();
  });

  it("reads a value of another shape as none", () => {
    for (const v of ['{"address":"a@e.com"}', "not an address", "", "a@e.com hunter2"]) {
      window.localStorage.setItem(PENDING_SUBSCRIBE_KEY, v);
      expect(readPendingSubscribe()).toBeNull();
    }
  });
});

describe("completePendingSubscribe", () => {
  it("makes no call without an intent", async () => {
    await completePendingSubscribe(EMAIL);
    expect(subsApi.createSubscription).not.toHaveBeenCalled();
  });

  it("makes no call and keeps the intent when it names another address", async () => {
    setPendingSubscribe("b@e.com");
    await completePendingSubscribe(EMAIL);
    expect(subsApi.createSubscription).not.toHaveBeenCalled();
    expect(readPendingSubscribe()).toBe("b@e.com");
  });

  it("201 with verifiedAt writes an active flag and clears the intent", async () => {
    setPendingSubscribe(EMAIL);
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce(row(4, "2026-10-22T00:00:00Z"));
    await completePendingSubscribe(EMAIL);
    expect(subsApi.createSubscription).toHaveBeenCalledWith(EMAIL);
    expect(readFlag()).toEqual({ account: EMAIL, id: 4, address: EMAIL, state: "active" });
    expect(readPendingSubscribe()).toBeNull();
  });

  it("200 without verifiedAt writes a pending flag and clears the intent", async () => {
    setPendingSubscribe(EMAIL);
    vi.mocked(subsApi.createSubscription).mockResolvedValueOnce(row(6, null));
    await completePendingSubscribe(EMAIL);
    expect(readFlag()?.state).toBe("pending");
    expect(readPendingSubscribe()).toBeNull();
  });

  it("409 already_subscribed adopts the account's row through one GET and clears the intent", async () => {
    setPendingSubscribe(EMAIL);
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "already_subscribed"));
    vi.mocked(subsApi.getMe).mockResolvedValueOnce({
      subscription: row(8, "2026-10-01T00:00:00Z"),
      seenUpToId: null,
    } as never);
    await completePendingSubscribe(EMAIL);
    expect(subsApi.getMe).toHaveBeenCalledTimes(1);
    expect(readFlag()).toEqual({ account: EMAIL, id: 8, address: EMAIL, state: "active" });
    expect(readPendingSubscribe()).toBeNull();
  });

  it("409 already_subscribed with a failing GET writes no flag, clears the intent, and does not throw", async () => {
    setPendingSubscribe(EMAIL);
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(409, "already_subscribed"));
    vi.mocked(subsApi.getMe).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(completePendingSubscribe(EMAIL)).resolves.toBeUndefined();
    expect(window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY)).toBeNull();
    expect(readPendingSubscribe()).toBeNull();
  });

  for (const [status, code] of [
    [409, "address_taken"],
    [409, "subscriptions_closed"],
    [400, "validation_failed"],
  ] as const) {
    it(`${status} ${code} clears the intent and writes no flag`, async () => {
      setPendingSubscribe(EMAIL);
      vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(apiError(status, code));
      await expect(completePendingSubscribe(EMAIL)).resolves.toBeUndefined();
      expect(subsApi.getMe).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY)).toBeNull();
      expect(readPendingSubscribe()).toBeNull();
    });
  }

  it("a network failure keeps the intent for the next sign-in and does not throw", async () => {
    setPendingSubscribe(EMAIL);
    vi.mocked(subsApi.createSubscription).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(completePendingSubscribe(EMAIL)).resolves.toBeUndefined();
    expect(window.localStorage.getItem(SUBSCRIPTION_FLAG_KEY)).toBeNull();
    expect(readPendingSubscribe()).toBe(EMAIL);
  });
});
