// docs/site.md section 22.1 api/client row: bearer added only when `auth`;
// Retry-After and details.retryAfterSeconds; 204; SignInRequired when no
// token.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../src/config/env", () => ({
  env: {
    API_BASE_URL: "https://api.example",
  },
}));

vi.mock("../../../src/auth/getIdToken", () => {
  const cls = class SignInRequired extends Error {
    constructor() {
      super("sign_in_required");
      this.name = "SignInRequired";
    }
  };
  return {
    SignInRequired: cls,
    getIdToken: vi.fn(),
  };
});

import { api, ApiRequestError } from "../../../src/api/client";
import { getIdToken, SignInRequired } from "../../../src/auth/getIdToken";

const mockedGetIdToken = getIdToken as unknown as ReturnType<typeof vi.fn>;

type FakeFetch = ReturnType<typeof vi.fn>;
let fetchMock: FakeFetch;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  mockedGetIdToken.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ "content-type": "application/json", ...(init.headers ?? {}) });
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

describe("api client", () => {
  it("adds the bearer only when auth is true", async () => {
    mockedGetIdToken.mockResolvedValueOnce("tok");
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api("/me", { method: "GET", auth: true });
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.example/me");
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api("/contact", { method: "POST", auth: false, body: { name: "" } });
    const call2 = fetchMock.mock.calls[1];
    const headers2 = call2[1].headers as Record<string, string>;
    expect(headers2.Authorization).toBeUndefined();
    expect(headers2["Content-Type"]).toBe("application/json");
    // credentials omit is passed through
    expect(call2[1].credentials).toBe("omit");
  });

  it("returns undefined on a 204", async () => {
    mockedGetIdToken.mockResolvedValueOnce("tok");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await api<void>("/me/subscriptions/1", { method: "DELETE", auth: true });
    expect(res).toBeUndefined();
  });

  it("reads retry-after from the Retry-After header on a 429", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "rate_limited", message: "x", details: null, requestId: "r" }, {
        status: 429,
        headers: { "Retry-After": "42" },
      }),
    );
    await expect(api("/contact", { method: "POST", auth: false, body: {} })).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 42,
    });
  });

  it("falls back to body.details.retryAfterSeconds when Retry-After is absent", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: "rate_limited", message: "x", details: { retryAfterSeconds: 15 }, requestId: "r" },
        { status: 429 },
      ),
    );
    try {
      await api("/contact", { method: "POST", auth: false, body: {} });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError);
      expect((e as ApiRequestError).retryAfterSeconds).toBe(15);
    }
  });

  it("wraps error bodies in ApiRequestError and never leaks the message text", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: "cookie_limit_reached", message: "server-message-leak", details: null, requestId: "r" },
        { status: 409 },
      ),
    );
    try {
      await api("/cookies", { method: "POST", auth: false, body: {} });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError);
      const err = e as ApiRequestError;
      expect(err.code).toBe("cookie_limit_reached");
      expect(err.body?.message).toBe("server-message-leak");
      // Message on the Error is the code, not the server message.
      expect(err.message).toBe("cookie_limit_reached");
    }
  });

  it("propagates SignInRequired from getIdToken", async () => {
    mockedGetIdToken.mockRejectedValueOnce(new SignInRequired());
    await expect(api("/me", { method: "GET", auth: true })).rejects.toBeInstanceOf(SignInRequired);
    // fetch was never called since the token throw came first.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
