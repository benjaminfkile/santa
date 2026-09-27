// docs/site.md section 7.2. SectionFrame width, background, spacing,
// decoration icons and their sizes, anchor id, and the card default
// (every kind except map renders inside a card built from tokens unless
// `presentation.card` is false; the card takes a token fill when set and
// clips a media background inside its rounded corners; `data-card`
// exposes the decision).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it.each([
    "rich_text",
    "hero",
    "divider",
    "countdown",
    "media",
    "links",
    "icon_row",
    "funds_ring",
    "event_times",
    "latest_message",
    "leaderboard",
    "sponsor_carousel",
    "sponsor_grid",
    "route_preview",
    "cookie_control",
    "alerts_signup",
    "contact_form",
  ] as const)("renders the card for %s when presentation has no card setting", (kind) => {
    const { container } = render(
      <SectionFrame presentation={base()} bundle={emptyBundle} kind={kind}>
        <div data-testid="body">x</div>
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.card).toBe("true");
    expect(section.querySelector(':scope > [data-testid="section-frame-content"]')).toBeNull();
  });

  it("treats card: null as carded", () => {
    const { container } = render(
      <SectionFrame presentation={base({ card: null })} bundle={emptyBundle} kind="hero">
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")?.dataset.card).toBe("true");
  });

  it.each(["rich_text", "hero", "divider", "countdown"] as const)(
    "card: false renders %s without a card, on the page background",
    (kind) => {
      const { container } = render(
        <SectionFrame presentation={base({ card: false })} bundle={emptyBundle} kind={kind}>
          <div data-testid="body">x</div>
        </SectionFrame>,
      );
      const section = container.querySelector("section")!;
      expect(section.dataset.card).toBe("false");
      // The content renders directly under the section, not inside a card.
      const content = section.querySelector(':scope > [data-testid="section-frame-content"]');
      expect(content).not.toBeNull();
      expect(content?.querySelector('[data-testid="body"]')).not.toBeNull();
    },
  );

  it.each(["full", "wide", "narrow"] as const)(
    "card: false honours presentation.width %s on the content",
    (width) => {
      const { container } = render(
        <SectionFrame presentation={base({ card: false, width })} bundle={emptyBundle} kind="rich_text">
          <div>x</div>
        </SectionFrame>,
      );
      const section = container.querySelector("section")!;
      expect(section.dataset.card).toBe("false");
      expect(section.dataset.width).toBe(width);
      // The content is the section's direct child, so the frame's width
      // rule (`.width<Width> > .content`) caps it.
      expect(section.querySelector(':scope > [data-testid="section-frame-content"]')).not.toBeNull();
      const cssPath = resolve(__dirname, "..", "..", "..", "src", "content", "SectionFrame.module.css");
      const css = readFileSync(cssPath, "utf8");
      const cls = `width${width[0].toUpperCase()}${width.slice(1)}`;
      expect(css).toMatch(new RegExp(`\\.${cls} > \\.content \\{ max-width:`));
    },
  );

  it.each([undefined, null, true, false] as const)("never cards a map (card: %s)", (card) => {
    const { container } = render(
      <SectionFrame presentation={base({ card })} bundle={emptyBundle} kind="map">
        <div data-testid="body">x</div>
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.card).toBe("false");
    expect(section.querySelector(':scope > [data-testid="section-frame-content"]')).not.toBeNull();
  });

  it.each([
    [undefined, 24],
    [null, 24],
    ["sm", 24],
    ["md", 48],
    ["lg", 72],
    ["xl", 96],
  ] as const)("presentation.iconSize %s sizes the icons before and after at %i px", (iconSize, px) => {
    const { getByTestId } = render(
      <SectionFrame
        presentation={base({
          iconSize,
          iconBefore: { source: "library", id: "star" },
          iconAfter: { source: "media", id: "abc" },
        })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div>x</div>
      </SectionFrame>,
    );
    const before = getByTestId("section-frame-icon-before").firstElementChild!;
    const after = getByTestId("section-frame-icon-after").firstElementChild!;
    expect(before.getAttribute("width")).toBe(String(px));
    expect(before.getAttribute("height")).toBe(String(px));
    expect(after.getAttribute("width")).toBe(String(px));
    expect(after.getAttribute("height")).toBe(String(px));
  });

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
        <SectionFrame presentation={base()} bundle={emptyBundle} kind="map">
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

  it("carded sections render the card with the same class set for any presentation.width", () => {
    // Cards have one fixed maximum width and are centred whatever the
    // section's width setting: presentation.width never lands on the card.
    const { container: fullContainer } = render(
      <SectionFrame presentation={base({ width: "full" })} bundle={emptyBundle} kind="rich_text">
        <div>x</div>
      </SectionFrame>,
    );
    const { container: narrowContainer } = render(
      <SectionFrame presentation={base({ width: "narrow" })} bundle={emptyBundle} kind="rich_text">
        <div>y</div>
      </SectionFrame>,
    );
    const fullSection = fullContainer.querySelector("section")!;
    const narrowSection = narrowContainer.querySelector("section")!;
    expect(fullSection.dataset.width).toBe("full");
    expect(narrowSection.dataset.width).toBe("narrow");
    const fullCard = fullSection.firstElementChild as HTMLElement;
    const narrowCard = narrowSection.firstElementChild as HTMLElement;
    expect(fullCard.tagName).toBe("DIV");
    expect(narrowCard.tagName).toBe("DIV");
    expect(fullCard.className).toBe(narrowCard.className);
  });

  it.each(["rich_text", "hero", "map", "divider", "countdown", "event_times", "funds_ring"] as const)(
    "leaves an empty content div when the section renders nothing (kind: %s), so the frame's CSS rule collapses it",
    (kind) => {
      const { container, getByTestId } = render(
        <SectionFrame presentation={base()} bundle={emptyBundle} kind={kind}>
          {null}
        </SectionFrame>,
      );
      const section = container.querySelector("section")!;
      const content = getByTestId("section-frame-content");
      expect(section.contains(content)).toBe(true);
      expect(content.children.length).toBe(0);
      expect(content.textContent).toBe("");
      expect(section.textContent).toBe("");
    },
  );

  it("carries the CSS rule that collapses a section whose content is empty", () => {
    const cssPath = resolve(__dirname, "..", "..", "..", "src", "content", "SectionFrame.module.css");
    const css = readFileSync(cssPath, "utf8");
    expect(css).toMatch(/\.sectionFrame:has\(\.content:empty\)\s*\{\s*display:\s*none;?\s*\}/);
  });

  it("a carded hero with narrow keeps the card rule", () => {
    const { container } = render(
      <SectionFrame presentation={base({ width: "narrow" })} bundle={emptyBundle} kind="hero">
        <div>x</div>
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.card).toBe("true");
    expect(section.dataset.width).toBe("narrow");
  });

  describe("card fill opacity", () => {
    function withTheme(theme: Partial<ContentBundle["content"]["settings"]["theme"]>): ContentBundle {
      return {
        ...emptyBundle,
        content: {
          ...emptyBundle.content,
          settings: {
            ...emptyBundle.content.settings,
            theme: { ...emptyBundle.content.settings.theme, ...theme },
          },
        },
      };
    }

    function renderCard(presentation: Presentation, bundle: ContentBundle) {
      const utils = render(
        <SectionFrame presentation={presentation} bundle={bundle} kind="rich_text">
          <p>x</p>
        </SectionFrame>,
      );
      return { ...utils, card: utils.getByTestId("section-frame-card") };
    }

    it("emits the section pair as custom properties on the card", () => {
      const { card } = renderCard(
        base({ cardOpacityLight: 40, cardOpacityDark: 70 }),
        withTheme({ cardOpacityLight: 90, cardOpacityDark: 10 }),
      );
      expect(card.style.getPropertyValue("--card-opacity-light")).toBe("40%");
      expect(card.style.getPropertyValue("--card-opacity-dark")).toBe("70%");
    });

    it("falls back to the sitewide pair when the section has none", () => {
      const { card } = renderCard(base(), withTheme({ cardOpacityLight: 55, cardOpacityDark: 25 }));
      expect(card.style.getPropertyValue("--card-opacity-light")).toBe("55%");
      expect(card.style.getPropertyValue("--card-opacity-dark")).toBe("25%");
    });

    it("resolves each theme on its own: a null section value takes the sitewide value", () => {
      const { card } = renderCard(
        base({ cardOpacityLight: 30, cardOpacityDark: null }),
        withTheme({ cardOpacityDark: 60 }),
      );
      expect(card.style.getPropertyValue("--card-opacity-light")).toBe("30%");
      expect(card.style.getPropertyValue("--card-opacity-dark")).toBe("60%");
    });

    it("emits nothing when both are absent, so the fill stays opaque", () => {
      const { card } = renderCard(base(), emptyBundle);
      expect(card.style.getPropertyValue("--card-opacity-light")).toBe("");
      expect(card.style.getPropertyValue("--card-opacity-dark")).toBe("");
      expect(card.getAttribute("style")).toBeNull();
    });

    it("gives a token-background card the same treatment", () => {
      const { card, container } = renderCard(
        base({ background: { kind: "token", token: "accent" }, cardOpacityLight: 20, cardOpacityDark: 80 }),
        emptyBundle,
      );
      expect(container.querySelector("section")?.dataset.bg).toBe("accent");
      expect(card.style.getPropertyValue("--card-opacity-light")).toBe("20%");
      expect(card.style.getPropertyValue("--card-opacity-dark")).toBe("80%");
    });

    it("never puts an opacity on the card or anything in the content subtree", () => {
      const { card, getByTestId } = renderCard(
        base({ cardOpacityLight: 10, cardOpacityDark: 10 }),
        emptyBundle,
      );
      expect(card.style.opacity).toBe("");
      const content = getByTestId("section-frame-content");
      for (const el of [content, ...Array.from(content.querySelectorAll<HTMLElement>("*"))]) {
        expect(el.style.opacity).toBe("");
        expect(el.getAttribute("style") ?? "").not.toMatch(/opacity/);
      }
    });

    it("mixes only the fill in CSS, scoped per theme, and never sets opacity on the card", () => {
      const cssPath = resolve(__dirname, "..", "..", "..", "src", "content", "SectionFrame.module.css");
      const css = readFileSync(cssPath, "utf8");
      expect(css).toContain(
        "background: color-mix(in srgb, var(--card-fill) var(--card-fill-alpha, 100%), transparent);",
      );
      expect(css).toContain(':root:not([data-theme="dark"]) .card { --card-fill-alpha: var(--card-opacity-light, 100%); }');
      expect(css).toContain(':root[data-theme="dark"] .card { --card-fill-alpha: var(--card-opacity-dark, 100%); }');
      expect(css).not.toMatch(/(^|[^-])opacity\s*:/m);
    });
  });
});
