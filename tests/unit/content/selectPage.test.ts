// docs/site.md section 5.4 and 22.1 rows for selectPage.

import { describe, it, expect } from "vitest";
import { selectHome, selectSlug, selectRole, selectTakeover } from "../../../src/content/selectPage";
import type { SiteStore, ContentBundle } from "../../../src/store/types";
import { initialStore } from "../../../src/store/types";
import type { ContentDocument, LiveObject, PageRole } from "../../../src/contracts";

function makePage(id: number, role: PageRole, slug: string, navLabel: string | null = null, navPosition = 0) {
  return {
    id,
    slug,
    title: slug,
    navLabel,
    icon: null,
    navPosition,
    role,
    sections: [
      {
        id: id * 10,
        kind: "hero",
        presentation: {
          width: "wide" as const,
          align: "center" as const,
          background: { kind: "none" as const },
          spacing: "normal" as const,
          iconBefore: null,
          iconAfter: null,
          anchor: null,
        },
        data: { title: `Title ${id}`, tagline: null, icon: null, links: [], height: "tall" as const },
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
      theme: { snowDefault: true, lightsDefault: false },
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
      makePage(9, "postponed", "postponed"),
      makePage(7, "none", "about", "About", 10),
      makePage(8, "none", "contact", "Contact", 20),
    ],
  };
}

function makeBundle(): ContentBundle {
  return { content: makeContent(), media: {}, icons: {} };
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
    lat: 0,
    lng: 0,
    speedMps: null,
    altitudeM: null,
    headingDeg: null,
    accuracyM: null,
    recordedAt: null,
    receivedAt: null,
    publishedAt: "2024-12-24T00:00:00Z",
  };
}

function stateFor(statusId: number | null): SiteStore {
  return {
    ...initialStore,
    live: makeLive(statusId),
    snapshot: {
      schemaVersion: 1,
      content: makeContent() as unknown,
      media: {},
      icons: {},
    },
    snapshotUrl: "https://cdn/snap.json",
  };
}

describe("selectRole", () => {
  it("returns null when no live object", () => {
    expect(selectRole(initialStore)).toBeNull();
  });
  it("maps 1..6 to their role and null to no_event", () => {
    expect(selectRole(stateFor(1))).toBe("planned");
    expect(selectRole(stateFor(2))).toBe("scheduled");
    expect(selectRole(stateFor(3))).toBe("live");
    expect(selectRole(stateFor(4))).toBe("ended");
    expect(selectRole(stateFor(5))).toBe("cancelled");
    expect(selectRole(stateFor(6))).toBe("postponed");
    expect(selectRole(stateFor(null))).toBe("no_event");
  });
  it("returns null on unknown status id", () => {
    expect(selectRole(stateFor(99))).toBeNull();
  });
});

describe("selectHome", () => {
  it("returns loading before the first live object", () => {
    expect(selectHome(initialStore)).toEqual({ kind: "loading" });
  });
  it("returns loading when snapshot is missing", () => {
    const s: SiteStore = { ...initialStore, live: makeLive(1) };
    expect(selectHome(s)).toEqual({ kind: "loading" });
  });
  it("returns the role page for every status", () => {
    for (const [id, role] of [[1, "planned"], [2, "scheduled"], [3, "live"], [4, "ended"], [5, "cancelled"], [6, "postponed"]] as const) {
      const s = stateFor(id);
      const r = selectHome(s);
      expect(r.kind).toBe("page");
      if (r.kind === "page") expect(r.page.role).toBe(role);
    }
  });
  it("returns the no_event page when eventStatusId is null", () => {
    const r = selectHome(stateFor(null));
    expect(r.kind).toBe("page");
    if (r.kind === "page") expect(r.page.role).toBe("no_event");
  });
  it("selects the postponed page for status 6", () => {
    const r = selectHome(stateFor(6));
    expect(r.kind).toBe("page");
    if (r.kind === "page") expect(r.page.slug).toBe("postponed");
  });
  it("falls back to the planned page for status 6 when no postponed page is published", () => {
    const content = makeContent();
    content.pages = content.pages.filter((p) => p.role !== "postponed");
    const s: SiteStore = { ...stateFor(6), snapshot: { schemaVersion: 1, content, media: {}, icons: {} } };
    const r = selectHome(s);
    expect(r.kind).toBe("page");
    if (r.kind === "page") expect(r.page.role).toBe("planned");
  });
  it("returns reload on unknown status id", () => {
    expect(selectHome(stateFor(99))).toEqual({ kind: "reload" });
    expect(selectHome(stateFor(7))).toEqual({ kind: "reload" });
  });
  it("reload wins over everything", () => {
    const s: SiteStore = { ...stateFor(1), schemaMismatch: true };
    expect(selectHome(s)).toEqual({ kind: "reload" });
  });
  it("preview bundle wins over the snapshot", () => {
    const s: SiteStore = { ...stateFor(1), preview: makeBundle() };
    const r = selectHome(s);
    expect(r.kind).toBe("page");
  });
});

describe("selectSlug", () => {
  it("returns loading before the bundle exists", () => {
    expect(selectSlug(initialStore, "about")).toEqual({ kind: "loading" });
  });
  it("returns the page for a none-role slug", () => {
    const r = selectSlug(stateFor(1), "about");
    expect(r.kind).toBe("page");
    if (r.kind === "page") expect(r.page.slug).toBe("about");
  });
  it("returns redirectHome for a role page's slug", () => {
    expect(selectSlug(stateFor(1), "planned")).toEqual({ kind: "redirectHome" });
  });
  it("returns notFound for an unknown slug", () => {
    expect(selectSlug(stateFor(1), "nope")).toEqual({ kind: "notFound" });
  });
  it("reload wins", () => {
    const s: SiteStore = { ...stateFor(1), schemaMismatch: true };
    expect(selectSlug(s, "about")).toEqual({ kind: "reload" });
  });
});

describe("selectTakeover", () => {
  it("holds while live without a preview", () => {
    expect(selectTakeover(stateFor(3))).toBe(true);
  });
  it("holds while live with a preview set: preview shows the real live experience", () => {
    const s: SiteStore = { ...stateFor(3), preview: makeBundle() };
    expect(selectTakeover(s)).toBe(true);
  });
  it("is false when the event is not live", () => {
    expect(selectTakeover(stateFor(2))).toBe(false);
  });
});
