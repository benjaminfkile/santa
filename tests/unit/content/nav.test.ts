// docs/site.md section 4. buildNav from content settings and pages.

import { describe, it, expect } from "vitest";
import { buildNav, SIGN_IN_ICON, SIGN_OUT_ICON, type NavEntry } from "../../../src/content/nav";
import type { ContentDocument, Link } from "../../../src/contracts";

function link(label: string, href: string): Link {
  return { label, href, icon: null, newTab: false };
}

function makeContent(overrides: Partial<ContentDocument> = {}): ContentDocument {
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
    pages: [],
    ...overrides,
  };
}

function page(id: number, slug: string, role: ContentDocument["pages"][number]["role"], navLabel: string | null, navPosition: number) {
  return {
    id, slug, title: slug, navLabel, icon: null, navPosition, role, sections: [],
  };
}

describe("buildNav", () => {
  it("puts the home entry first with the settings label", () => {
    const content = makeContent({
      settings: {
        ...makeContent().settings,
        homeNavLabel: "Track Santa",
      },
    });
    const entries = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out" });
    expect(entries[0]).toEqual<NavEntry>({ kind: "home", label: "Track Santa", href: "/", icon: null });
  });

  it("excludes role pages and hidden (null navLabel) pages", () => {
    const content = makeContent({
      pages: [
        page(1, "planned", "planned", null, 0),
        page(2, "about", "none", "About", 10),
        page(3, "hidden", "none", null, 5),
      ],
    });
    const entries = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out" });
    const pageEntries = entries.filter((e) => e.kind === "page");
    expect(pageEntries).toEqual([{ kind: "page", label: "About", href: "/about", icon: null }]);
  });

  it("orders none pages by navPosition ascending", () => {
    const content = makeContent({
      pages: [
        page(1, "b", "none", "B", 20),
        page(2, "a", "none", "A", 10),
        page(3, "c", "none", "C", 30),
      ],
    });
    const entries = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out" });
    const pages = entries.filter((e) => e.kind === "page").map((e) => e.label);
    expect(pages).toEqual(["A", "B", "C"]);
  });

  it("appends navExtraLinks after page entries", () => {
    const content = makeContent({
      pages: [page(1, "about", "none", "About", 10)],
      settings: {
        ...makeContent().settings,
        navExtraLinks: [link("Donate", "https://example.org/give")],
      },
    });
    const entries = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out" });
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toEqual(["home", "page", "extra", "signIn"]);
  });

  it("shows sign in when signed out and sign out when signed in", () => {
    const content = makeContent();
    const signedOut = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out" });
    expect(signedOut.at(-1)).toEqual({ kind: "signIn", label: "In", icon: SIGN_IN_ICON });
    const signedIn = buildNav(content, { signedIn: true, signInLabel: "In", signOutLabel: "Out" });
    expect(signedIn.at(-1)).toEqual({ kind: "signOut", label: "Out", icon: SIGN_OUT_ICON });
  });

  it("carries each page's icon and gives the home entry the icon of the role page served at /", () => {
    const about = { ...page(2, "about", "none", "About", 10), icon: { source: "media" as const, id: "m1" } };
    const planned = { ...page(1, "planned", "planned", null, 0), icon: { source: "library" as const, id: "sleigh" } };
    const content = makeContent({ pages: [planned, about, page(3, "faq", "none", "FAQ", 20)] });
    const entries = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out", homeRole: "planned" });
    expect(entries[0]).toMatchObject({ kind: "home", icon: { source: "library", id: "sleigh" } });
    expect(entries[1]).toMatchObject({ kind: "page", label: "About", icon: { source: "media", id: "m1" } });
    expect(entries[2]).toMatchObject({ kind: "page", label: "FAQ", icon: null });
    const noRole = buildNav(content, { signedIn: false, signInLabel: "In", signOutLabel: "Out" });
    expect(noRole[0]).toMatchObject({ kind: "home", icon: null });
  });

  it("gives the sign in and sign out entries bundled library icons", () => {
    expect(SIGN_IN_ICON.source).toBe("library");
    expect(SIGN_OUT_ICON.source).toBe("library");
    expect(SIGN_IN_ICON.id).not.toBe(SIGN_OUT_ICON.id);
  });
});
