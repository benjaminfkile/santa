// docs/site.md sections 4 and 7.8. While live, the route table renders the
// live page on every path outside a preview session; inside one, slugs keep
// resolving to their named draft pages.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../../../src/app/routes";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { ContentBundle } from "../../../src/store/types";
import type { ContentDocument, LiveObject, PageRole } from "../../../src/contracts";

vi.mock("../../../src/content/PageRenderer", () => ({
  PageRenderer: (props: { page: { slug: string } }) => (
    <main data-testid="page">{props.page.slug}</main>
  ),
}));

function page(id: number, role: PageRole, slug: string) {
  return { id, slug, title: slug, navLabel: null, navPosition: id, role, sections: [] };
}

function content(prefix: string): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO", tagline: null, homeNavLabel: "Track", logo: null, favicon: null,
      theme: { snowDefault: false, lightsDefault: false }, navExtraLinks: [], footerLinks: [],
      footerText: null, contactEmail: null, donateUrl: null, analyticsEnabled: false,
    },
    pages: [page(1, "live", `${prefix}live`), page(2, "none", "about")],
  } as ContentDocument;
}

function live(): LiveObject {
  return {
    schemaVersion: 1, eventId: 1, eventStatusId: 3, pollIntervalMs: 5000,
    snapshotUrl: null, cookieTally: {}, seq: null, lat: null, lng: null, speedMps: null,
    altitudeM: null, headingDeg: null, accuracyM: null, recordedAt: null, receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
  };
}

function setLive(preview: ContentBundle | null) {
  act(() => {
    store.setState({
      ...initialStore,
      live: live(),
      snapshot: { schemaVersion: 1, content: content("") as unknown, media: {}, icons: {} },
      preview,
    });
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("live route table", () => {
  it("renders the live page on a slug path without a preview", () => {
    setLive(null);
    const { getByTestId } = renderAt("/about");
    expect(getByTestId("page").textContent).toBe("live");
  });

  it("takes over every slug inside a preview session too: preview is the real live experience", () => {
    setLive({ content: content("draft-"), media: {}, icons: {} });
    const { getByTestId } = renderAt("/about");
    expect(getByTestId("page").textContent).toBe("draft-live");
  });

  it("renders the draft live page at / and at its slug inside a preview session", () => {
    setLive({ content: content("draft-"), media: {}, icons: {} });
    expect(renderAt("/").getByTestId("page").textContent).toBe("draft-live");
    cleanup();
    expect(renderAt("/draft-live").getByTestId("page").textContent).toBe("draft-live");
  });
});
