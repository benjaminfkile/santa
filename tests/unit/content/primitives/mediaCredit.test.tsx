// docs/site.md section 7.3. The credit line: a media entry drawn as a
// visible picture (a media section figure or a rich text media block)
// shows its non-null credit as one line directly under the image; a null
// credit shows nothing; section backgrounds, icons, the Logo, and sponsor
// logos never show it; the dark and small screen branches keep the line.

import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";

import { MediaGallery } from "../../../../src/content/sections/MediaGallery/MediaGallery";
import { MediaBlock } from "../../../../src/content/blocks/MediaBlock";
import { SectionFrame } from "../../../../src/content/SectionFrame";
import { Icon } from "../../../../src/content/primitives/Icon";
import { Logo } from "../../../../src/content/Logo";
import { SponsorGrid } from "../../../../src/content/sections/SponsorGrid/SponsorGrid";
import { SponsorCarousel } from "../../../../src/content/sections/SponsorCarousel/SponsorCarousel";
import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { Presentation, Snapshot } from "../../../../src/contracts";

type Entry = NonNullable<NonNullable<ContentBundle["media"]>[string]>;

const CREDIT = "Photo by Jordan Reyes for the Missoulian";

const PLAIN: Entry = {
  url: "https://cdn/photo.jpg",
  kind: "raster",
  width: 1200,
  height: 800,
  alt: "Photo",
  variants: { "480": "https://cdn/photo-480.webp" },
  dark: null,
  invertInDark: false,
  small: null,
  credit: CREDIT,
};

const DARK_AND_SMALL: Entry = {
  ...PLAIN,
  dark: { url: "https://cdn/photo-dark.jpg", variants: {} },
  small: {
    url: "https://cdn/photo-small.jpg",
    variants: {},
    dark: null,
    invertInDark: true,
  },
};

function bundle(entry: Entry): ContentBundle {
  return {
    content: {
      settings: { siteName: "Site", logoMedia: { mediaId: "m", alt: null } },
      pages: [],
      nav: [],
    } as unknown as ContentBundle["content"],
    media: { m: entry },
    icons: {},
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

const REF = { mediaId: "m", alt: null };

type Context = { name: string; draw: (b: ContentBundle) => ReactElement };

const FIGURES: Context[] = [
  {
    name: "media section",
    draw: (b) => (
      <MemoryRouter>
        <MediaGallery
          data={{ layout: "single" }}
          items={[{ id: 1, data: { media: REF, caption: "Caption", link: null } }]}
          bundle={b}
        />
      </MemoryRouter>
    ),
  },
  {
    name: "rich text media block",
    draw: (b) => (
      <MemoryRouter>
        <MediaBlock data={{ kind: "media", media: REF, caption: "Caption", size: "medium" }} bundle={b} />
      </MemoryRouter>
    ),
  },
];

function credits(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="media-credit"]'));
}

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe.each(FIGURES)("the credit line in a $name", ({ draw }) => {
  it("renders the credit directly under the image, before the caption", () => {
    const { container } = render(draw(bundle(PLAIN)));
    const lines = credits(container);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line.textContent).toBe(CREDIT);
    expect(line.closest("figure")).not.toBeNull();
    expect(line.previousElementSibling?.tagName).toBe("IMG");
    expect(line.nextElementSibling?.tagName).toBe("FIGCAPTION");
  });

  it("renders nothing for a null, absent, or blank credit", () => {
    for (const credit of [null, undefined, "  "]) {
      const { container } = render(draw(bundle({ ...PLAIN, credit })));
      expect(credits(container)).toHaveLength(0);
      expect(container.querySelector("img")).not.toBeNull();
      cleanup();
    }
  });

  it("keeps one line under the dark and small screen branches", () => {
    const { container } = render(draw(bundle(DARK_AND_SMALL)));
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.map((i) => `${i.getAttribute("data-screen")}:${i.getAttribute("data-dark-mode")}`)).toEqual([
      "wide:light",
      "wide:dark",
      "small:invert",
    ]);
    const lines = credits(container);
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe(CREDIT);
    expect(lines[0].previousElementSibling).toBe(imgs[imgs.length - 1]);
    expect(lines[0].className).not.toMatch(/wideOnly|smallOnly|lightOnly|darkOnly/);
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

const NEVER: (Context & { seed?: () => void })[] = [
  {
    name: "section background",
    draw: (b) => (
      <SectionFrame
        presentation={presentation({ background: { kind: "media", media: REF, overlay: 0.5 } })}
        bundle={b}
        kind="rich_text"
      >
        <p>x</p>
      </SectionFrame>
    ),
  },
  {
    name: "section icon",
    draw: (b) => (
      <SectionFrame presentation={presentation({ iconBefore: { source: "media", id: "m" } })} bundle={b} kind="rich_text">
        <p>x</p>
      </SectionFrame>
    ),
  },
  { name: "media icon", draw: (b) => <Icon icon={{ source: "media", id: "m" }} bundle={b} alt="Icon" /> },
  { name: "logo", draw: (b) => <Logo bundle={b} height={40} /> },
  { name: "sponsor grid logo", seed: seedSponsor, draw: (b) => <SponsorGrid data={{}} items={[]} bundle={b} /> },
  {
    name: "sponsor carousel logo",
    seed: seedSponsor,
    draw: (b) => <SponsorCarousel data={{}} items={[]} bundle={b} />,
  },
];

describe.each(NEVER)("a $name", ({ seed, draw }) => {
  it("draws the entry without a credit line", () => {
    seed?.();
    const { container } = render(draw(bundle(PLAIN)));
    expect(container.querySelector("img")).not.toBeNull();
    expect(credits(container)).toHaveLength(0);
    expect(container.textContent ?? "").not.toContain(CREDIT);
  });
});

describe("the credit stylesheet", () => {
  const css = readFileSync(
    resolve(__dirname, "..", "..", "..", "..", "src", "content", "primitives", "MediaCredit.module.css"),
    "utf8",
  );
  it("is small, muted through the theme token, and wraps", () => {
    expect(css).toMatch(/color: var\(--text-dim\)/);
    expect(css).toMatch(/font-size: 0\.75rem/);
    expect(css).toMatch(/overflow-wrap: anywhere/);
  });
});
