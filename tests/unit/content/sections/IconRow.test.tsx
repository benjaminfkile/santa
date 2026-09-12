// docs/site.md section 7.4. Icon row: decorative icons with optional labels.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IconRow } from "../../../../src/content/sections/IconRow/IconRow";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: { star: "https://cdn/star.svg", candy: "https://cdn/candy.svg" },
};

describe("IconRow", () => {
  it("renders one item per icon and marks decorative icons hidden", () => {
    const items = [
      { id: 1, data: { icon: { source: "library", id: "star" }, label: null } },
      { id: 2, data: { icon: { source: "library", id: "candy" }, label: "Candy" } },
    ];
    const { container } = render(
      <IconRow data={{ size: "md", spacing: "normal" }} items={items} bundle={bundle} />,
    );
    // Two items render as direct children of the row root.
    const root = container.firstElementChild!;
    expect(root.children.length).toBe(2);
    const inline = container.querySelectorAll("svg[data-icon-source=\"library\"]");
    expect(inline[0]?.getAttribute("aria-hidden")).toBe("true");
    // Only the second item has a text label.
    expect(container.textContent).toContain("Candy");
  });

  it("picks the pixel size from the size token", () => {
    const items = [{ id: 1, data: { icon: { source: "library", id: "star" }, label: null } }];
    const { container } = render(
      <IconRow data={{ size: "lg", spacing: "loose" }} items={items} bundle={bundle} />,
    );
    const inline = container.querySelector("svg[data-icon-source=\"library\"]");
    expect(inline?.getAttribute("width")).toBe("96");
    expect((container.firstElementChild as HTMLElement).dataset.size).toBe("lg");
  });
});
