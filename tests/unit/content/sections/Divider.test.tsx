// docs/site.md section 7.4. Divider: line, snowflakes, or lights.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Divider } from "../../../../src/content/sections/Divider/Divider";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

describe("Divider", () => {
  it.each(["line", "snowflakes", "lights"] as const)("renders style %s with role=separator", (style) => {
    const { container } = render(<Divider data={{ style }} items={[]} bundle={bundle} />);
    const sep = container.querySelector('[role="separator"]');
    expect(sep).not.toBeNull();
    expect(sep!.getAttribute("data-divider-style")).toBe(style);
  });
});
