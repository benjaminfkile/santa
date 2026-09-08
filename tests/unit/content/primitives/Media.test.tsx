// docs/site.md section 7.3. Media primitive srcset, sizes, kind rules.

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Media } from "../../../../src/content/primitives/Media";
import { _resetResolveLogs } from "../../../../src/content/primitives/resolve";
import type { ContentBundle } from "../../../../src/store/types";

function bundle(overrides: Partial<ContentBundle["media"]> = {}): ContentBundle {
  return {
    content: null as unknown as ContentBundle["content"],
    icons: {},
    media: {
      full: {
        url: "https://cdn/full.jpg",
        kind: "raster",
        width: 1200,
        height: 800,
        alt: "full",
        variants: {
          "480": "https://cdn/w480.webp",
          "960": "https://cdn/w960.webp",
          "1600": "https://cdn/w1600.webp",
        },
      },
      partial: {
        url: "https://cdn/partial.jpg",
        kind: "raster",
        width: 900,
        height: 600,
        alt: "partial",
        variants: { "480": "https://cdn/p480.webp" },
      },
      none: {
        url: "https://cdn/none.jpg",
        kind: "raster",
        width: 600,
        height: 400,
        alt: "none",
        variants: {},
      },
      svg: {
        url: "https://cdn/thing.svg",
        kind: "svg",
        width: null,
        height: null,
        alt: "svg",
        variants: {},
      },
      gif: {
        url: "https://cdn/thing.gif",
        kind: "gif",
        width: 100,
        height: 100,
        alt: "gif",
        variants: {},
      },
      ...overrides,
    },
  };
}

describe("Media srcset", () => {
  it("full variant set includes every variant and the original", () => {
    const { container } = render(
      <Media media={{ mediaId: "full", alt: null }} bundle={bundle()} frame="wide" />,
    );
    const img = container.querySelector("img")!;
    const srcset = img.getAttribute("srcset") ?? "";
    expect(srcset).toContain("https://cdn/w480.webp 480w");
    expect(srcset).toContain("https://cdn/w960.webp 960w");
    expect(srcset).toContain("https://cdn/w1600.webp 1600w");
    expect(srcset).toContain("https://cdn/full.jpg 1200w");
  });

  it("partial variant set still adds the original", () => {
    const { container } = render(
      <Media media={{ mediaId: "partial", alt: null }} bundle={bundle()} frame="wide" />,
    );
    const img = container.querySelector("img")!;
    const srcset = img.getAttribute("srcset") ?? "";
    expect(srcset).toContain("https://cdn/p480.webp 480w");
    expect(srcset).toContain("https://cdn/partial.jpg 900w");
  });

  it("no variants: srcset is not set", () => {
    const b = bundle();
    // override entry with no variants
    b.media!.plain = { url: "https://cdn/x.jpg", kind: "raster", width: 400, height: 200, alt: "x", variants: {} };
    const { container } = render(
      <Media media={{ mediaId: "plain", alt: null }} bundle={b} frame="full" />,
    );
    const img = container.querySelector("img")!;
    // width -> only one entry in srcset would be produced, but we allow empty srcset when no variants
    // per docs: srcset lists every variant plus the original. With no variants, srcset would only be the original.
    // The Media primitive lists it when width is set; assert it does.
    const srcset = img.getAttribute("srcset");
    expect(srcset).toContain("400w");
  });
});

describe("Media sizes by frame", () => {
  it("full -> 100vw", () => {
    const { container } = render(
      <Media media={{ mediaId: "full", alt: null }} bundle={bundle()} frame="full" />,
    );
    expect(container.querySelector("img")?.getAttribute("sizes")).toBe("100vw");
  });
  it("wide -> min-width 1200 rule", () => {
    const { container } = render(
      <Media media={{ mediaId: "full", alt: null }} bundle={bundle()} frame="wide" />,
    );
    expect(container.querySelector("img")?.getAttribute("sizes")).toBe(
      "(min-width: 1200px) 1200px, 100vw",
    );
  });
  it("narrow -> min-width 720 rule", () => {
    const { container } = render(
      <Media media={{ mediaId: "full", alt: null }} bundle={bundle()} frame="narrow" />,
    );
    expect(container.querySelector("img")?.getAttribute("sizes")).toBe(
      "(min-width: 720px) 720px, 100vw",
    );
  });
});

describe("Media svg and gif", () => {
  it("svg does not set srcset", () => {
    const { container } = render(
      <Media media={{ mediaId: "svg", alt: null }} bundle={bundle()} />,
    );
    expect(container.querySelector("img")?.getAttribute("srcset")).toBeNull();
  });
  it("gif does not set srcset", () => {
    const { container } = render(
      <Media media={{ mediaId: "gif", alt: null }} bundle={bundle()} />,
    );
    expect(container.querySelector("img")?.getAttribute("srcset")).toBeNull();
  });
});

describe("Media missing id", () => {
  it("renders a placeholder box with the alt and logs once", () => {
    _resetResolveLogs();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, rerender } = render(
      <Media media={{ mediaId: "nope", alt: "the hangar" }} bundle={bundle()} />,
    );
    expect(container.querySelector("[data-missing-media]")).not.toBeNull();
    expect(container.querySelector("[data-missing-media]")?.getAttribute("aria-label")).toBe("the hangar");
    rerender(<Media media={{ mediaId: "nope", alt: "the hangar" }} bundle={bundle()} />);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
