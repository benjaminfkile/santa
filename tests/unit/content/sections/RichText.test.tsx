// docs/site.md section 7.4. RichText renders each block through
// registry.blocks and skips unknown block kinds.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RichText } from "../../../../src/content/sections/RichText/RichText";
import type { ContentBundle } from "../../../../src/store/types";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe("RichText", () => {
  it("renders one element per known block", () => {
    const { container } = render(
      wrap(
        <RichText
          data={{
            blocks: [
              { kind: "heading", level: 2, text: "One", icon: null },
              { kind: "paragraph", text: "Two" },
            ],
          }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    expect(container.querySelector("h2")?.textContent).toContain("One");
    expect(container.querySelector("p")?.textContent).toBe("Two");
  });

  it("skips unknown block kinds", () => {
    const { container } = render(
      wrap(
        <RichText
          data={{
            blocks: [
              { kind: "paragraph", text: "kept" },
              { kind: "bogus", text: "gone" },
            ],
          }}
          items={[]}
          bundle={bundle}
        />,
      ),
    );
    expect(container.textContent).toBe("kept");
  });
});
