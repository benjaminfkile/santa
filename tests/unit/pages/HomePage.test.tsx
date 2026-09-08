// docs/site.md section 22.1 HomePage status walk: apply live objects in
// the order 1, 2, 3, 4, 5, null and assert the rendered role page changes
// without waiting for a new snapshot.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../../src/pages/HomePage";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { LiveObject, ContentDocument } from "../../../src/contracts";

function makePage(id: number, role: ContentDocument["pages"][number]["role"], slug: string) {
  return {
    id,
    slug,
    title: slug,
    navLabel: null,
    navPosition: 0,
    role,
    sections: [
      {
        id: id * 100,
        kind: "hero" as const,
        presentation: {
          width: "wide" as const,
          align: "center" as const,
          background: { kind: "none" as const },
          spacing: "normal" as const,
          iconBefore: null,
          iconAfter: null,
          anchor: null,
        },
        data: { title: `Heading ${slug}`, tagline: null, icon: null, links: [], height: "tall" as const },
        items: [],
      },
    ],
  };
}

function makeContent(): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO",
      tagline: null,
      homeNavLabel: "Track",
      logo: null,
      favicon: null,
      theme: { accent: "red", surface: "night", fontPairing: "festive", snowDefault: true },
      navExtraLinks: [],
      footerLinks: [],
      footerText: null,
      contactEmail: null,
      donateUrl: null,
      analyticsEnabled: false,
    },
    pages: [
      makePage(1, "no_event", "no-event"),
      makePage(2, "planned", "planned"),
      makePage(3, "scheduled", "scheduled"),
      makePage(4, "live", "live"),
      makePage(5, "ended", "ended"),
      makePage(6, "cancelled", "cancelled"),
    ],
  };
}

function makeLive(statusId: number | null): LiveObject {
  return {
    schemaVersion: 1,
    eventId: 1,
    eventStatusId: statusId,
    pollIntervalMs: 5000,
    snapshotUrl: "https://cdn/snap.json",
    cookieTally: {},
    seq: null,
    lat: null,
    lng: null,
    speedMps: null,
    altitudeM: null,
    headingDeg: null,
    accuracyM: null,
    recordedAt: null,
    receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
  };
}

function setLive(statusId: number | null) {
  act(() => {
    store.setState((s) => ({ ...s, live: makeLive(statusId) }));
  });
}

function setSnapshot(statusId: number | null) {
  act(() => {
    store.setState((s) => ({
      ...s,
      snapshot: {
        schemaVersion: 1,
        content: makeContent() as unknown,
        media: {},
        icons: {},
        event: statusId === null ? null : { statusId },
      },
      snapshotUrl: "https://cdn/snap.json",
    }));
  });
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

describe("HomePage status walk", () => {
  it("switches to each role page as the live object changes", () => {
    // First give it a snapshot with content, and set live to no_event initially.
    setSnapshot(null);
    setLive(null);
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container.querySelector('main[data-page-role]')?.getAttribute("data-page-role")).toBe("no_event");

    const walk: [number | null, string][] = [
      [1, "planned"],
      [2, "scheduled"],
      [3, "live"],
      [4, "ended"],
      [5, "cancelled"],
      [null, "no_event"],
    ];
    for (const [id, role] of walk) {
      setLive(id);
      expect(container.querySelector('main[data-page-role]')?.getAttribute("data-page-role")).toBe(role);
    }
  });

  it("renders Loading before the first live object", () => {
    setSnapshot(null);
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container.querySelector('main[data-page-role]')).toBeNull();
    expect(container.textContent).toContain("Loading");
  });

  it("renders the reload prompt on schemaMismatch", () => {
    act(() => {
      store.setState({ ...initialStore, schemaMismatch: true });
    });
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container.querySelector("button")?.textContent).toMatch(/reload/i);
  });
});
