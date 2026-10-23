// docs/site.md sections 12 and 22.1. `GET /me`, `PUT /me/seen`, and
// `PUT /me/preferences` carry the bearer; the read resolves with
// `{ subscription, seenUpToId, preferences }`, the seen write sends
// `{ seenUpToId }`, and the preferences write sends the whole object.

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

import { getMe, putSeenUpTo } from "../../../src/api/subscriptions";
import { putPreferences } from "../../../src/api/preferences";

const FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "me.json"), "utf8"),
);
const PREFERENCES_FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "me-preferences.json"), "utf8"),
);
const SEEN_FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "me-seen.json"), "utf8"),
);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api me", () => {
  it("GET /me resolves with the contract's answer and sends the bearer", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await getMe();
    expect(res).toEqual(FIXTURE);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/me");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("PUT /me/seen sends { seenUpToId } and resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(putSeenUpTo(SEEN_FIXTURE.seenUpToId)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/me/seen");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual(SEEN_FIXTURE);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("PUT /me/preferences sends the whole Preferences object and resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(putPreferences(PREFERENCES_FIXTURE)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/me/preferences");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual(PREFERENCES_FIXTURE);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
});
