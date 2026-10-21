// docs/site.md sections 12 and 22.1. `GET /me/notifications` and
// `PUT /me/notifications/seen` carry the bearer; the read resolves with
// `{ subscription, seenUpToId }` and the write sends `{ seenUpToId }`.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("../../../src/config/env", () => ({
  env: {
    API_BASE_URL: "https://api.example",
  },
}));

vi.mock("../../../src/auth/session", () => {
  const cls = class SignInRequired extends Error {
    constructor() {
      super("sign_in_required");
      this.name = "SignInRequired";
    }
  };
  return {
    SignInRequired: cls,
    getIdToken: vi.fn(async () => "tok"),
    refreshNow: vi.fn(),
    session: { current: () => null, set: () => {}, clear: () => {}, subscribe: () => () => {}, hasStored: () => false },
  };
});

import { getMyNotifications, putSeenUpTo } from "../../../src/api/subscriptions";

const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "me-notifications.json"), "utf8"),
);
const SEEN_FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "me-notifications-seen.json"), "utf8"),
);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api notifications", () => {
  it("GET /me/notifications resolves with the contract's answer and sends the bearer", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await getMyNotifications();
    expect(res).toEqual(FIXTURE);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/me/notifications");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("PUT /me/notifications/seen sends { seenUpToId } and resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(putSeenUpTo(SEEN_FIXTURE.seenUpToId)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/me/notifications/seen");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual(SEEN_FIXTURE);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
});
