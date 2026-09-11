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

vi.mock("../../../src/api/preview", () => ({
  fetchPreviewBundle: vi.fn(),
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
  vi.mocked(previewApi.fetchPreviewBundle).mockReset();
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
    vi.mocked(previewApi.fetchPreviewBundle).mockResolvedValueOnce({
      content: makeContent(), media: {}, icons: {},
    });
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    renderAt(`/preview?token=${validToken}&page=ended`);
    await waitFor(() => expect(previewApi.fetchPreviewBundle).toHaveBeenCalledWith(validToken));
    await waitFor(() => expect(store.getState().preview).not.toBeNull());
  });

  it("renders the named page (a role page by slug)", async () => {
    vi.mocked(previewApi.fetchPreviewBundle).mockResolvedValueOnce({
      content: makeContent(), media: {}, icons: {},
    });
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    const { container } = renderAt(`/preview?token=${validToken}&page=ended`);
    await waitFor(() => expect(container.querySelector('main[data-page-slug]')?.getAttribute("data-page-slug")).toBe("ended"));
  });

  it("adds robots=noindex to the document head", async () => {
    vi.mocked(previewApi.fetchPreviewBundle).mockResolvedValueOnce({
      content: makeContent(), media: {}, icons: {},
    });
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    renderAt(`/preview?token=${validToken}`);
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"][content="noindex"]')).not.toBeNull(),
    );
  });

  it("404 renders 'This preview link has expired'", async () => {
    vi.mocked(previewApi.fetchPreviewBundle).mockRejectedValueOnce(
      new ApiRequestError(404, { code: "not_found", message: "x", details: null, requestId: "r" }, null),
    );
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    const { container } = renderAt(`/preview?token=${validToken}`);
    await waitFor(() => expect(container.textContent).toContain("This preview link has expired"));
  });

  it("clears store.preview on unmount", async () => {
    vi.mocked(previewApi.fetchPreviewBundle).mockResolvedValueOnce({
      content: makeContent(), media: {}, icons: {},
    });
    act(() => store.setState((s) => ({ ...s, live: makeLive(1) })));
    const { unmount } = renderAt(`/preview?token=${validToken}&page=ended`);
    await waitFor(() => expect(store.getState().preview).not.toBeNull());
    unmount();
    expect(store.getState().preview).toBeNull();
  });
});
