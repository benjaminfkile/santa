// docs/site.md section 7.4. Hero renders title, tagline, icon, up to two
// links, and picks a min-height token by height.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Hero } from "../../../../src/content/sections/Hero/Hero";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
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
});
