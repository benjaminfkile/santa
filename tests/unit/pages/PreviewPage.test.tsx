// docs/site.md section 22.1. PreviewPage: fetches with the token, stores
// the bundle, renders the named page, shows the banner, clears on
// navigation, handles 404.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { LiveObject, ContentDocument } from "../../../src/contracts";
import { PreviewPage } from "../../../src/pages/PreviewPage";
import { ApiRequestError } from "../../../src/api/client";
import { THEME_KEY } from "../../../src/content/theme/colorScheme";

vi.mock("../../../src/api/preview", () => ({
  fetchPreviewDocument: vi.fn(),
}));

import * as previewApi from "../../../src/api/preview";

function makeContent(): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO",
      tagline: null,
      homeNavLabel: "Track",
      logo: null,
      favicon: null,
      theme: { snowDefault: true, lightsDefault: false },
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
        sections: [{ id: 1, kind: "hero", presentation: { width: "wide", align: "center", background: { kind: "none" }, spacing: "normal", iconBefore: null, iconAfter: null, anchor: null }, data: { title: "Planned page", tagline: null, icon: null, links: [], height: "tall" }, items: [] }],
      },
      {
        id: 2, slug: "ended", title: "Ended", navLabel: null, navPosition: 0, role: "ended",
        sections: [{ id: 2, kind: "hero", presentation: { width: "wide", align: "center", background: { kind: "none" }, spacing: "normal", iconBefore: null, iconAfter: null, anchor: null }, data: { title: "Ended page", tagline: null, icon: null, links: [], height: "tall" }, items: [] }],
      },
    ],
  };
}

function okResult(): previewApi.PreviewFetchResult {
  const bundle = { content: makeContent(), media: {}, icons: {} };
  return { kind: "ok", bundle, text: JSON.stringify(bundle), etag: null };
}

function makeLive(statusId: number | null): LiveObject {
  return {
    schemaVersion: 1, eventId: 1, eventStatusId: statusId, pollIntervalMs: 5000,
    snapshotUrl: null, cookieTally: {}, seq: null, lat: null, lng: null, speedMps: null,
    altitudeM: null, headingDeg: null, accuracyM: null, recordedAt: null, receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
  };
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
  vi.mocked(previewApi.fetchPreviewDocument).mockReset();
  vi.mocked(previewApi.fetchPreviewDocument).mockResolvedValue({ kind: "not-modified" });
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/preview" element={<PreviewPage />} />
        <Route
          path="/other"
          element={
            <main id="main">
              <p>Other page</p>
            </main>
          }
        />
        <Route path="*" element={<Link to="/other">Go</Link>} />
      </Routes>
    </MemoryRouter>,
  );
}

const validToken = "wpv_" + "A".repeat(40);

describe("PreviewPage", () => {
  it("fetches with the token and stores the bundle", async () => {
    vi.mocked(previewApi.fetchPreviewDocument).mockResolvedValueOnce(okResult());
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    renderAt(`/preview?token=${validToken}&page=ended`);
    await waitFor(() => expect(previewApi.fetchPreviewDocument).toHaveBeenCalledWith(validToken, null));
    await waitFor(() => expect(store.getState().preview).not.toBeNull());
  });

  it("renders the named page (a role page by slug)", async () => {
    vi.mocked(previewApi.fetchPreviewDocument).mockResolvedValueOnce(okResult());
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    const { container } = renderAt(`/preview?token=${validToken}&page=ended`);
    await waitFor(() => expect(container.querySelector('main[data-page-slug]')?.getAttribute("data-page-slug")).toBe("ended"));
  });

  it("adds robots=noindex to the document head", async () => {
    vi.mocked(previewApi.fetchPreviewDocument).mockResolvedValueOnce(okResult());
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    renderAt(`/preview?token=${validToken}`);
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull(),
    );
  });

  it("404 renders 'This preview link has expired'", async () => {
    vi.mocked(previewApi.fetchPreviewDocument).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    const { container } = renderAt(`/preview?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("This preview link has expired"));
  });

  it("clears store.preview on unmount", async () => {
    vi.mocked(previewApi.fetchPreviewDocument).mockResolvedValueOnce(okResult());
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    const { unmount } = renderAt(`/preview?token=${validToken}&page=ended`);
    await waitFor(() => expect(store.getState().preview).not.toBeNull());
    unmount();
    expect(store.getState().preview).toBeNull();
  });

  describe("theme parameter", () => {
    beforeEach(() => {
      window.localStorage.setItem(THEME_KEY, "light");
      document.documentElement.setAttribute("data-theme", "light");
    });

    afterEach(() => {
      window.localStorage.removeItem(THEME_KEY);
      document.documentElement.removeAttribute("data-theme");
    });

    function mountWithTheme(theme: string) {
      vi.mocked(previewApi.fetchPreviewDocument).mockResolvedValueOnce(okResult());
      act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
      return renderAt(`/preview?token=${validToken}&page=ended&theme=${theme}`);
    }

    it("theme=dark sets data-theme dark while mounted and leaves the stored choice", async () => {
      const { container, unmount } = mountWithTheme("dark");
      await waitFor(() => expect(container.querySelector("main[data-page-slug]")).not.toBeNull());
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
      unmount();
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    });

    it("theme=light sets data-theme light while mounted and leaves the stored choice", async () => {
      window.localStorage.setItem(THEME_KEY, "dark");
      document.documentElement.setAttribute("data-theme", "dark");
      const { container, unmount } = mountWithTheme("light");
      await waitFor(() => expect(container.querySelector("main[data-page-slug]")).not.toBeNull());
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
      unmount();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
    });

    it("ignores an unknown theme value", async () => {
      const { container } = mountWithTheme("sepia");
      await waitFor(() => expect(container.querySelector("main[data-page-slug]")).not.toBeNull());
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    });
  });
});
