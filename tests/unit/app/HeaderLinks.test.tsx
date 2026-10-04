// docs/site.md section 7.7, Header links. The header's link buttons from
// `settings.headerLinks`: none renders nothing; each link is an anchor in
// order with its label, icon (library inline, media through <img>, or the
// label's first letter in a circle), and new-tab attributes; the label is never
// drawn, only the accessible name; the links come first in the actions row,
// before sign-in, the bell, the theme toggle, and the menu button.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Shell } from "../../../src/app/Shell";
import { AuthProvider, type AuthState } from "../../../src/auth/AuthProvider";
import { AlertsProvider } from "../../../src/alerts/AlertsProvider";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { ContentDocument, Link } from "../../../src/contracts";

vi.mock("../../../src/api/subscriptions", () => ({
  listMySubscriptions: vi.fn(),
  listAlerts: vi.fn(),
}));

import * as subsApi from "../../../src/api/subscriptions";

const THREE_LINKS: Link[] = [
  { label: "Facebook", href: "https://facebook.example/flyover", icon: { source: "library", id: "facebook" }, newTab: true },
  { label: "Photos", href: "https://photos.example", icon: { source: "media", id: "m-photos" }, newTab: false },
  { label: "news", href: "/news", icon: null, newTab: true },
];

const MEDIA = { "m-photos": { url: "https://cdn/photos.svg", kind: "svg" } };

function makeContent(headerLinks?: Link[]): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO Test",
      tagline: null,
      homeNavLabel: "Track Santa",
      logo: null,
      favicon: null,
      theme: { snowDefault: false, lightsDefault: false },
      navExtraLinks: [],
      footerLinks: [],
      footerText: null,
      contactEmail: null,
      donateUrl: null,
      analyticsEnabled: false,
      ...(headerLinks !== undefined ? { headerLinks } : {}),
    },
    pages: [
      {
        id: 1,
        slug: "planned",
        title: "planned",
        navLabel: null,
        icon: null,
        navPosition: 0,
        role: "planned",
        sections: [],
      },
    ],
  } as unknown as ContentDocument;
}

function seed(content: ContentDocument) {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: { schemaVersion: 1, content: content as unknown, media: MEDIA, icons: {}, event: { statusId: 1 } },
      snapshotUrl: "https://cdn/snap.json",
    } as never);
  });
}

function renderShell(auth: AuthState = { status: "signedOut" }) {
  return render(
    <MemoryRouter>
      <AuthProvider initialState={auth}>
        <AlertsProvider>
          <Shell>
            <div>body</div>
          </Shell>
        </AlertsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const css = (): string =>
  readFileSync(resolve(__dirname, "..", "..", "..", "src", "app", "Shell.module.css"), "utf8");

beforeEach(() => {
  vi.mocked(subsApi.listMySubscriptions).mockReset();
  vi.mocked(subsApi.listAlerts).mockReset();
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("Header links", () => {
  it("renders nothing without header links", () => {
    seed(makeContent());
    const { queryAllByTestId } = renderShell();
    expect(queryAllByTestId("header-link")).toHaveLength(0);
    cleanup();
    seed(makeContent([]));
    expect(renderShell().queryAllByTestId("header-link")).toHaveLength(0);
  });

  it("renders three anchors in order with their labels, icons, and new-tab attributes", () => {
    seed(makeContent(THREE_LINKS));
    const { getAllByTestId } = renderShell();
    const links = getAllByTestId("header-link");
    expect(links).toHaveLength(3);
    expect(links.map((a) => a.tagName)).toEqual(["A", "A", "A"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://facebook.example/flyover",
      "https://photos.example",
      "/news",
    ]);
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual(["Facebook", "Photos", "news"]);
    expect(links.map((a) => a.getAttribute("title"))).toEqual(["Facebook", "Photos", "news"]);
    expect(links.map((a) => a.textContent)).toEqual(["", "", "N"]);

    const [facebook, photos, news] = links;
    const svg = facebook.querySelector("svg")!;
    expect(svg.getAttribute("data-icon-source")).toBe("library");
    expect(svg.getAttribute("data-icon-id")).toBe("facebook");
    expect(svg.getAttribute("width")).toBe("18");

    const img = photos.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn/photos.svg");
    expect(img.getAttribute("width")).toBe("18");

    expect(news.querySelector("svg, img")).toBeNull();
    expect(news.querySelector('[data-testid="header-link-letter"]')!.textContent).toBe("N");

    expect(facebook.getAttribute("target")).toBe("_blank");
    expect(facebook.getAttribute("rel")).toBe("noopener");
    expect(photos.getAttribute("target")).toBeNull();
    expect(photos.getAttribute("rel")).toBeNull();
    expect(news.getAttribute("target")).toBe("_blank");
    expect(news.getAttribute("rel")).toBe("noopener");
  });

  it("draws the first letter when an icon does not resolve", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    seed(makeContent([{ label: "Gallery", href: "https://g.example", icon: { source: "media", id: "missing" }, newTab: false }]));
    const link = renderShell().getByTestId("header-link");
    expect(link.querySelector("img")).toBeNull();
    expect(link.querySelector('[data-testid="header-link-letter"]')!.textContent).toBe("G");
    warn.mockRestore();
  });

  it("never draws the label; the label is the accessible name and the title", () => {
    seed(makeContent(THREE_LINKS));
    const link = renderShell().getAllByTestId("header-link")[0];
    expect(link.querySelector('[data-testid="header-link-label"]')).toBeNull();
    expect(link.textContent?.trim()).toBe("");
    expect(link.getAttribute("aria-label")).toBe("Facebook");
    expect(link.getAttribute("title")).toBe("Facebook");
    const sheet = css();
    expect(sheet).not.toMatch(/.headerLinkLabel/);
    expect(sheet).not.toMatch(/@media (min-width: 761px) {s*.headerLink {/);
  });

  it("is a 44 px button on the secondary button recipe with an 18 px icon, like the icon buttons", () => {
    seed(makeContent(THREE_LINKS));
    renderShell();
    const sheet = css();
    expect(sheet).toMatch(/\.headerLink \{\s*composes: btn from "\.\.\/ui\/Button\.module\.css";[^}]*min-height: 44px;/);
    expect(sheet).toMatch(/\.headerLinkIcon svg,\s*\.headerLinkIcon img \{[^}]*width: 18px;[^}]*height: 18px;/);
    expect(sheet).toMatch(/.headerLink {[^}]*width: 44px;[^}]*height: 44px;/);
  });

  it("comes first in the actions row: header links, sign-in, bell, theme, menu", async () => {
    vi.mocked(subsApi.listMySubscriptions).mockResolvedValue({
      items: [
        {
          id: 1,
          channel: "email",
          address: "p@example.com",
          verifiedAt: "2026-09-01T00:00:00Z",
          unsubscribedAt: null,
          createdAt: "2026-09-01T00:00:00Z",
        },
      ],
    } as never);
    vi.mocked(subsApi.listAlerts).mockResolvedValue({ items: [] } as never);
    seed(makeContent(THREE_LINKS));
    const { findByTestId, getAllByTestId, getByTestId, getByLabelText } = renderShell({
      status: "signedIn",
      email: "p@example.com",
      expired: false,
    });
    const bell = await findByTestId("alerts-bell");
    const actions = bell.parentElement!;
    const order = [
      ...getAllByTestId("header-link"),
      getByTestId("menu-sign-out"),
      bell,
      getByTestId("theme-toggle").parentElement!,
      getByLabelText("Menu"),
    ];
    expect(Array.from(actions.children)).toEqual(order);
  });

  it("leaves the menu panel without header link rows", () => {
    seed(makeContent(THREE_LINKS));
    const { getByLabelText } = renderShell();
    const panel = document.getElementById(getByLabelText("Menu").getAttribute("aria-controls")!)!;
    expect(panel.textContent).not.toContain("Facebook");
  });
});
