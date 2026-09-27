// docs/site.md section 7.8. The preview session follows the draft: it polls
// every 2 s while visible and not while hidden, sends If-None-Match with
// the last ETag, ignores a 304 and an identical 200, applies a changed 200
// in place, stops on a 404 with the expired banner, and marks the banner Reconnecting after five
// failures in a row until the next success.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Shell } from "../../../src/app/Shell";
import { AuthProvider } from "../../../src/auth/AuthProvider";
import { PreviewPage } from "../../../src/pages/PreviewPage";
import { HomePage } from "../../../src/pages/HomePage";
import { SlugPage } from "../../../src/pages/SlugPage";
import { PreviewSession } from "../../../src/app/PreviewSession";
import { endPreviewSession } from "../../../src/pages/previewSession";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { ContentDocument, LiveObject } from "../../../src/contracts";

function makeLive(): LiveObject {
  return {
    schemaVersion: 1, eventId: 1, eventStatusId: 1, pollIntervalMs: 5000,
    snapshotUrl: null, cookieTally: {}, seq: null, lat: null, lng: null, speedMps: null,
    altitudeM: null, headingDeg: null, accuracyM: null, recordedAt: null, receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
  };
}

function makeContent(title: string): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO",
      tagline: null,
      homeNavLabel: "Track",
      logo: null,
      favicon: null,
      theme: { snowDefault: false, lightsDefault: false },
      navExtraLinks: [],
      footerLinks: [],
      footerText: null,
      contactEmail: null,
      donateUrl: null,
      analyticsEnabled: false,
    },
    pages: [
      {
        id: 1, slug: "planned", title: "Planned", navLabel: null, navPosition: 0, role: "planned",
        sections: [{ id: 1, kind: "hero", presentation: { width: "wide", align: "center", background: { kind: "none" }, spacing: "normal", iconBefore: null, iconAfter: null, anchor: null }, data: { title, tagline: null, icon: null, links: [], height: "tall" }, items: [] }],
      },
    ],
  };
}

function body(title: string): string {
  return JSON.stringify({ content: makeContent(title), media: {}, icons: {} });
}

function ok(title: string, etag: string | null = null): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (etag !== null) headers.ETag = etag;
  return new Response(body(title), { status: 200, headers });
}

function status(code: number): Response {
  return new Response(code === 304 ? null : "{}", {
    status: code,
    headers: { "content-type": "application/json" },
  });
}

const token = "wpv_" + "A".repeat(40);
let visibility: DocumentVisibilityState = "visible";
const fetchMock = vi.fn<typeof fetch>();

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

function sentEtag(call: number): string | null {
  const init = fetchMock.mock.calls[call]?.[1];
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers["If-None-Match"] ?? null;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderPreview() {
  return render(
    <MemoryRouter initialEntries={[`/preview?token=${token}&page=planned`]}>
      <AuthProvider>
        <PreviewSession />
        <Shell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/:slug" element={<SlugPage />} />
          </Routes>
        </Shell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  // 2024-12-24T19:04:05Z is 12:04:05 in America/Denver.
  vi.setSystemTime(new Date("2024-12-24T19:04:05Z"));
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  act(() => store.setState({ ...initialStore, live: makeLive() }));
});

afterEach(() => {
  cleanup();
  act(() => endPreviewSession());
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  act(() => store.setState({ ...initialStore }));
});

describe("preview session live polling", () => {
  it("polls every 2 s while visible and not while hidden, and at once on return", async () => {
    fetchMock.mockImplementation(async () => status(304));
    fetchMock.mockResolvedValueOnce(ok("One", '"v1"'));
    renderPreview();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("omit");
    await flush(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flush(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    act(() => setVisibility("hidden"));
    await flush(10000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    act(() => setVisibility("visible"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await flush(2000);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("sends If-None-Match with the last ETag, and none before one is known", async () => {
    fetchMock
      .mockResolvedValueOnce(ok("One", '"v1"'))
      .mockResolvedValueOnce(ok("Two", '"v2"'))
      .mockResolvedValueOnce(ok("Two"))
      .mockImplementation(async () => status(304));
    renderPreview();
    await flush();
    await flush(2000);
    await flush(2000);
    await flush(2000);
    expect(sentEtag(0)).toBeNull();
    expect(sentEtag(1)).toBe('"v1"');
    expect(sentEtag(2)).toBe('"v2"');
    expect(sentEtag(3)).toBeNull();
  });

  it("a 304 and an identical 200 leave the store alone; a changed 200 updates in place", async () => {
    fetchMock
      .mockResolvedValueOnce(ok("One", '"v1"'))
      .mockResolvedValueOnce(status(304))
      .mockResolvedValueOnce(ok("One", '"v1b"'))
      .mockResolvedValueOnce(ok("Two", '"v2"'))
      .mockImplementation(async () => status(304));
    const { container, getByTestId } = renderPreview();
    await flush();
    const first = store.getState().preview;
    expect(first).not.toBeNull();
    const main = container.querySelector("main[data-page-slug]");
    expect(main?.textContent).toContain("One");
    expect(getByTestId("preview-live").textContent).toBe("Live, last change 12:04:05");

    await flush(2000);
    expect(store.getState().preview).toBe(first);
    await flush(2000);
    expect(store.getState().preview).toBe(first);
    expect(getByTestId("preview-live").textContent).toBe("Live, last change 12:04:05");

    await flush(2000);
    expect(store.getState().preview).not.toBe(first);
    const after = container.querySelector("main[data-page-slug]");
    expect(after).toBe(main);
    expect(after?.textContent).toContain("Two");
    expect(getByTestId("preview-live").textContent).toBe("Live, last change 12:04:11");
  });

  it("a 404 stops polling and shows the expired banner", async () => {
    fetchMock
      .mockResolvedValueOnce(ok("One", '"v1"'))
      .mockResolvedValueOnce(status(404))
      .mockImplementation(async () => ok("Two"));
    const { container } = renderPreview();
    await flush();
    await flush(2000);
    expect(container.textContent).toContain("This preview link has expired");
    await flush(10000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await flush(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the last render through failures, shows Reconnecting after five, clears on success", async () => {
    fetchMock.mockResolvedValueOnce(ok("One", '"v1"'));
    for (let i = 0; i < 5; i++) fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockImplementation(async () => status(304));
    const { container, queryByTestId } = renderPreview();
    await flush();
    for (let i = 0; i < 4; i++) await flush(2000);
    expect(container.querySelector("main[data-page-slug]")?.textContent).toContain("One");
    expect(queryByTestId("preview-reconnecting")).toBeNull();
    await flush(2000);
    expect(queryByTestId("preview-reconnecting")?.textContent).toBe("Reconnecting");
    expect(container.querySelector("main[data-page-slug]")?.textContent).toContain("One");
    await flush(2000);
    expect(queryByTestId("preview-reconnecting")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
