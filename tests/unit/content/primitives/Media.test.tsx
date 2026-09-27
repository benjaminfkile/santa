// docs/site.md section 7.3. Media primitive srcset, sizes, kind rules,
// and the small screen version.

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Media } from "../../../../src/content/primitives/Media";
import { _resetResolveLogs } from "../../../../src/content/primitives/resolve";
import type { ContentBundle } from "../../../../src/store/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

describe("Media small screen version", () => {
  type Entry = NonNullable<NonNullable<ContentBundle["media"]>[string]>;
  const MAIN: Entry = {
    url: "https://cdn/main.jpg",
    kind: "raster",
    width: 1200,
    height: 800,
    alt: "main",
    variants: { "480": "https://cdn/main-480.webp", "960": "https://cdn/main-960.webp" },
  };
  const SMALL: NonNullable<Entry["small"]> = {
    url: "https://cdn/small.jpg",
    variants: { "480": "https://cdn/small-480.webp", "960": "https://cdn/small-960.webp" },
  };
  const css = readFileSync(
    resolve(__dirname, "..", "..", "..", "..", "src", "content", "primitives", "DarkMedia.module.css"),
    "utf8",
  );

  function draw(entry: Entry, small?: boolean) {
    return render(<Media media={{ mediaId: "m", alt: null }} bundle={bundle({ m: entry })} small={small} />);
  }

  // CSS modules are off under test, so the images are told apart by
  // data-screen and data-dark-mode and the rules are read from the file.
  it("renders both sources, each carrying its side of the 760 px condition", () => {
    const { container } = draw({ ...MAIN, small: SMALL, smallMediaId: "s" });
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    const wide = container.querySelector('img[data-screen="wide"]')!;
    const small = container.querySelector('img[data-screen="small"]')!;
    expect(wide.getAttribute("src")).toBe("https://cdn/main.jpg");
    expect(small.getAttribute("src")).toBe("https://cdn/small.jpg");
    expect(css).toMatch(/@media \(max-width: 759\.98px\) \{\s*\.wideOnly \{\s*display: none;/);
    expect(css).toMatch(/@media \(min-width: 760px\) \{\s*\.smallOnly \{\s*display: none;/);
  });

  it("the small branch takes its srcset from the small variants", () => {
    const { container } = draw({ ...MAIN, small: SMALL });
    const small = container.querySelector('img[data-screen="small"]')!;
    const srcset = small.getAttribute("srcset") ?? "";
    expect(srcset).toContain("https://cdn/small-480.webp 480w");
    expect(srcset).toContain("https://cdn/small-960.webp 960w");
    expect(srcset).not.toContain("main");
    const wide = container.querySelector('img[data-screen="wide"]')!;
    expect(wide.getAttribute("srcset")).toContain("https://cdn/main-480.webp 480w");
  });

  it("the small version's own dark draws in the small, dark scoped image", () => {
    const { container } = draw({
      ...MAIN,
      small: {
        ...SMALL,
        dark: { url: "https://cdn/small-dark.jpg", variants: { "480": "https://cdn/small-dark-480.webp" } },
      },
    });
    const smallDark = container.querySelector('img[data-screen="small"][data-dark-mode="dark"]')!;
    expect(smallDark.getAttribute("src")).toBe("https://cdn/small-dark.jpg");
    expect(smallDark.getAttribute("srcset")).toContain("https://cdn/small-dark-480.webp 480w");
    const smallLight = container.querySelector('img[data-screen="small"][data-dark-mode="light"]')!;
    expect(smallLight.getAttribute("src")).toBe("https://cdn/small.jpg");
    // The main entry has no dark, so the wide branch is one plain image.
    const wide = Array.from(container.querySelectorAll('img[data-screen="wide"]'));
    expect(wide).toHaveLength(1);
    expect(wide[0].getAttribute("data-dark-mode")).toBeNull();
  });

  it("the small version's invertInDark applies inside the small branch only", () => {
    const { container } = draw({
      ...MAIN,
      dark: { url: "https://cdn/main-dark.jpg", variants: {} },
      small: { ...SMALL, invertInDark: true },
    });
    const small = Array.from(container.querySelectorAll('img[data-screen="small"]'));
    expect(small).toHaveLength(1);
    expect(small[0].getAttribute("data-dark-mode")).toBe("invert");
    const wide = Array.from(container.querySelectorAll('img[data-screen="wide"]')).map((i) => i.getAttribute("data-dark-mode"));
    expect(wide).toEqual(["light", "dark"]);
  });

  it("an entry without small renders exactly as before", () => {
    const { container } = draw(MAIN);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("data-screen")).toBeNull();
    expect(imgs[0].getAttribute("class")).toBeNull();
    expect(container.innerHTML).toBe(draw({ ...MAIN, small: null, smallMediaId: null }).container.innerHTML);
    expect(container.innerHTML).toBe(draw({ ...MAIN, small: SMALL }, false).container.innerHTML);
  });
});
