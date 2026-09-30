// docs/site.md section 7.8. The tab's preview session: a preview link
// starts it and redirects to the page's normal path; other paths keep
// rendering from the draft while polling continues; a reload resumes it
// from sessionStorage; Exit ends it; a 404 ends it with the expired
// banner; without a session nothing changes.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "../../../src/app/Shell";
import { PreviewSession } from "../../../src/app/PreviewSession";
import { AuthProvider } from "../../../src/auth/AuthProvider";
import { HomePage } from "../../../src/pages/HomePage";
import { SlugPage } from "../../../src/pages/SlugPage";
import { PreviewPage } from "../../../src/pages/PreviewPage";
import {
  PREVIEW_SESSION_KEY,
  endPreviewSession,
  getPreviewSession,
} from "../../../src/pages/previewSession";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import { THEME_KEY } from "../../../src/content/theme/colorScheme";
import type { ContentDocument, LiveObject, Snapshot } from "../../../src/contracts";

const presentation = {
  width: "wide", align: "center", background: { kind: "none" }, spacing: "normal",
  iconBefore: null, iconAfter: null, anchor: null,
} as const;

function makeContent(label: string): ContentDocument {
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
      footerText: `${label} footer`,
      contactEmail: null,
      donateUrl: null,
      analyticsEnabled: false,
    },
    pages: [
      {
        id: 1, slug: "planned", title: "Planned", navLabel: null, icon: null, navPosition: 0, role: "planned",
        sections: [{ id: 1, kind: "hero", presentation, data: { title: `${label} home`, tagline: null, icon: null, links: [], height: "tall" }, items: [] }],
      },
      {
        id: 2, slug: "about", title: "About", navLabel: `${label} About`, icon: null, navPosition: 1, role: "none",
        sections: [{ id: 2, kind: "hero", presentation, data: { title: `${label} about`, tagline: null, icon: null, links: [], height: "tall" }, items: [] }],
      },
    ],
  };
}

function makeLive(): LiveObject {
  return {
    schemaVersion: 1, eventId: 1, eventStatusId: 1, pollIntervalMs: 5000,
    snapshotUrl: null, cookieTally: {}, seq: null, lat: null, lng: null, speedMps: null,
    altitudeM: null, headingDeg: null, accuracyM: null, recordedAt: null, receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
  };
}

function ok(label: string, etag: string | null = null): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (etag !== null) headers.ETag = etag;
  const body = JSON.stringify({ content: makeContent(label), media: {}, icons: {} });
  return new Response(body, { status: 200, headers });
}

function status(code: number): Response {
  return new Response(code === 304 ? null : "{}", {
    status: code,
    headers: { "content-type": "application/json" },
  });
}

const token = "wpv_" + "A".repeat(40);
const fetchMock = vi.fn<typeof fetch>();

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderApp(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <PreviewSession />
        <Shell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/:slug" element={<SlugPage />} />
          </Routes>
          <Where />
          <Link to="/about" data-testid="to-about">About</Link>
          <Link to="/" data-testid="to-home">Home</Link>
        </Shell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mainText(container: HTMLElement): string {
  return container.querySelector("main[data-page-slug]")?.textContent ?? "";
}

function previewCalls(): number {
  return fetchMock.mock.calls.filter(([u]) => String(u).includes("/preview/document")).length;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
  window.localStorage.setItem(THEME_KEY, "light");
  document.documentElement.setAttribute("data-theme", "light");
  act(() =>
    store.setState({
      ...initialStore,
      live: makeLive(),
      snapshot: { content: makeContent("Published"), media: {}, icons: {} } as unknown as Snapshot,
    }),
  );
});

afterEach(() => {
  cleanup();
  act(() => endPreviewSession());
  window.sessionStorage.clear();
  window.localStorage.removeItem(THEME_KEY);
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
  vi.useRealTimers();
  act(() => store.setState({ ...initialStore }));
});

describe("preview session", () => {
  it("/preview with a token starts a session and redirects to the page path", async () => {
    fetchMock.mockImplementation(async () => status(304));
    fetchMock.mockResolvedValueOnce(ok("Draft", '"v1"'));
    const { container, getByTestId } = renderApp(`/preview?token=${token}&page=about&theme=dark`);
    await flush();
    expect(getByTestId("where").textContent).toBe("/about");
    expect(mainText(container)).toContain("Draft about");
    expect(getPreviewSession()).toEqual({ token, theme: "dark", expired: false });
    expect(JSON.parse(window.sessionStorage.getItem(PREVIEW_SESSION_KEY) ?? "null")).toEqual({
      token,
      theme: "dark",
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull();
    expect(getByTestId("preview-banner").textContent).toContain("Preview");
  });

  it("a role page opens at its own slug and no page opens at /", async () => {
    fetchMock.mockImplementation(async () => status(304));
    fetchMock.mockResolvedValueOnce(ok("Draft"));
    const { container, getByTestId } = renderApp(`/preview?token=${token}&page=planned`);
    await flush();
    expect(getByTestId("where").textContent).toBe("/planned");
    expect(mainText(container)).toContain("Draft home");
  });

  it("another path still renders from store.preview, the menu and footer too, and polling continues", async () => {
    fetchMock
      .mockResolvedValueOnce(ok("Draft", '"v1"'))
      .mockImplementation(async () => status(304));
    const { container, getByTestId } = renderApp(`/preview?token=${token}`);
    await flush();
    expect(getByTestId("where").textContent).toBe("/");
    expect(mainText(container)).toContain("Draft home");
    expect(getByTestId("site-footer").textContent).toContain("Draft footer");
    expect(container.textContent).toContain("Draft About");
    expect(container.textContent).not.toContain("Published About");
    const before = previewCalls();

    fireEvent.click(getByTestId("to-about"));
    await flush();
    expect(getByTestId("where").textContent).toBe("/about");
    expect(mainText(container)).toContain("Draft about");
    expect(getByTestId("preview-banner")).toBeTruthy();

    fetchMock.mockResolvedValueOnce(ok("Edited", '"v2"'));
    await flush(2000);
    expect(previewCalls()).toBe(before + 1);
    expect(mainText(container)).toContain("Edited about");
    expect(getByTestId("site-footer").textContent).toContain("Edited footer");
  });

  it("a reload with the sessionStorage key resumes the session", async () => {
    window.sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify({ token, theme: "dark" }));
    fetchMock.mockImplementation(async () => status(304));
    fetchMock.mockResolvedValueOnce(ok("Draft", '"v1"'));
    const { container, getByTestId } = renderApp("/about");
    await flush();
    expect(fetchMock.mock.calls[0]?.[0]).toContain(`token=${token}`);
    expect(getByTestId("where").textContent).toBe("/about");
    expect(mainText(container)).toContain("Draft about");
    expect(getByTestId("preview-banner")).toBeTruthy();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await flush(2000);
    expect(previewCalls()).toBe(2);
  });

  it("Exit clears the session and stays on the path, now showing the published site", async () => {
    fetchMock.mockImplementation(async () => status(304));
    fetchMock.mockResolvedValueOnce(ok("Draft", '"v1"'));
    const { container, getByTestId, queryByTestId } = renderApp(
      `/preview?token=${token}&page=about&theme=dark`,
    );
    await flush();
    expect(mainText(container)).toContain("Draft about");

    fireEvent.click(getByTestId("preview-exit"));
    await flush();
    expect(getByTestId("where").textContent).toBe("/about");
    expect(mainText(container)).toContain("Published about");
    expect(getPreviewSession()).toBeNull();
    expect(store.getState().preview).toBeNull();
    expect(window.sessionStorage.getItem(PREVIEW_SESSION_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(queryByTestId("preview-banner")).toBeNull();
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).toBeNull();
    const calls = previewCalls();
    await flush(10000);
    expect(previewCalls()).toBe(calls);
  });

  it("a 404 ends the session with the expired banner and falls back to the published site", async () => {
    fetchMock
      .mockResolvedValueOnce(ok("Draft", '"v1"'))
      .mockResolvedValueOnce(status(404))
      .mockImplementation(async () => ok("Later"));
    const { container, getByTestId, queryByTestId } = renderApp(`/preview?token=${token}&page=about`);
    await flush();
    expect(mainText(container)).toContain("Draft about");
    await flush(2000);
    expect(getByTestId("preview-expired").textContent).toBe("This preview link has expired");
    expect(getByTestId("preview-exit")).toBeTruthy();
    expect(mainText(container)).toContain("Published about");
    expect(store.getState().preview).toBeNull();
    expect(window.sessionStorage.getItem(PREVIEW_SESSION_KEY)).toBeNull();
    await flush(10000);
    expect(previewCalls()).toBe(2);

    fireEvent.click(getByTestId("preview-exit"));
    await flush();
    expect(queryByTestId("preview-banner")).toBeNull();
    expect(getByTestId("where").textContent).toBe("/about");
  });

  it("an expired link lands on / with the expired banner", async () => {
    fetchMock.mockResolvedValueOnce(status(404));
    const { container, getByTestId } = renderApp(`/preview?token=${token}&page=about`);
    await flush();
    expect(getByTestId("where").textContent).toBe("/");
    expect(getByTestId("preview-expired")).toBeTruthy();
    expect(mainText(container)).toContain("Published home");
  });

  it("without a session nothing changes", async () => {
    fetchMock.mockImplementation(async () => status(304));
    const { container, getByTestId, queryByTestId } = renderApp("/about");
    await flush();
    await flush(10000);
    expect(previewCalls()).toBe(0);
    expect(mainText(container)).toContain("Published about");
    expect(queryByTestId("preview-banner")).toBeNull();
    expect(getPreviewSession()).toBeNull();
    expect(document.querySelector('meta[name="robots"][content="noindex"]')).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(getByTestId("where").textContent).toBe("/about");
  });
});
