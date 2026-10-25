// docs/site.md 11.4, 19 and 22.1: the API client over the real session
// store. A `403 blocked` clears the session with no refresh and leaves
// the blocked notice for the sign-in page; a `401 unknown_user` clears
// the session after one failed refresh.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/config/env", () => ({
  env: { API_BASE_URL: "https://api.example" },
}));

vi.mock("../../../src/auth/cognito", () => ({
  cognito: { refresh: refreshMock },
}));

import { api } from "../../../src/api/client";
import { surfaceFor } from "../../../src/api/errors";
import { session, SignInRequired, _resetSessionForTests } from "../../../src/auth/session";
import { copy } from "../../../src/copy/copy";

const tokens = {
  idToken: "id",
  accessToken: "a",
  refreshToken: "r",
  email: "person@example",
  sub: "s",
  idExpiresAt: Date.now() + 10 * 60_000,
};

let fetchMock: ReturnType<typeof vi.fn>;

function errorResponse(status: number, code: string) {
  return new Response(JSON.stringify({ code, message: "x", details: null, requestId: "r" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  _resetSessionForTests();
  refreshMock.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  session.set({ ...tokens, idExpiresAt: Date.now() + 10 * 60_000 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client and the session", () => {
  it("a 403 blocked clears the session without a refresh and leaves the blocked notice", async () => {
    const reasons: string[] = [];
    session.subscribe((r) => reasons.push(r));
    fetchMock.mockResolvedValueOnce(errorResponse(403, "blocked"));
    const err = await api("/me", { method: "GET", auth: true }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SignInRequired);
    expect(session.current()).toBeNull();
    expect(session.hasStored()).toBe(false);
    expect(reasons).toEqual(["clear"]);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The sign-in path with the blocked copy.
    const s = surfaceFor(err);
    expect(s.code).toBe("unauthenticated");
    expect(s.message).toBe(copy.auth.blocked);
    expect(session.takeNotice()).toBe("blocked");
    expect(session.takeNotice()).toBeNull();
  });

  it("a 401 unknown_user clears the session after one failed refresh", async () => {
    refreshMock.mockRejectedValueOnce(new Error("refresh refused"));
    fetchMock.mockResolvedValueOnce(errorResponse(401, "unknown_user"));
    const err = await api("/me", { method: "GET", auth: true }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SignInRequired);
    expect((err as SignInRequired).reason).toBe("signIn");
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.current()).toBeNull();
    expect(session.takeNotice()).toBeNull();
    expect(surfaceFor(err).message).not.toBe(copy.auth.blocked);
  });

  it("a sign-in drops a pending blocked notice", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403, "blocked"));
    await api("/me", { method: "GET", auth: true }).catch(() => undefined);
    session.set(tokens);
    expect(session.takeNotice()).toBeNull();
  });
});
