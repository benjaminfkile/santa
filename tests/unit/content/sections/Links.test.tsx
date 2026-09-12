// docs/site.md section 7.4. Links section renders buttons, cards, or a list.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Links } from "../../../../src/content/sections/Links/Links";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: { star: "https://cdn/star.svg" },
};

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

function makeItems() {
  return [
    {
      id: 1,
      data: {
        link: { label: "Donate", href: "/donate", icon: null, newTab: false },
        description: "Give a little.",
      },
    },
    {
      id: 2,
      data: {
        link: { label: "Sponsor", href: "https://example.org/", icon: { source: "library", id: "star" }, newTab: true },
        description: null,
      },
    },
  ];
}

describe("Links section", () => {
  it("buttons renders each link as a <a>", () => {
    const { container } = render(
      wrap(<Links data={{ heading: null, style: "buttons" }} items={makeItems()} bundle={bundle} />),
    );
    expect((container.firstElementChild as HTMLElement).dataset.style).toBe("buttons");
    expect(container.querySelectorAll("a").length).toBe(2);
  });

  it("cards renders per-item card with label, icon, description", () => {
    const { container } = render(
      wrap(<Links data={{ heading: "Get involved", style: "cards" }} items={makeItems()} bundle={bundle} />),
    );
    expect(container.querySelector("h2")?.textContent).toBe("Get involved");
    // Two card anchors, each with the label and icon.
    expect(container.querySelectorAll("a").length).toBe(2);
    expect(container.textContent).toContain("Give");
  });

  it("list uses a <ul>", () => {
    const { container } = render(
      wrap(<Links data={{ heading: null, style: "list" }} items={makeItems()} bundle={bundle} />),
    );
    expect(container.querySelector("ul")).not.toBeNull();
    expect((container.firstElementChild as HTMLElement).dataset.style).toBe("list");
  });
});
