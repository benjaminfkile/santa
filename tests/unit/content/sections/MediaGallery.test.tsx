// docs/site.md section 7.4. Media gallery in each layout: single, grid,
// carousel; a per-item link wraps the image.

import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MediaGallery } from "../../../../src/content/sections/MediaGallery/MediaGallery";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {
    a: { url: "https://cdn/a.jpg", kind: "raster", width: 800, height: 600, alt: "a", variants: {} },
    b: { url: "https://cdn/b.jpg", kind: "raster", width: 800, height: 600, alt: "b", variants: {} },
    c: { url: "https://cdn/c.jpg", kind: "raster", width: 800, height: 600, alt: "c", variants: {} },
  },
  icons: {},
};

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

function items() {
  return [
    { id: 1, data: { media: { mediaId: "a", alt: null }, caption: "one", link: null } },
    { id: 2, data: { media: { mediaId: "b", alt: null }, caption: null, link: null } },
    { id: 3, data: { media: { mediaId: "c", alt: null }, caption: null, link: null } },
  ];
}

describe("MediaGallery", () => {
  it("single renders one figure", () => {
    const { container } = render(
      wrap(<MediaGallery data={{ layout: "single", columns: 3 }} items={items()} bundle={bundle} />),
    );
    expect(container.querySelector(".media-gallery--single")).not.toBeNull();
    expect(container.querySelectorAll("figure").length).toBe(1);
  });

  it("grid renders a figure per item with the column count", () => {
    const { container } = render(
      wrap(<MediaGallery data={{ layout: "grid", columns: 3 }} items={items()} bundle={bundle} />),
    );
    const grid = container.querySelector(".media-gallery--grid") as HTMLElement;
    expect(grid).not.toBeNull();
    expect(container.querySelectorAll("figure").length).toBe(3);
    expect(grid.style.getPropertyValue("--media-columns")).toBe("3");
  });

  it("carousel exposes prev and next controls", () => {
    const { container } = render(
      wrap(<MediaGallery data={{ layout: "carousel", columns: 3 }} items={items()} bundle={bundle} />),
    );
    expect(container.querySelector(".media-gallery--carousel")).not.toBeNull();
    expect(container.querySelector(".media-gallery__prev")).not.toBeNull();
    expect(container.querySelector(".media-gallery__next")).not.toBeNull();
  });

  it("carousel next changes the active slide", () => {
    const { container } = render(
      wrap(<MediaGallery data={{ layout: "carousel", columns: 3 }} items={items()} bundle={bundle} />),
    );
    const wrapEl = container.querySelector(".media-gallery--carousel") as HTMLElement;
    const next = container.querySelector(".media-gallery__next") as HTMLButtonElement;
    expect(wrapEl.dataset.index).toBe("0");
    act(() => next.click());
    expect(wrapEl.dataset.index).toBe("1");
  });

  it("a per-item link wraps the figure inner", () => {
    const withLink = [
      {
        id: 1,
        data: {
          media: { mediaId: "a", alt: null },
          caption: null,
          link: { label: "go", href: "https://example.org/", icon: null, newTab: true },
        },
      },
    ];
    const { container } = render(
      wrap(<MediaGallery data={{ layout: "single", columns: 3 }} items={withLink} bundle={bundle} />),
    );
    expect(container.querySelector("a")).not.toBeNull();
  });
});
