// docs/site.md section 7.3. The display setting on icons and media:
// displayStyle reads each key, ignores values outside the contract,
// sizePx beats preset sizes, and no display leaves the DOM unchanged.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { displayStyle, displaySizePx } from "../../../../src/content/primitives/display";
import { Icon } from "../../../../src/content/primitives/Icon";
import { Media } from "../../../../src/content/primitives/Media";
import { Hero } from "../../../../src/content/sections/Hero/Hero";
import { MediaBlock } from "../../../../src/content/blocks/MediaBlock";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {
    photo: {
      url: "https://cdn/photo.jpg",
      kind: "raster",
      width: 800,
      height: 600,
      alt: "photo",
      variants: { "480": "https://cdn/photo-480.webp" },
    },
  } as unknown as ContentBundle["media"],
  icons: { star: "https://cdn/star.svg" },
};

const css = readFileSync(
  resolve(__dirname, "..", "..", "..", "..", "src", "content", "primitives", "Display.module.css"),
  "utf8",
);

describe("displayStyle", () => {
  it("sizePx sizes an icon box on both sides", () => {
    const d = displayStyle({ sizePx: 40 }, "icon");
    expect(d.sizePx).toBe(40);
    expect(d.style).toMatchObject({ width: 40, height: 40 });
  });

  it("sizePx sets a media width with height auto", () => {
    const d = displayStyle({ sizePx: 200 }, "media");
    expect(d.style).toEqual({ width: 200 });
    expect(d.imageStyle).toMatchObject({ width: "100%", height: "auto" });
  });

  it("sizePx with fit cover makes a media square", () => {
    const d = displayStyle({ sizePx: 200, fit: "cover" }, "media");
    expect(d.style).toEqual({ width: 200, height: 200 });
    expect(d.imageStyle).toMatchObject({ width: "100%", height: "100%", objectFit: "cover" });
  });

  it("fit sets object-fit", () => {
    expect(displayStyle({ fit: "contain" }).imageStyle.objectFit).toBe("contain");
    expect(displayStyle({ fit: "cover" }).imageStyle.objectFit).toBe("cover");
  });

  it("shape names the radius; none adds nothing", () => {
    expect(displayStyle({ shape: "circle" }).data["data-display-shape"]).toBe("circle");
    expect(displayStyle({ shape: "rounded" }).data["data-display-shape"]).toBe("rounded");
    expect(displayStyle({ shape: "square" }).data["data-display-shape"]).toBe("square");
    expect(displayStyle({ shape: "none" }).data).toEqual({});
    expect(css).toMatch(/\.shapeCircle \{ border-radius: 50%;/);
    expect(css).toMatch(/\.shapeRounded \{ border-radius: var\(--radius-md\);/);
    expect(css).toMatch(/\.shapeSquare \{ border-radius: 0;/);
  });

  it("paddingPx pads the wrapper", () => {
    expect(displayStyle({ paddingPx: 0 }).style.padding).toBe(0);
    expect(displayStyle({ paddingPx: 12 }).style.padding).toBe(12);
  });

  it("background names the token; none adds nothing", () => {
    for (const token of ["surface", "muted", "accent", "night"] as const) {
      expect(displayStyle({ background: token }).data["data-display-background"]).toBe(token);
    }
    expect(displayStyle({ background: "none" }).data).toEqual({});
    expect(css).toContain(".bgSurface { background: var(--panel); }");
    expect(css).toContain(".bgMuted { background: var(--panel-2); }");
    expect(css).toContain(".bgAccent { background: var(--accent);");
    expect(css).toContain(".bgNight { background: var(--ground);");
  });

  it("shadow adds var(--shadow) only when true", () => {
    expect(displayStyle({ shadow: true }).data["data-display-shadow"]).toBe("true");
    expect(displayStyle({ shadow: false }).data).toEqual({});
    expect(css).toContain(".shadow { box-shadow: var(--shadow); }");
  });

  it("align names the placement", () => {
    for (const align of ["start", "center", "end"] as const) {
      expect(displayStyle({ align }).data["data-display-align"]).toBe(align);
    }
    expect(css).toContain(".alignCenter { margin-inline: auto; }");
    expect(css).toContain(".alignEnd { margin-inline-start: auto; }");
  });

  it("ignores values outside the schema", () => {
    const d = displayStyle(
      { sizePx: 4, fit: "fill", shape: "star", paddingPx: 99, background: "red", shadow: "yes", align: "left" },
      "icon",
    );
    expect(d.sizePx).toBeNull();
    expect(d.style).toEqual({});
    expect(d.imageStyle).toEqual({});
    expect(d.data).toEqual({});
    expect(displaySizePx({ sizePx: 601 })).toBeNull();
    expect(displaySizePx({ sizePx: 12 })).toBe(12);
    expect(displaySizePx(null)).toBeNull();
  });
});

describe("display on the primitives", () => {
  it("a hero icon with sizePx 180 renders 180 whatever iconSize says", () => {
    for (const iconSize of ["sm", "xl"] as const) {
      const { getByTestId, unmount } = render(
        <MemoryRouter>
          <Hero
            data={{ title: "Hi", icon: { source: "media", id: "photo", display: { sizePx: 180 } }, links: [], iconSize }}
            items={[]}
            bundle={bundle}
          />
        </MemoryRouter>,
      );
      const box = getByTestId("hero-icon");
      expect(box.style.width).toBe("180px");
      expect(box.dataset.iconSize).toBe("180");
      const img = box.querySelector("img")!;
      expect(img.getAttribute("width")).toBe("180");
      expect(img.getAttribute("height")).toBe("180");
      unmount();
    }
  });

  it("sizePx beats the size an icon's caller passes", () => {
    const { container } = render(
      <Icon icon={{ source: "library", id: "star", display: { sizePx: 64 } }} bundle={bundle} decorative size={24} />,
    );
    const wrapper = container.querySelector<HTMLElement>("[data-display='icon']")!;
    expect(wrapper.style.width).toBe("64px");
    expect(wrapper.querySelector("svg, img")?.getAttribute("width")).toBe("64");
  });

  it("a media block with shape circle and fit cover", () => {
    const { container } = render(
      <MediaBlock
        data={{ media: { mediaId: "photo", alt: null, display: { sizePx: 160, shape: "circle", fit: "cover" } }, size: "small" }}
        bundle={bundle}
      />,
    );
    const wrapper = container.querySelector<HTMLElement>("[data-display='media']")!;
    expect(wrapper.dataset.displayShape).toBe("circle");
    expect(wrapper.style.width).toBe("160px");
    expect(wrapper.style.height).toBe("160px");
    const img = wrapper.querySelector("img")!;
    expect(img.style.objectFit).toBe("cover");
    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("100%");
    expect(img.getAttribute("sizes")).toBe("160px");
  });

  it("no display leaves the DOM unchanged", () => {
    const plainIcon = render(<Icon icon={{ source: "media", id: "photo" }} bundle={bundle} decorative size={24} />);
    const nullIcon = render(<Icon icon={{ source: "media", id: "photo", display: null }} bundle={bundle} decorative size={24} />);
    expect(nullIcon.container.innerHTML).toBe(plainIcon.container.innerHTML);
    expect(plainIcon.container.querySelector("[data-display]")).toBeNull();
    expect(plainIcon.container.firstElementChild?.tagName).toBe("IMG");

    const plainMedia = render(<Media media={{ mediaId: "photo", alt: null }} bundle={bundle} />);
    const nullMedia = render(<Media media={{ mediaId: "photo", alt: null, display: null }} bundle={bundle} />);
    expect(nullMedia.container.innerHTML).toBe(plainMedia.container.innerHTML);
    expect(plainMedia.container.firstElementChild?.tagName).toBe("IMG");
    expect(plainMedia.container.querySelector("img")?.getAttribute("style")).toBeNull();
  });
});
