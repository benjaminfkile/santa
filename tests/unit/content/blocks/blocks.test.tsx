// docs/site.md section 7.5. The eight block components render their data
// through the inline grammar and primitives.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ContentBundle } from "../../../../src/store/types";
import { HeadingBlock } from "../../../../src/content/blocks/HeadingBlock";
import { ParagraphBlock } from "../../../../src/content/blocks/ParagraphBlock";
import { ListBlock } from "../../../../src/content/blocks/ListBlock";
import { QuoteBlock } from "../../../../src/content/blocks/QuoteBlock";
import { MediaBlock } from "../../../../src/content/blocks/MediaBlock";
import { LinksBlock } from "../../../../src/content/blocks/LinksBlock";
import { IconBlock } from "../../../../src/content/blocks/IconBlock";
import { DividerBlock } from "../../../../src/content/blocks/DividerBlock";

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

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
  icons: { star: "https://cdn/star.svg", candy: "https://cdn/candy.svg" },
};

describe("HeadingBlock", () => {
  it("renders the tag matching level with the text", () => {
    const { container } = render(
      wrap(<HeadingBlock data={{ kind: "heading", level: 1, text: "Hi", icon: null }} bundle={bundle} />),
    );
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toContain("Hi");
  });

  it("level 2 renders an <h2>", () => {
    const { container } = render(
      wrap(<HeadingBlock data={{ kind: "heading", level: 2, text: "Two", icon: null }} bundle={bundle} />),
    );
    expect(container.querySelector("h2")).not.toBeNull();
  });

  it("renders an icon before the text when set", () => {
    const { container } = render(
      wrap(
        <HeadingBlock
          data={{ kind: "heading", level: 2, text: "Hi", icon: { source: "library", id: "star" } }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector(".block-heading__icon")).not.toBeNull();
  });
});

describe("ParagraphBlock", () => {
  it("renders a paragraph with inline grammar", () => {
    const { container } = render(
      wrap(<ParagraphBlock data={{ kind: "paragraph", text: "**bold** and *em*" }} bundle={bundle} />),
    );
    expect(container.querySelector("p")).not.toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("em");
  });
});

describe("ListBlock", () => {
  it("bullet uses <ul>", () => {
    const { container } = render(
      wrap(
        <ListBlock
          data={{ kind: "list", style: "bullet", icon: null, items: ["a", "b"] }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("li").length).toBe(2);
  });

  it("number uses <ol>", () => {
    const { container } = render(
      wrap(
        <ListBlock
          data={{ kind: "list", style: "number", icon: null, items: ["a"] }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("ol")).not.toBeNull();
  });

  it("icon style renders the icon before each item", () => {
    const { container } = render(
      wrap(
        <ListBlock
          data={{
            kind: "list",
            style: "icon",
            icon: { source: "library", id: "star" },
            items: ["one", "two"],
          }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelectorAll(".block-list__icon").length).toBe(2);
  });
});

describe("QuoteBlock", () => {
  it("renders a blockquote and a cite when attribution is set", () => {
    const { container } = render(
      wrap(
        <QuoteBlock
          data={{ kind: "quote", text: "Bells", attribution: "Ada" }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("cite")?.textContent).toContain("Ada");
  });

  it("no cite when attribution is null", () => {
    const { container } = render(
      wrap(
        <QuoteBlock
          data={{ kind: "quote", text: "Bells", attribution: null }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("cite")).toBeNull();
  });
});

describe("MediaBlock", () => {
  it("renders a figure with an image and caption", () => {
    const { container } = render(
      wrap(
        <MediaBlock
          data={{
            kind: "media",
            media: { mediaId: "photo", alt: null },
            caption: "A photo",
            size: "full",
          }}
          bundle={bundle}
          frame="narrow"
        />,
      ),
    );
    expect(container.querySelector("figure")).not.toBeNull();
    expect(container.querySelector("figcaption")?.textContent).toBe("A photo");
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("small size overrides sizes to 320px", () => {
    const { container } = render(
      wrap(
        <MediaBlock
          data={{
            kind: "media",
            media: { mediaId: "photo", alt: null },
            caption: null,
            size: "small",
          }}
          bundle={bundle}
          frame="narrow"
        />,
      ),
    );
    expect(container.querySelector("img")?.getAttribute("sizes")).toBe("320px");
  });
});

describe("LinksBlock", () => {
  it("buttons style renders each link as a <a>", () => {
    const { container } = render(
      wrap(
        <LinksBlock
          data={{
            kind: "links",
            style: "buttons",
            links: [
              { label: "One", href: "https://example.org/", icon: null, newTab: false },
              { label: "Two", href: "https://example.org/", icon: null, newTab: false },
            ],
          }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelectorAll("a").length).toBe(2);
  });

  it("list style uses a <ul>", () => {
    const { container } = render(
      wrap(
        <LinksBlock
          data={{
            kind: "links",
            style: "list",
            links: [{ label: "One", href: "/foo", icon: null, newTab: false }],
          }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("ul")).not.toBeNull();
  });
});

describe("IconBlock", () => {
  it("renders one icon", () => {
    const { container } = render(
      wrap(
        <IconBlock
          data={{
            kind: "icon",
            icon: { source: "library", id: "star" },
            size: "md",
            align: "center",
          }}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("img")?.getAttribute("width")).toBe("48");
    expect(container.querySelector(".block-icon--center")).not.toBeNull();
  });
});

describe("DividerBlock", () => {
  it("renders a role=separator", () => {
    const { container } = render(
      wrap(<DividerBlock data={{ kind: "divider", style: "line" }} bundle={bundle} />),
    );
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelector(".block-divider--line")).not.toBeNull();
  });
});
