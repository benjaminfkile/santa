// docs/site.md section 7.4. Hero renders title, tagline, icon, up to two
// links, picks a min-height token by height, and sizes the icon by
// iconSize (a round badge for a library icon, no badge for a media icon).

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Hero } from "../../../../src/content/sections/Hero/Hero";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {
    logo: {
      url: "https://cdn/logo.png",
      kind: "raster",
      width: 800,
      height: 400,
      alt: "logo",
      variants: { "480": "https://cdn/logo-480.webp" },
    },
  } as unknown as ContentBundle["media"],
  icons: { star: "https://cdn/star.svg" },
};

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe("Hero", () => {
  it("renders the title as <h1>", () => {
    const { container } = render(
      wrap(
        <Hero
          data={{ title: "Greetings", tagline: null, icon: null, links: [], height: "tall" }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("h1")?.textContent).toBe("Greetings");
  });

  it("renders the tagline paragraph when set", () => {
    const { container } = render(
      wrap(
        <Hero
          data={{ title: "Hi", tagline: "Ho ho ho", icon: null, links: [], height: "short" }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    const paragraphs = container.querySelectorAll("p");
    const tagline = Array.from(paragraphs).find((p) => p.textContent === "Ho ho ho");
    expect(tagline).not.toBeUndefined();
  });

  it("renders up to two links", () => {
    const { container } = render(
      wrap(
        <Hero
          data={{
            title: "Hi",
            tagline: null,
            icon: { source: "library", id: "star" },
            links: [
              { label: "One", href: "/one", icon: null, newTab: false },
              { label: "Two", href: "/two", icon: null, newTab: false },
              { label: "Three", href: "/three", icon: null, newTab: false },
            ],
            height: "tall",
          }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    // Hero caps to two links; both render as anchors.
    expect(container.querySelectorAll("a").length).toBe(2);
    // Icon renders as an aria-hidden wrapper with an inner svg.
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it.each([
    [undefined, 56],
    [null, 56],
    ["sm", 56],
    ["md", 96],
    ["lg", 144],
    ["xl", 200],
  ] as const)("iconSize %s sizes a library icon's badge at %i px", (iconSize, px) => {
    const { getByTestId } = render(
      wrap(
        <Hero
          data={{ title: "Hi", tagline: null, icon: { source: "library", id: "star" }, links: [], height: "tall", iconSize }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    const box = getByTestId("hero-icon");
    expect(box.style.width).toBe(`${px}px`);
    expect(box.style.height).toBe(`${px}px`);
    expect(box.dataset.iconBadge).toBe("true");
    expect(box.querySelector("svg")).not.toBeNull();
  });

  it.each([
    [undefined, 56],
    ["sm", 56],
    ["md", 96],
    ["lg", 144],
    ["xl", 200],
  ] as const)("iconSize %s renders a media icon at %i px with no badge", (iconSize, px) => {
    const { getByTestId } = render(
      wrap(
        <Hero
          data={{ title: "Hi", tagline: null, icon: { source: "media", id: "logo" }, links: [], height: "tall", iconSize }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    const box = getByTestId("hero-icon");
    expect(box.style.width).toBe(`${px}px`);
    expect(box.style.height).toBe(`${px}px`);
    expect(box.dataset.iconBadge).toBe("false");
    const img = box.querySelector("img")!;
    expect(img.getAttribute("width")).toBe(String(px));
    expect(img.getAttribute("height")).toBe(String(px));
  });

  it("styles the media icon uncropped and the library badge round", () => {
    const css = readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "src", "content", "sections", "Hero", "Hero.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.heroIconMedia img \{[^}]*object-fit: contain;/);
    expect(css).not.toMatch(/\.heroIconMedia[^{]*\{[^}]*border-radius/);
    expect(css).toMatch(/\.heroIcon \{[^}]*border-radius: 50%;/);
  });

  describe("showLogo", () => {
    const withLogo: ContentBundle = {
      ...bundle,
      content: {
        settings: { siteName: "Site", logoMedia: { mediaId: "logo", alt: null } },
      } as unknown as ContentBundle["content"],
    };
    const withoutLogo: ContentBundle = {
      ...bundle,
      content: { settings: { siteName: "Site", logoMedia: null } } as unknown as ContentBundle["content"],
    };

    it.each([
      [undefined, 56],
      ["sm", 56],
      ["md", 96],
      ["lg", 144],
      ["xl", 200],
    ] as const)("iconSize %s draws the logo %i px tall in place of the icon", (iconSize, px) => {
      const { getByTestId, queryByTestId } = render(
        wrap(
          <Hero
            data={{ title: "Hi", tagline: null, icon: { source: "library", id: "star" }, links: [], height: "tall", iconSize, showLogo: true }}
            items={[]}
            bundle={withLogo}
          />,
        ),
      );
      expect(queryByTestId("hero-icon")).toBeNull();
      const logo = getByTestId("hero-logo");
      expect(logo.style.height).toBe(`${px}px`);
      expect(logo.style.width).toBe("");
      expect(logo.querySelector("img")?.getAttribute("src")).toBe("https://cdn/logo.png");
    });

    it("falls back to the icon when no logo is set", () => {
      const { getByTestId, queryByTestId } = render(
        wrap(
          <Hero
            data={{ title: "Hi", tagline: null, icon: { source: "library", id: "star" }, links: [], height: "tall", iconSize: "md", showLogo: true }}
            items={[]}
            bundle={withoutLogo}
          />,
        ),
      );
      expect(queryByTestId("hero-logo")).toBeNull();
      expect(getByTestId("hero-icon").style.width).toBe("96px");
    });

    it("draws the icon when showLogo is not true", () => {
      const { getByTestId, queryByTestId } = render(
        wrap(
          <Hero
            data={{ title: "Hi", tagline: null, icon: { source: "library", id: "star" }, links: [], height: "tall", showLogo: null }}
            items={[]}
            bundle={withLogo}
          />,
        ),
      );
      expect(queryByTestId("hero-logo")).toBeNull();
      expect(getByTestId("hero-icon")).not.toBeNull();
    });
  });
});
