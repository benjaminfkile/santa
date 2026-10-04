// docs/site.md sections 7.4, 8.9, 22.1. RoutePreview without a recording:
//  - The heading and `emptyText` render, and no `<img>`, even when the
//    published section data carries an older `style` key.
//  - With no `emptyText` the section renders nothing.
//  - The map frame height comes from `--route-preview-max-h` in tokens.css.
// The map itself is covered in RouteMap.test.tsx.

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";

const ROOT = resolve(__dirname, "..", "..", "..", "..");

function buildBundle(): ContentBundle {
  return {
    content: { pages: [], nav: [] } as unknown as ContentDocument,
    media: {},
    icons: {},
  } as ContentBundle;
}

function setSnapshotEvent(): void {
  store.setState((s) => ({
    ...s,
    snapshot: { schemaVersion: 1, event: { id: 1, routeMap: null } } as unknown as Snapshot,
  }));
}

function renderSection(data: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <RoutePreview data={data} items={[]} bundle={buildBundle()} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
});

describe("RoutePreview without a recording", () => {
  it("renders the heading and emptyText and no <img>", () => {
    setSnapshotEvent();
    const { container } = renderSection({
      heading: "This year's route",
      emptyText: "The route will appear here once it is set.",
    });
    expect(container.querySelector("h2")?.textContent).toBe("This year's route");
    expect(container.textContent).toContain("The route will appear here once it is set.");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-testid="route-preview-map"]')).toBeNull();
  });

  it.each(["image", "viewer", "map"])("ignores a published style of %s", (style) => {
    setSnapshotEvent();
    const { container } = renderSection({ style, emptyText: "The route is not published yet." });
    expect(container.textContent).toContain("The route is not published yet.");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing without emptyText", () => {
    setSnapshotEvent();
    const { container } = renderSection({ heading: "This year's route", emptyText: null });
    expect(container.innerHTML).toBe("");
  });

  it("bounds the map frame with the preview height token", () => {
    const css = readFileSync(
      resolve(ROOT, "src", "content", "sections", "RoutePreview", "RoutePreview.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.routeMap\s*\{[^}]*height:\s*var\(--route-preview-max-h\)/);
    const tokens = readFileSync(resolve(ROOT, "src", "content", "theme", "tokens.css"), "utf8");
    expect(tokens).toMatch(/--route-preview-max-h:\s*min\(70vh,\s*720px\)/);
  });
});
