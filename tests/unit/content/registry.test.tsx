// docs/site.md section 7.2. Registry: every kind in contracts/kinds.json
// has a component; each renders its defaults without throwing; unknown
// kind renders nothing and logs once.

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { registry, Unknown, SECTION_KIND_KEYS } from "../../../src/content/registry";
import { _resetUnknownLog } from "../../../src/content/sections/Unknown";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContentBundle } from "../../../src/store/types";

const kinds = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "kinds.json"), "utf8"),
) as { kinds: { kind: string; defaults: unknown }[] };

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe("registry", () => {
  it("every kind in contracts/kinds.json has an entry in registry.sections", () => {
    for (const entry of kinds.kinds) {
      expect(registry.sections[entry.kind]).toBeDefined();
    }
  });

  it("the exported SECTION_KIND_KEYS list matches the contract kinds set", () => {
    const contractKinds = kinds.kinds.map((k) => k.kind).sort();
    const registryKinds = [...SECTION_KIND_KEYS].sort();
    expect(registryKinds).toEqual(contractKinds);
  });

  it("each kind's default data renders without throwing", () => {
    for (const entry of kinds.kinds) {
      const Kind = registry.sections[entry.kind];
      expect(Kind).toBeDefined();
      expect(() => render(withRouter(<Kind data={entry.defaults} items={[]} bundle={bundle} />))).not.toThrow();
    }
  });

  it("Unknown renders nothing and logs once per kind", () => {
    _resetUnknownLog();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, rerender } = render(<Unknown kind="mystery" />);
    expect(container.textContent).toBe("");
    rerender(<Unknown kind="mystery" />);
    expect(warn).toHaveBeenCalledTimes(1);
    rerender(<Unknown kind="other" />);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
