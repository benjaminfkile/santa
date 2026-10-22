// docs/site.md section 7.5. A block's own `align` beats the section's: the
// heading, paragraph, list, quote, media, and links blocks carry
// `data-align` with their own value when they set one and nothing
// otherwise, and RichText.module.css keys the per-block overrides on it.
// Blocks without the field render exactly as they did before the field
// existed (the snapshot was taken before the change).

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RichText } from "../../../../src/content/sections/RichText/RichText";
import { SectionFrame } from "../../../../src/content/SectionFrame";
import type { ContentBundle } from "../../../../src/store/types";
import type { Presentation } from "../../../../src/contracts";

// CSS processing is off in unit tests, so the rich text module's classes
// map to their own names here; the rules themselves are read from the file.
vi.mock("../../../../src/content/sections/RichText/RichText.module.css", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const css = readFileSync(resolve(__dirname, "../../../../src/content/sections/RichText/RichText.module.css"), "utf8");
  const names = new Set(Array.from(css.matchAll(/\.([a-zA-Z][a-zA-Z0-9]*)/g), (m) => m[1]));
  return Object.fromEntries(Array.from(names, (n) => [n, n]));
});

const css = readFileSync(
  resolve(__dirname, "..", "..", "..", "..", "src", "content", "sections", "RichText", "RichText.module.css"),
  "utf8",
);

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {
    photo: {
      url: "https://cdn/photo.jpg",
      kind: "raster",
      width: 1200,
      height: 800,
      alt: "photo",
      variants: { "480": "https://cdn/photo-480.webp" },
    },
  },
  icons: { star: "https://cdn/star.svg" },
};

function presentation(align: Presentation["align"]): Presentation {
  return {
    width: "wide",
    align,
    background: { kind: "none" },
    spacing: "normal",
    iconBefore: null,
    iconAfter: null,
    anchor: null,
  };
}

function renderSection(align: Presentation["align"], blocks: Record<string, unknown>[]) {
  return render(
    <MemoryRouter>
      <SectionFrame presentation={presentation(align)} bundle={bundle} kind="rich_text">
        <RichText data={{ blocks }} items={[]} bundle={bundle} />
      </SectionFrame>
    </MemoryRouter>,
  );
}

const PLAIN_BLOCKS: Record<string, unknown>[] = [
  { kind: "heading", level: 2, text: "Give", icon: { source: "library", id: "star" } },
  { kind: "paragraph", text: "Every **gift** helps" },
  { kind: "list", style: "bullet", icon: null, items: ["one", "two"] },
  { kind: "list", style: "icon", icon: { source: "library", id: "star" }, items: ["three"] },
  { kind: "quote", text: "Ho ho", attribution: "Santa" },
  { kind: "media", media: { mediaId: "photo", alt: null }, caption: "A photo", size: "medium" },
  { kind: "links", style: "buttons", links: [{ label: "Donate", href: "https://example.org/give", icon: null, newTab: false }] },
  { kind: "links", style: "list", links: [{ label: "About", href: "/about", icon: null, newTab: false }] },
  { kind: "icon", icon: { source: "library", id: "star" }, size: "md", align: "center" },
];

describe("blocks without align", () => {
  for (const align of ["start", "center"] as const) {
    it(`render as before under a ${align} section`, () => {
      const { container } = renderSection(align, PLAIN_BLOCKS);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});

describe("a block's own align", () => {
  it("a centred section renders a start paragraph and a start list with data-align start", () => {
    const { container } = renderSection("center", [
      { kind: "heading", level: 2, text: "Centred", icon: null },
      { kind: "paragraph", text: "To the start", align: "start" },
      { kind: "list", style: "bullet", icon: null, items: ["one"], align: "start" },
    ]);
    expect(container.querySelector("section")?.getAttribute("data-align")).toBe("center");
    expect(container.querySelector("p")?.getAttribute("data-align")).toBe("start");
    expect(container.querySelector("ul")?.getAttribute("data-align")).toBe("start");
    expect(container.querySelector("h2")?.hasAttribute("data-align")).toBe(false);
  });

  it("a start section with a centred heading renders it with data-align center", () => {
    const { container } = renderSection("start", [
      { kind: "heading", level: 2, text: "Centred", icon: null, align: "center" },
      { kind: "paragraph", text: "At the start" },
    ]);
    expect(container.querySelector("h2")?.getAttribute("data-align")).toBe("center");
    expect(container.querySelector("p")?.hasAttribute("data-align")).toBe(false);
  });

  it("every one of the six kinds carries its own value on its root", () => {
    const blocks = PLAIN_BLOCKS.filter((b) => b.kind !== "icon").map((b) => ({ ...b, align: "center" }));
    const { container } = renderSection("start", blocks);
    for (const sel of ["h2", "p.blockParagraph", "ul.blockList", "blockquote", "figure", "div.blockLinksButtons", "ul.blockLinksList"]) {
      expect(container.querySelector(sel)?.getAttribute("data-align")).toBe("center");
    }
  });

  it("an unknown align value sets no attribute", () => {
    const { container } = renderSection("center", [{ kind: "paragraph", text: "x", align: "end" }]);
    expect(container.querySelector("p")?.hasAttribute("data-align")).toBe(false);
  });

  it("the icon block keeps its own align and no data-align", () => {
    const { container } = renderSection("center", [
      { kind: "icon", icon: { source: "library", id: "star" }, size: "md", align: "start" },
    ]);
    const root = container.querySelector(".blockIcon");
    expect(root?.className).toContain("blockIconStart");
    expect(root?.hasAttribute("data-align")).toBe(false);
  });
});

function blockRule(selector: string): string | undefined {
  const escaped = selector.replace(/[.[\]"]/g, (c) => `\\${c}`);
  const re = new RegExp(`(?:^|,\\s*)\\.richText ${escaped}(?:,[^{]*)? \\{([^}]*)\\}`, "m");
  return css.match(re)?.[1];
}

describe("the stylesheet's block overrides", () => {
  it("holds a start and a centre rule for each of the six kinds", () => {
    for (const align of ["start", "center"] as const) {
      const a = `[data-align="${align}"]`;
      const text = align === "center" ? "center" : "start";
      expect(blockRule(`.blockParagraph${a}`)).toMatch(new RegExp(`text-align: ${text};`));
      expect(blockRule(`.blockHeading${a}`)).toMatch(new RegExp(`justify-content: ${align === "center" ? "center" : "flex-start"};`));
      expect(blockRule(`.blockHeading${a} .blockHeadingText`)).toMatch(new RegExp(`flex-grow: ${align === "center" ? 0 : 1};`));
      expect(blockRule(`.blockList${a}`)).toMatch(new RegExp(`width: ${align === "center" ? "fit-content" : "auto"};`));
      expect(blockRule(`.blockList${a}`)).toMatch(new RegExp(`margin-inline: ${align === "center" ? "auto" : "0"};`));
      expect(blockRule(`.blockList${a}`)).toMatch(/text-align: start;/);
      expect(blockRule(`.blockQuote${a}`)).toMatch(new RegExp(`margin-inline: ${align === "center" ? "auto" : "0"};`));
      expect(blockRule(`.blockQuote${a}`)).toMatch(new RegExp(`text-align: ${text};`));
      expect(blockRule(`.blockMedia${a}`)).toMatch(new RegExp(`align-items: ${align === "center" ? "center" : "normal"};`));
      expect(blockRule(`.blockMedia${a} .blockMediaCredit`)).toMatch(new RegExp(`text-align: ${text};`));
      expect(css).toContain(`.richText .blockMedia${a} .blockMediaCaption,`);
      expect(blockRule(`.blockLinksButtons${a}`)).toMatch(new RegExp(`justify-content: ${align === "center" ? "center" : "flex-start"};`));
      expect(blockRule(`.blockLinksList${a}`)).toMatch(new RegExp(`align-items: ${align === "center" ? "center" : "normal"};`));
    }
  });

  it("the overrides win on specificity, not !important", () => {
    expect(css).not.toMatch(/!important/);
    expect(css).not.toMatch(/\.blockIcon[A-Za-z]*\[data-align/);
  });
});
