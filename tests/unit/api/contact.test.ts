// docs/site.md sections 12 and 14. `POST /contact` answers `202 { receivedAt }`
// and the wrapper resolves with that body, unauthenticated.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
    getIdToken: vi.fn(),
    refreshNow: vi.fn(),
    session: { current: () => null, set: () => {}, clear: () => {}, subscribe: () => () => {}, hasStored: () => false },
  };
});

import { submitContact } from "../../../src/api/contact";
import { getIdToken } from "../../../src/auth/session";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api/contact", () => {
  it("a 202 resolves with receivedAt and sends no bearer", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ receivedAt: "2026-12-24T00:00:00Z" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await submitContact({ name: "Bob", email: "b@x.co", message: "hi" });
    expect(res).toEqual({ receivedAt: "2026-12-24T00:00:00Z" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/contact");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(getIdToken).not.toHaveBeenCalled();
  });
});
