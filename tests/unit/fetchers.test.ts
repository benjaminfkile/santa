// docs/site.md section 22.1 rows for fetchers.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/config/env", () => ({
  env: {
    ENV: "preview",
    CDN_BASE_URL: "https://cdn.example",
    HUB_URL: "wss://hub.example/hub",
    HUB_CHANNEL_PREFIX: "wmsfo-api-dev",
    API_BASE_URL: "https://api.example",
    COGNITO_AUTHORITY: "https://cognito.example/authority",
    COGNITO_DOMAIN: "https://cognito.example",
    COGNITO_CLIENT_ID: "clientid",
    GOOGLE_MAPS_KEY: "key",
    ANALYTICS_ID: "",
    ANALYTICS_ORIGINS: [] as string[],
  },
  LIVE_URL: "https://cdn.example/live/location.json",
  LOCATION_CHANNEL: "wmsfo-api-dev:location",
  IS_PRODUCTION: false,
}));

import {
  fetchLive,
  fetchSnapshot,
  fetchRoute,
  CdnError,
  SchemaVersionError,
  fetchJson,
} from "../../src/store/fetchers";

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[];
let responder: (url: string, init: RequestInit) => Promise<Response> | Response;

beforeEach(() => {
  calls = [];
  responder = () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const initWithSignal = init ?? {};
      calls.push({ url, init: initWithSignal });
      return responder(url, initWithSignal);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchers", () => {
  it("sends credentials: 'omit' and no query string", async () => {
    await fetchLive();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://cdn.example/live/location.json");
    expect(calls[0]?.init.credentials).toBe("omit");
    expect(calls[0]?.url).not.toContain("?");
  });

  it("throws CdnError on non-2xx", async () => {
    responder = () => new Response("nope", { status: 500 });
    await expect(fetchLive()).rejects.toBeInstanceOf(CdnError);
  });

  it("aborts on timeout", async () => {
    vi.useFakeTimers();
    responder = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const p = fetchJson("https://cdn.example/live/location.json", 500);
    const settled = p.catch((err) => err);
    await vi.advanceTimersByTimeAsync(600);
    const err = await settled;
    expect((err as Error).name).toBe("AbortError");
  });

  it("throws SchemaVersionError when snapshot schemaVersion is not 1", async () => {
    responder = () =>
      new Response(JSON.stringify({ schemaVersion: 2, event: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await expect(fetchSnapshot("https://cdn.example/s.json")).rejects.toBeInstanceOf(SchemaVersionError);
  });

  it("throws SchemaVersionError when route schemaVersion is not 1", async () => {
    responder = () =>
      new Response(JSON.stringify({ schemaVersion: 7, points: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await expect(fetchRoute("https://cdn.example/r.json")).rejects.toBeInstanceOf(SchemaVersionError);
  });

  it("returns the parsed object when schemaVersion is 1", async () => {
    responder = () =>
      new Response(JSON.stringify({ schemaVersion: 1, event: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const snap = await fetchSnapshot("https://cdn.example/s.json");
    expect(snap).toEqual({ schemaVersion: 1, event: null });
  });
});
