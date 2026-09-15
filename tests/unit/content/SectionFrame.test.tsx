// docs/site.md section 7.2. SectionFrame width, background, spacing,
// decoration icons, anchor id, and the card default (every content kind
// except hero, map, divider, and countdown renders inside a card built
// from tokens; the card takes a token fill when set and clips a media
// background inside its rounded corners; `data-card` exposes the
// decision).

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectionFrame } from "../../../src/content/SectionFrame";
import type { ContentBundle } from "../../../src/store/types";
import type { Presentation } from "../../../src/contracts";

function base(overrides: Partial<Presentation> = {}): Presentation {
  return {
    width: "wide",
    align: "start",
    background: { kind: "none" },
    spacing: "normal",
    iconBefore: null,
    iconAfter: null,
    anchor: null,
    ...overrides,
  };
}

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
  media: {
    "abc": {
      url: "https://cdn/abc.jpg",
      kind: "raster",
      width: 1200,
      height: 800,
      alt: "hangar",
      variants: { "480": "https://cdn/abc-480.webp" },
    },
  },
  icons: { star: "https://cdn/icons/star.svg" },
};

describe("SectionFrame", () => {
  it.each(["full", "wide", "narrow"] as const)("renders width %s", (width) => {
    const { container } = render(
      <SectionFrame presentation={base({ width })} bundle={emptyBundle} kind="rich_text">
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")?.dataset.width).toBe(width);
  });

  it("applies the anchor id", () => {
    const { container } = render(
      <SectionFrame presentation={base({ anchor: "foo" })} bundle={emptyBundle} kind="rich_text">
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")?.id).toBe("foo");
  });

  it("exposes the token background via data-bg", () => {
    const { container } = render(
      <SectionFrame
        presentation={base({ background: { kind: "token", token: "muted" } })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")?.dataset.bg).toBe("muted");
  });

  it("renders a media background with an overlay", () => {
    const { getByTestId, container } = render(
      <SectionFrame
        presentation={base({
          background: {
            kind: "media",
            media: { mediaId: "abc", alt: "hangar" },
            overlay: 0.5,
          },
        })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div>x</div>
      </SectionFrame>,
    );
    const bg = getByTestId("section-frame-background");
    expect(bg).not.toBeNull();
    expect(bg.getAttribute("data-overlay")).toBe("0.5");
    expect(container.querySelector("img")).not.toBeNull();
  });

  it.each(["tight", "normal", "loose"] as const)("applies spacing %s", (spacing) => {
    const { container } = render(
      <SectionFrame presentation={base({ spacing })} bundle={emptyBundle} kind="rich_text">
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")?.dataset.spacing).toBe(spacing);
  });

  it("renders decoration icons before and after when set", () => {
    const { getByTestId } = render(
      <SectionFrame
        presentation={base({
          iconBefore: { source: "library", id: "star" },
          iconAfter: { source: "library", id: "star" },
        })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div>x</div>
      </SectionFrame>,
    );
    expect(getByTestId("section-frame-icon-before")).not.toBeNull();
    expect(getByTestId("section-frame-icon-after")).not.toBeNull();
  });

  it("exposes data-testid=section-<kind> on the root section", () => {
    const { container } = render(
      <SectionFrame presentation={base()} bundle={emptyBundle} kind="rich_text">
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")?.getAttribute("data-testid")).toBe(
      "section-rich_text",
    );
  });

  it("map ignores width and spacing", () => {
    const { container } = render(
      <SectionFrame
        presentation={base({ width: "narrow", spacing: "tight" })}
        bundle={emptyBundle}
        kind="map"
      >
        <div>x</div>
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.width).toBe("full");
    expect(section.dataset.spacing).toBe("none");
  });

  it("renders the card for a rich_text section with no background", () => {
    const { container } = render(
      <SectionFrame presentation={base()} bundle={emptyBundle} kind="rich_text">
        <div data-testid="body">x</div>
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.card).toBe("true");
    // The card wraps every child of the section: the body is the section's
    // grandchild, not its direct child.
    expect(section.querySelector(':scope > [data-testid="body"]')).toBeNull();
    const cardChild = section.firstElementChild as HTMLElement;
    expect(cardChild.querySelector('[data-testid="body"]')).not.toBeNull();
  });

  it.each(["hero", "map", "divider", "countdown"] as const)(
    "does not render the card for %s",
    (kind) => {
      const { container } = render(
        <SectionFrame presentation={base()} bundle={emptyBundle} kind={kind}>
          <div data-testid="body">x</div>
        </SectionFrame>,
      );
      const section = container.querySelector("section")!;
      expect(section.dataset.card).toBe("false");
      // The children render directly under the section, not inside a card.
      expect(section.querySelector(':scope > [data-testid="body"]')).toBeNull();
      const content = section.querySelector(':scope > div');
      expect(content).not.toBeNull();
      expect(content?.querySelector('[data-testid="body"]')).not.toBeNull();
    },
  );

  it("uses the token fill on the card when a token background is set", () => {
    const { container, getByTestId } = render(
      <SectionFrame
        presentation={base({ background: { kind: "token", token: "muted" } })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div data-testid="body">x</div>
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.card).toBe("true");
    expect(section.dataset.bg).toBe("muted");
    // The body renders inside the card wrapper, not directly under the
    // section: the card is the section's only child in the card default,
    // and it fills that section's width so the token becomes the card's
    // fill rather than a stripe under the frame.
    const card = getByTestId("body").parentElement!.parentElement!;
    expect(card.parentElement).toBe(section);
  });

  it("clips a media background inside the card", () => {
    const { getByTestId } = render(
      <SectionFrame
        presentation={base({
          background: {
            kind: "media",
            media: { mediaId: "abc", alt: "hangar" },
            overlay: 0.3,
          },
        })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div data-testid="body">x</div>
      </SectionFrame>,
    );
    const bg = getByTestId("section-frame-background");
    // The background sits inside the card, not directly under the section,
    // so the card's rounded corners and overflow: hidden clip it.
    const parent = bg.parentElement!;
    expect(parent.tagName).toBe("DIV");
    expect(parent.parentElement?.tagName).toBe("SECTION");
  });

  it("sets data-card on the section element", () => {
    const { container } = render(
      <>
        <SectionFrame presentation={base()} bundle={emptyBundle} kind="hero">
          <div>x</div>
        </SectionFrame>
        <SectionFrame presentation={base()} bundle={emptyBundle} kind="rich_text">
          <div>y</div>
        </SectionFrame>
      </>,
    );
    const sections = container.querySelectorAll("section");
    expect(sections[0].dataset.card).toBe("false");
    expect(sections[1].dataset.card).toBe("true");
  });
});
