// docs/site.md section 7.5. A link followed by {newtab} opens in a new tab:
// an external link with rel noopener noreferrer, a site path as a plain
// anchor in place of the router link.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Inline } from "../../../../src/content/inline/Inline";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function renderInline(text: string) {
  return render(
    <MemoryRouter>
      <Inline text={text} bundle={bundle} />
    </MemoryRouter>,
  );
}

describe("Inline new tab links", () => {
  it("an external new tab link has target _blank and rel noopener noreferrer", () => {
    const { container } = renderInline("[Give](https://x.org){newtab}");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://x.org");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toBe("Give");
  });

  it("an internal new tab link renders an anchor with target _blank", () => {
    const { container } = renderInline("[About](/about){newtab}");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/about");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener");
    expect(container.textContent).toBe("About");
  });

  it("an internal link without the marker opens in the same tab", () => {
    const { container } = renderInline("[About](/about)");
    expect(container.querySelector("a")?.getAttribute("target")).toBeNull();
  });
});
