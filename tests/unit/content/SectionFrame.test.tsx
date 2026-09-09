// docs/site.md section 7.2. SectionFrame width, background, spacing,
// decoration icons, anchor id.

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
      theme: { accent: "red", surface: "night", fontPairing: "festive", snowDefault: false },
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

  it("classes for token background include the token name", () => {
    const { container } = render(
      <SectionFrame
        presentation={base({ background: { kind: "token", token: "muted" } })}
        bundle={emptyBundle}
        kind="rich_text"
      >
        <div>x</div>
      </SectionFrame>,
    );
    expect(container.querySelector("section")!.className).toContain("bg-muted");
  });

  it("renders a media background with an overlay", () => {
    const { container } = render(
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
    const bg = container.querySelector(".section-frame__background");
    expect(bg).not.toBeNull();
    expect(bg?.getAttribute("data-overlay")).toBe("0.5");
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
    const { container } = render(
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
    expect(container.querySelector(".section-frame__icon-before")).not.toBeNull();
    expect(container.querySelector(".section-frame__icon-after")).not.toBeNull();
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
});
