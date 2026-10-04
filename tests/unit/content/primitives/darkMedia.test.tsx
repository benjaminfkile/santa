// docs/site.md section 7.3. Dark mode for media entries: an entry with a
// dark version renders a light image and a dark image, each carrying the
// class CSS hides in the other theme; `invertInDark` alone adds the invert
// class; neither renders one plain image. Every place a media entry is
// drawn (media icon, logo, media background, sponsor logo) honours it.
// Library icons are untouched.

import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";

import { Media } from "../../../../src/content/primitives/Media";
import { Icon } from "../../../../src/content/primitives/Icon";
import { resolveIconDark } from "../../../../src/content/primitives/resolve";
import { Logo } from "../../../../src/content/Logo";
import { SectionFrame } from "../../../../src/content/SectionFrame";
import { SponsorGrid } from "../../../../src/content/sections/SponsorGrid/SponsorGrid";
import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { Presentation, Snapshot } from "../../../../src/contracts";

type Entry = NonNullable<NonNullable<ContentBundle["media"]>[string]>;

const LIGHT: Entry = {
  url: "https://cdn/light.jpg",
  kind: "raster",
  width: 1200,
  height: 800,
  alt: "Asset alt",
  variants: { "480": "https://cdn/light-480.webp", "960": "https://cdn/light-960.webp" },
  dark: null,
  invertInDark: false,
};

const WITH_DARK: Entry = {
  ...LIGHT,
  dark: {
    url: "https://cdn/dark.jpg",
    variants: { "480": "https://cdn/dark-480.webp", "960": "https://cdn/dark-960.webp" },
  },
};

const INVERT: Entry = { ...LIGHT, invertInDark: true };

// A dark version wins over invertInDark.
const BOTH: Entry = { ...WITH_DARK, invertInDark: true };

function bundle(entry: Entry): ContentBundle {
  return {
    content: {
      settings: { siteName: "Site", logoMedia: { mediaId: "m", alt: null } },
      pages: [],
      nav: [],
    } as unknown as ContentBundle["content"],
    media: { m: entry },
    icons: { "not-generated": "https://cdn/icons/x.svg" },
  };
}

function presentation(overrides: Partial<Presentation> = {}): Presentation {
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

function images(container: HTMLElement): HTMLImageElement[] {
  return Array.from(container.querySelectorAll("img"));
}

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("Media dark mode", () => {
  it("an entry with dark renders the light and the dark image with their classes", () => {
    const { container } = render(<Media media={{ mediaId: "m", alt: null }} bundle={bundle(WITH_DARK)} frame="wide" />);
    const [light, dark] = images(container);
    expect(images(container)).toHaveLength(2);
    expect(light.getAttribute("data-dark-mode")).toBe("light");
    expect(light.getAttribute("src")).toBe("https://cdn/light.jpg");
    expect(light.getAttribute("srcset")).toContain("https://cdn/light-480.webp 480w");
    expect(dark.getAttribute("data-dark-mode")).toBe("dark");
    expect(dark.getAttribute("src")).toBe("https://cdn/dark.jpg");
    expect(dark.getAttribute("srcset")).toBe("https://cdn/dark-480.webp 480w, https://cdn/dark-960.webp 960w");
    expect(dark.getAttribute("sizes")).toBe(light.getAttribute("sizes"));
    expect(light.getAttribute("alt")).toBe("Asset alt");
    expect(dark.getAttribute("alt")).toBe("Asset alt");
  });

  it("invertInDark alone renders one image with the invert rule", () => {
    const { container } = render(<Media media={{ mediaId: "m", alt: null }} bundle={bundle(INVERT)} />);
    expect(images(container)).toHaveLength(1);
    expect(images(container)[0].getAttribute("data-dark-mode")).toBe("invert");
  });

  it("a dark version wins over invertInDark", () => {
    const { container } = render(<Media media={{ mediaId: "m", alt: null }} bundle={bundle(BOTH)} />);
    expect(images(container).map((i) => i.getAttribute("data-dark-mode"))).toEqual(["light", "dark"]);
  });

  it("neither renders one plain image", () => {
    const { container } = render(<Media media={{ mediaId: "m", alt: null }} bundle={bundle(LIGHT)} className="x" />);
    expect(images(container)).toHaveLength(1);
    const img = images(container)[0];
    expect(img.hasAttribute("data-dark-mode")).toBe(false);
    expect(img.getAttribute("class")).toBe("x");
  });

  it("an svg entry with dark renders both images with src only", () => {
    const svg: Entry = { ...WITH_DARK, kind: "svg", url: "https://cdn/light.svg", variants: {}, dark: { url: "https://cdn/dark.svg", variants: {} } };
    const { container } = render(<Media media={{ mediaId: "m", alt: null }} bundle={bundle(svg)} />);
    const [light, dark] = images(container);
    expect(light.getAttribute("src")).toBe("https://cdn/light.svg");
    expect(dark.getAttribute("src")).toBe("https://cdn/dark.svg");
    expect(light.hasAttribute("srcset")).toBe(false);
    expect(dark.hasAttribute("srcset")).toBe(false);
  });
});

describe("the dark mode stylesheet", () => {
  const css = readFileSync(
    resolve(__dirname, "..", "..", "..", "..", "src", "content", "primitives", "DarkMedia.module.css"),
    "utf8",
  );
  it("hides the light image in dark mode and the dark image otherwise", () => {
    expect(css).toMatch(/:root\[data-theme="dark"\] \.lightOnly \{\s*display: none;/);
    expect(css).toMatch(/:root:not\(\[data-theme="dark"\]\) \.darkOnly \{\s*display: none;/);
  });
  it("inverts in dark mode and keeps hues", () => {
    expect(css).toMatch(/:root\[data-theme="dark"\] \.invertInDark \{\s*filter: invert\(1\) hue-rotate\(180deg\);/);
  });
});

describe("resolveIconDark", () => {
  it("takes the dark 480 variant for a raster, the dark url for svg, and nothing for a library icon", () => {
    expect(resolveIconDark(bundle(WITH_DARK), { source: "media", id: "m" })).toEqual({ dark: "https://cdn/dark-480.webp", invertInDark: false });
    const svg: Entry = { ...WITH_DARK, kind: "svg" };
    expect(resolveIconDark(bundle(svg), { source: "media", id: "m" }).dark).toBe("https://cdn/dark.jpg");
    expect(resolveIconDark(bundle(INVERT), { source: "media", id: "m" })).toEqual({ dark: null, invertInDark: true });
    expect(resolveIconDark(bundle(BOTH), { source: "library", id: "not-generated" })).toEqual({ dark: null, invertInDark: false });
  });
});

function seedSponsor(): void {
  act(() => {
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        content: {} as unknown,
        sponsors: [{ id: 1, name: "Alpha", logoMediaId: "m" }],
      } as unknown as Snapshot,
    });
  });
}

type Path = {
  name: string;
  seed?: () => void;
  draw: (b: ContentBundle) => ReactElement;
  // Images of the entry inside the rendered tree.
  pick: (container: HTMLElement) => HTMLImageElement[];
};

const PATHS: Path[] = [
  {
    name: "media icon",
    draw: (b) => <Icon icon={{ source: "media", id: "m" }} bundle={b} alt="Icon" />,
    pick: images,
  },
  {
    name: "section frame icon",
    draw: (b) => (
      <SectionFrame presentation={presentation({ iconBefore: { source: "media", id: "m" } })} bundle={b} kind="rich_text">
        <p>x</p>
      </SectionFrame>
    ),
    pick: (c) => images(c.querySelector('[data-testid="section-frame-icon-before"]') as HTMLElement),
  },
  {
    name: "logo",
    draw: (b) => <Logo bundle={b} height={40} />,
    pick: (c) => images(c.querySelector('[data-testid="site-logo"]') as HTMLElement),
  },
  {
    name: "media background",
    draw: (b) => (
      <SectionFrame
        presentation={presentation({ background: { kind: "media", media: { mediaId: "m", alt: null }, overlay: 0.5 } })}
        bundle={b}
        kind="rich_text"
      >
        <p>x</p>
      </SectionFrame>
    ),
    pick: (c) => images(c.querySelector('[data-testid="section-frame-background"]') as HTMLElement),
  },
  {
    name: "sponsor logo",
    seed: seedSponsor,
    draw: (b) => <SponsorGrid data={{}} items={[]} bundle={b} />,
    pick: (c) => Array.from(c.querySelectorAll('img[data-testid="sponsor-logo"]')),
  },
];

describe.each(PATHS)("$name honours dark mode", ({ seed, draw, pick }) => {
  const modes = (entry: Entry): (string | null)[] => {
    seed?.();
    const { container } = render(draw(bundle(entry)));
    const found = pick(container).map((i) => i.getAttribute("data-dark-mode"));
    cleanup();
    return found;
  };

  it("draws the light and the dark image for an entry with dark", () => {
    expect(modes(WITH_DARK)).toEqual(["light", "dark"]);
  });
  it("inverts for invertInDark alone", () => {
    expect(modes(INVERT)).toEqual(["invert"]);
  });
  it("draws one plain image for neither", () => {
    expect(modes(LIGHT)).toEqual([null]);
  });
});

describe("library icons", () => {
  it("are untouched by dark mode", () => {
    const { container } = render(<Icon icon={{ source: "library", id: "not-generated" }} bundle={bundle(BOTH)} alt="Star" />);
    const all = images(container);
    expect(all).toHaveLength(1);
    expect(all[0].hasAttribute("data-dark-mode")).toBe(false);
  });
});
