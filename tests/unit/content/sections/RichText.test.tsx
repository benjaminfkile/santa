// docs/site.md section 7.4. RichText renders each block through
// registry.blocks and skips unknown block kinds. Section 7.5: under a
// centre or end section align every block kind follows the align, and a
// start section keeps every block at the start.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RichText } from "../../../../src/content/sections/RichText/RichText";
import { SectionFrame } from "../../../../src/content/SectionFrame";
import type { ContentBundle } from "../../../../src/store/types";
import type { Presentation } from "../../../../src/contracts";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe("RichText", () => {
  it("renders one element per known block", () => {
    const { container } = render(
      wrap(
        <RichText
          data={{
            blocks: [
              { kind: "heading", level: 2, text: "One", icon: null },
              { kind: "paragraph", text: "Two" },
            ],
          }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("h2")?.textContent).toContain("One");
    expect(container.querySelector("p")?.textContent).toBe("Two");
  });

  it("skips unknown block kinds", () => {
    const { container } = render(
      wrap(
        <RichText
          data={{
            blocks: [
              { kind: "paragraph", text: "kept" },
              { kind: "bogus", text: "gone" },
            ],
          }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    expect(container.textContent).toBe("kept");
  });
});

const css = readFileSync(
  resolve(__dirname, "..", "..", "..", "..", "src", "content", "sections", "RichText", "RichText.module.css"),
  "utf8",
);

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

function renderAligned(align: Presentation["align"]) {
  return render(
    wrap(
      <SectionFrame presentation={presentation(align)} bundle={bundle} kind="rich_text">
        <RichText
          data={{
            blocks: [
              { kind: "heading", level: 2, text: "Give", icon: null },
              { kind: "paragraph", text: "Every gift helps" },
              { kind: "quote", text: "Ho ho", attribution: null },
              { kind: "list", style: "bullet", icon: null, items: ["one", "two"] },
              { kind: "links", style: "buttons", links: [] },
            ],
          }}
          items={[]}
          bundle={bundle}
        />
      </SectionFrame>,
    ),
  );
}

function rule(align: string, cls: string): string | undefined {
  const re = new RegExp(`:global\\(section\\[data-align="${align}"\\]\\) \\.${cls} \\{([^}]*)\\}`);
  return css.match(re)?.[1];
}

describe("RichText section align", () => {
  it("a centred section renders the align hook around the rich text", () => {
    const { container } = renderAligned("center");
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-align")).toBe("center");
    expect(section?.querySelector("h2")?.textContent).toContain("Give");
    expect(section?.querySelector("blockquote")).not.toBeNull();
    expect(section?.querySelector("ul")).not.toBeNull();
  });

  it("carries the centre rules for heading, links, media, quote, and list", () => {
    expect(rule("center", "richText")).toMatch(/margin-inline: auto;/);
    expect(rule("center", "blockHeading")).toMatch(/justify-content: center;/);
    expect(rule("center", "blockLinksButtons")).toMatch(/justify-content: center;/);
    expect(rule("center", "blockLinksList")).toMatch(/align-items: center;/);
    expect(rule("center", "blockMedia")).toMatch(/align-items: center;/);
    expect(rule("center", "blockMedia")).toMatch(/margin-inline: auto;/);
    expect(rule("center", "blockMediaCaption")).toMatch(/text-align: center;/);
    expect(rule("center", "blockQuote")).toMatch(/margin-inline: auto;/);
    expect(rule("center", "blockQuote")).toMatch(/text-align: center;/);
    expect(rule("center", "blockList")).toMatch(/width: fit-content;/);
    expect(rule("center", "blockList")).toMatch(/margin-inline: auto;/);
    expect(rule("center", "blockList")).toMatch(/text-align: start;/);
  });

  it("carries the end rules for heading, links, media, quote, and list", () => {
    expect(rule("end", "richText")).toMatch(/margin-inline-start: auto;/);
    expect(rule("end", "richText")).toMatch(/text-align: end;/);
    expect(rule("end", "blockHeading")).toMatch(/justify-content: flex-end;/);
    expect(rule("end", "blockLinksButtons")).toMatch(/justify-content: flex-end;/);
    expect(rule("end", "blockLinksList")).toMatch(/align-items: flex-end;/);
    expect(rule("end", "blockMedia")).toMatch(/align-items: flex-end;/);
    expect(rule("end", "blockMedia")).toMatch(/margin-inline-start: auto;/);
    expect(rule("end", "blockMediaCaption")).toMatch(/text-align: end;/);
    expect(rule("end", "blockQuote")).toMatch(/margin-inline-start: auto;/);
    expect(rule("end", "blockQuote")).toMatch(/text-align: end;/);
    expect(rule("end", "blockList")).toMatch(/width: fit-content;/);
    expect(rule("end", "blockList")).toMatch(/margin-inline-start: auto;/);
    expect(rule("end", "blockList")).toMatch(/text-align: start;/);
  });

  it("a start section renders the start hook and no rule targets start", () => {
    const { container } = renderAligned("start");
    expect(container.querySelector("section")?.getAttribute("data-align")).toBe("start");
    expect(css).not.toMatch(/data-align="start"/);
    expect(css).toMatch(/\.blockHeading \{[^}]*display: flex;/);
    expect(css).not.toMatch(/^\.blockHeading \{[^}]*justify-content/m);
    expect(css).toMatch(/\.blockQuote \{[^}]*border-inline-start: 3px solid var\(--accent\);/);
    expect(css).toMatch(/\.blockList \{[^}]*padding-inline-start: 1\.25rem;/);
  });
});
