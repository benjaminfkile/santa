// docs/site.md section 7.2 and S16f. When a page has a `hero` section
// immediately followed by a `countdown` section, PageRenderer emits one
// pair row (a single <section data-testid="hero-countdown-pair">) instead
// of the usual two independent frames, inside one card unless the hero's
// `presentation.card` is false. Other adjacency patterns render the usual
// stack of section frames.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageRenderer } from "../../../src/content/PageRenderer";
import type { ContentBundle } from "../../../src/store/types";
import type { ContentPage, ContentSection, Presentation } from "../../../src/contracts";

const emptyBundle: ContentBundle = {
  content: {
    schemaVersion: 1,
    settings: {
      siteName: "s",
      tagline: null,
      homeNavLabel: "h",
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
    pages: [],
  },
  media: {},
  icons: {},
};

function presentation(): Presentation {
  return {
    width: "wide",
    align: "center",
    background: { kind: "none" },
    spacing: "normal",
    iconBefore: null,
    iconAfter: null,
    anchor: null,
  };
}

function section(
  kind: string,
  data: unknown = {},
  overrides: Partial<Presentation> = {},
): ContentSection {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    kind,
    data,
    items: [],
    presentation: { ...presentation(), ...overrides },
  } as ContentSection;
}

function page(sections: ContentSection[]): ContentPage {
  return {
    id: 1,
    slug: "home",
    title: "Home",
    navLabel: "Home",
    navPosition: 0,
    role: "none",
    sections,
  } as ContentPage;
}

describe("PageRenderer hero+countdown pairing", () => {
  it("renders a pair row when hero is followed by countdown", () => {
    const p = page([
      section("hero", { title: "Hi", height: "tall" }),
      section("countdown", {}),
    ]);
    const { queryByTestId } = render(
      <MemoryRouter>
        <PageRenderer page={p} bundle={emptyBundle} />
      </MemoryRouter>,
    );
    expect(queryByTestId("hero-countdown-pair")).not.toBeNull();
    expect(queryByTestId("hero-countdown-hero")).not.toBeNull();
    expect(queryByTestId("hero-countdown-countdown")).not.toBeNull();
    // The independent section frames are not emitted for the paired items.
    expect(queryByTestId("section-hero")).toBeNull();
    expect(queryByTestId("section-countdown")).toBeNull();
  });

  it("renders the pair inside one card by default", () => {
    const p = page([
      section("hero", { title: "Hi", height: "tall" }),
      section("countdown", {}),
    ]);
    const { getByTestId } = render(
      <MemoryRouter>
        <PageRenderer page={p} bundle={emptyBundle} />
      </MemoryRouter>,
    );
    const pair = getByTestId("hero-countdown-pair");
    expect(pair.dataset.card).toBe("true");
    expect(pair.children.length).toBe(1);
    const card = pair.firstElementChild as HTMLElement;
    expect(card.contains(getByTestId("hero-countdown-hero"))).toBe(true);
    expect(card.contains(getByTestId("hero-countdown-countdown"))).toBe(true);
    // One card: the hero and countdown share the card's single content row.
    expect(getByTestId("hero-countdown-hero").parentElement?.parentElement).toBe(card);
  });

  it("renders the pair open when the hero's card is false", () => {
    const p = page([
      section("hero", { title: "Hi", height: "tall" }, { card: false }),
      section("countdown", {}),
    ]);
    const { getByTestId } = render(
      <MemoryRouter>
        <PageRenderer page={p} bundle={emptyBundle} />
      </MemoryRouter>,
    );
    const pair = getByTestId("hero-countdown-pair");
    expect(pair.dataset.card).toBe("false");
    // The content row is the pair's direct child: no card wraps it.
    expect(getByTestId("hero-countdown-hero").parentElement?.parentElement).toBe(pair);
  });

  it("does not pair a hero followed by anything other than a countdown", () => {
    const p = page([
      section("hero", { title: "Hi" }),
      section("rich_text", { blocks: [] }),
    ]);
    const { queryByTestId } = render(
      <MemoryRouter>
        <PageRenderer page={p} bundle={emptyBundle} />
      </MemoryRouter>,
    );
    expect(queryByTestId("hero-countdown-pair")).toBeNull();
    expect(queryByTestId("section-hero")).not.toBeNull();
    expect(queryByTestId("section-rich_text")).not.toBeNull();
  });

  it("does not pair a countdown that is not preceded by a hero", () => {
    const p = page([
      section("rich_text", { blocks: [] }),
      section("countdown", {}),
    ]);
    const { queryByTestId } = render(
      <MemoryRouter>
        <PageRenderer page={p} bundle={emptyBundle} />
      </MemoryRouter>,
    );
    expect(queryByTestId("hero-countdown-pair")).toBeNull();
  });
});
