// docs/site.md sections 7.4 and 22.1. SponsorGrid: equal cards in one
// grid, name heading, logo box or name text, the bottom row's years line
// and icon links, the whole-card link rule.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import { SponsorGrid } from "../../../../src/content/sections/SponsorGrid/SponsorGrid";
import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { Snapshot } from "../../../../src/contracts";

function buildBundle(): ContentBundle {
  return {
    content: null as unknown as ContentBundle["content"],
    media: {},
    icons: {},
  };
}

type SponsorSeed = {
  id: number;
  name: string;
  websiteUrl?: string | null;
  fbUrl?: string | null;
  igUrl?: string | null;
  logoMediaId?: string | null;
  yearsAsSponsor?: number;
};

function seedSponsors(sponsors: SponsorSeed[]): void {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        content: {} as unknown,
        sponsors,
      } as unknown as Snapshot,
    });
  });
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("SponsorGrid", () => {
  it("renders one card per sponsor in one grid", () => {
    seedSponsors([
      { id: 1, name: "Alpha", websiteUrl: "https://alpha.example" },
      { id: 2, name: "Beta", fbUrl: "https://facebook.com/beta" },
      { id: 3, name: "Gamma" },
    ]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const grid = container.querySelector('[data-testid="sponsor-grid"]');
    expect(grid).not.toBeNull();
    const cards = container.querySelectorAll('[data-testid="sponsor-card"]');
    expect(cards.length).toBe(3);
    expect(cards[0]?.textContent).toContain("Alpha");
    expect(cards[1]?.textContent).toContain("Beta");
    expect(cards[2]?.textContent).toContain("Gamma");
  });

  it("renders the sponsor's name as its heading at the top of the card", () => {
    seedSponsors([{ id: 1, name: "Alpha" }]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const card = container.querySelector('[data-testid="sponsor-card"]');
    expect(card).not.toBeNull();
    const heading = card?.querySelector("h3");
    expect(heading?.textContent).toBe("Alpha");
  });

  it("renders the logo through Media in a 3:2 box when logoMediaId is present", () => {
    seedSponsors([{ id: 1, name: "Alpha", logoMediaId: "media-1" }]);
    const bundle: ContentBundle = {
      content: null as unknown as ContentBundle["content"],
      media: {
        "media-1": {
          url: "https://cdn.example/alpha.png",
          kind: "png",
          width: 480,
          height: 320,
          alt: "Alpha logo",
          variants: {},
          dzi: null,
        },
      },
      icons: {},
    };
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={bundle} />);
    const logo = container.querySelector('[data-testid="sponsor-logo"]');
    expect(logo).not.toBeNull();
    expect(logo?.tagName.toLowerCase()).toBe("img");
    expect((logo as HTMLImageElement).getAttribute("sizes")).toBe("480px");
  });

  it("renders the name as large text in place of the logo when logoMediaId is null", () => {
    seedSponsors([{ id: 1, name: "NoLogo" }]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const logo = container.querySelector('[data-testid="sponsor-logo"]');
    expect(logo).toBeNull();
    const card = container.querySelector('[data-testid="sponsor-card"]');
    expect(card?.textContent).toContain("NoLogo");
  });

  it("renders the years line at the left when showYears and yearsAsSponsor > 0", () => {
    seedSponsors([{ id: 1, name: "Alpha", yearsAsSponsor: 5 }]);
    const { container } = render(<SponsorGrid data={{ showYears: true }} items={[]} bundle={buildBundle()} />);
    expect(container.textContent).toContain("Sponsor for 5 years");
  });

  it("uses the singular for one year", () => {
    seedSponsors([{ id: 1, name: "Alpha", yearsAsSponsor: 1 }]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    expect(container.textContent).toContain("Sponsor for 1 year");
    expect(container.textContent).not.toContain("Sponsor for 1 years");
  });

  it("omits the years line when showYears is false", () => {
    seedSponsors([{ id: 1, name: "Alpha", yearsAsSponsor: 5 }]);
    const { container } = render(<SponsorGrid data={{ showYears: false }} items={[]} bundle={buildBundle()} />);
    expect(container.textContent).not.toContain("Sponsor for");
  });

  it("renders an aria-labelled icon link only for each non-null URL", () => {
    seedSponsors([
      {
        id: 1,
        name: "Alpha",
        websiteUrl: "https://alpha.example",
        fbUrl: "https://facebook.com/alpha",
        igUrl: "https://instagram.com/alpha",
      },
      {
        id: 2,
        name: "Beta",
        websiteUrl: null,
        fbUrl: "https://facebook.com/beta",
        igUrl: null,
      },
    ]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const cards = container.querySelectorAll('[data-testid="sponsor-card"]');
    const first = cards[0]!;
    const iconList = first.querySelector("ul");
    expect(iconList).not.toBeNull();
    const firstIconLinks = iconList!.querySelectorAll(":scope > li > a");
    expect(firstIconLinks.length).toBe(3);
    const labels = Array.from(firstIconLinks).map((a) => a.getAttribute("aria-label"));
    expect(labels).toEqual(["Website", "Facebook", "Instagram"]);
    for (const a of Array.from(firstIconLinks)) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel") ?? "").toContain("noopener");
      expect(a.querySelector("svg")).not.toBeNull();
    }

    const second = cards[1]!;
    const secondList = second.querySelector("ul");
    const secondIconLinks = secondList!.querySelectorAll(":scope > li > a");
    expect(secondIconLinks.length).toBe(1);
    expect(secondIconLinks[0]?.getAttribute("aria-label")).toBe("Facebook");
  });

  it("has a whole-card link to websiteUrl when set", () => {
    seedSponsors([{ id: 1, name: "Alpha", websiteUrl: "https://alpha.example", fbUrl: "https://facebook.com/alpha" }]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const link = container.querySelector('[data-testid="sponsor-card-link"]');
    expect(link?.tagName.toLowerCase()).toBe("a");
    expect(link?.getAttribute("href")).toBe("https://alpha.example");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel") ?? "").toContain("noopener");
  });

  it("places the whole-card link after the icon links so they come first in the tab order", () => {
    seedSponsors([{ id: 1, name: "Alpha", websiteUrl: "https://alpha.example" }]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const card = container.querySelector('[data-testid="sponsor-card"]');
    const anchors = card ? Array.from(card.querySelectorAll("a")) : [];
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    const cardLink = card?.querySelector('[data-testid="sponsor-card-link"]');
    expect(anchors[anchors.length - 1]).toBe(cardLink);
  });

  it("falls through to fbUrl and then igUrl when the earlier link is null", () => {
    seedSponsors([
      { id: 1, name: "Alpha", websiteUrl: null, fbUrl: "https://facebook.com/alpha", igUrl: "https://instagram.com/alpha" },
      { id: 2, name: "Beta", websiteUrl: null, fbUrl: null, igUrl: "https://instagram.com/beta" },
    ]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const cards = container.querySelectorAll('[data-testid="sponsor-card"]');
    const firstLink = cards[0]?.querySelector('[data-testid="sponsor-card-link"]');
    expect(firstLink?.getAttribute("href")).toBe("https://facebook.com/alpha");
    const secondLink = cards[1]?.querySelector('[data-testid="sponsor-card-link"]');
    expect(secondLink?.getAttribute("href")).toBe("https://instagram.com/beta");
  });

  it("renders no whole-card link when websiteUrl, fbUrl, and igUrl are all null", () => {
    seedSponsors([{ id: 1, name: "Alpha", websiteUrl: null, fbUrl: null, igUrl: null }]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    const link = container.querySelector('[data-testid="sponsor-card-link"]');
    expect(link).toBeNull();
  });

  it("renders nothing when there are no sponsors and no emptyText", () => {
    seedSponsors([]);
    const { container } = render(<SponsorGrid data={{}} items={[]} bundle={buildBundle()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the emptyText when there are no sponsors and emptyText is set", () => {
    seedSponsors([]);
    const { container } = render(
      <SponsorGrid data={{ emptyText: "No sponsors yet." }} items={[]} bundle={buildBundle()} />,
    );
    expect(container.textContent).toContain("No sponsors yet.");
  });
});
