// docs/site.md section 7.2. Registry: every kind in contracts/kinds.json
// has a component; each renders its defaults and the fixture document
// without throwing; unknown kind renders nothing and logs once.

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { registry, Unknown, SECTION_KIND_KEYS, BLOCK_KIND_KEYS } from "../../../src/content/registry";
import { _resetUnknownLog } from "../../../src/content/sections/Unknown";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContentBundle } from "../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../src/contracts";

const kinds = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "..", "contracts", "kinds.json"), "utf8"),
) as { kinds: { kind: string; defaults: unknown; itemDefaults: unknown | null }[] };

const fixtureDoc = JSON.parse(
  readFileSync(
    resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "content-document.json"),
    "utf8",
  ),
) as ContentDocument;

const fixtureSnapshot = JSON.parse(
  readFileSync(
    resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "snapshot.json"),
    "utf8",
  ),
) as Snapshot;

const bundle: ContentBundle = {
  content: fixtureDoc,
  media: fixtureSnapshot.media ?? {},
  icons: fixtureSnapshot.icons ?? {},
};

// A tiny helper for the defaults test: some kinds have items whose data
// shape is described by `itemDefaults`. Render one such item for those
// kinds so their default view isn't empty.
function defaultItems(entry: { kind: string; itemDefaults: unknown | null }) {
  if (entry.itemDefaults === null || entry.itemDefaults === undefined) return [];
  return [{ id: 1, data: entry.itemDefaults }];
}

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

  it("BLOCK_KIND_KEYS all have a component in registry.blocks", () => {
    for (const kind of BLOCK_KIND_KEYS) {
      expect(registry.blocks[kind]).toBeDefined();
    }
  });

  it("each kind's default data renders without throwing", () => {
    for (const entry of kinds.kinds) {
      const Kind = registry.sections[entry.kind];
      expect(Kind).toBeDefined();
      const items = defaultItems(entry);
      expect(() =>
        render(withRouter(<Kind data={entry.defaults} items={items} bundle={bundle} />)),
      ).not.toThrow();
    }
  });

  it("every section in the fixture content document renders without throwing", () => {
    let rendered = 0;
    for (const page of fixtureDoc.pages) {
      for (const section of page.sections) {
        const Kind = registry.sections[section.kind];
        expect(Kind).toBeDefined();
        expect(() =>
          render(
            withRouter(
              <Kind
                data={section.data}
                items={section.items}
                bundle={bundle}
                frame={section.presentation.width}
              />,
            ),
          ),
        ).not.toThrow();
        rendered += 1;
      }
    }
    expect(rendered).toBeGreaterThan(0);
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
