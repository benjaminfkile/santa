// docs/site.md section 7.6. Every `map-section*`, `map-view*`, and
// `tracker-menu*` class emitted by the map section and MapView must have a
// rule in tokens.css so no live-screen element ships unstyled.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../../src");
const tokensPath = resolve(srcRoot, "content/theme/tokens.css");
const mapSectionDir = resolve(srcRoot, "content/sections/Map");
const mapViewPath = resolve(srcRoot, "map/MapView.tsx");

// BEM class: block, optionally __element and/or --modifier. Excludes bare
// suffixes with a single hyphen (e.g. a `tracker-menu-data-row` test id).
const CLASS_RE =
  /(?:map-section|map-view|tracker-menu)(?:__[a-zA-Z0-9-]+(?:--[a-zA-Z0-9-]+)?|--[a-zA-Z0-9-]+)?(?![a-zA-Z0-9_-])/g;

function findClassesInFile(text: string): Set<string> {
  const hits = new Set<string>();
  for (const m of text.matchAll(CLASS_RE)) hits.add(m[0]);
  return hits;
}

function collectSources(): string[] {
  const files: string[] = [];
  for (const name of readdirSync(mapSectionDir)) {
    const full = join(mapSectionDir, name);
    if (statSync(full).isFile() && (full.endsWith(".tsx") || full.endsWith(".ts"))) {
      files.push(full);
    }
  }
  files.push(mapViewPath);
  return files;
}

function cssHasRuleFor(css: string, cls: string): boolean {
  const re = new RegExp(`\\.${cls}(?![A-Za-z0-9_-])`);
  return re.test(css);
}

// Rendering the Map section pulls in Google Maps through MapView; mock the
// module so the test exercises the JSX without a network load.
vi.mock("../../../../src/map/MapView", () => ({
  MapView: (props: {
    className?: string;
    children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
  }) => (
    <div className={props.className ?? "map-view"}>
      <div className="map-view__canvas" />
      {typeof props.children === "function"
        ? (props.children({
            controller: null,
            error: null,
            retry: () => {},
          }) as React.ReactNode)
        : null}
    </div>
  ),
}));

describe("Map section class coverage", () => {
  it("renders the Map section without crashing", async () => {
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    const bundle = {
      content: null as unknown,
      media: {},
      icons: {},
    } as import("../../../../src/store/types").ContentBundle;
    render(
      <MemoryRouter>
        <Map
          data={{
            controls: {
              themePicker: true,
              terrain: true,
              snow: true,
              routeLines: true,
              timeLabels: true,
              location: true,
              dataRow: true,
            },
            overlays: {
              liveIndicator: true,
              liftoffTimer: true,
              latestMessage: true,
              leaderboardPanel: true,
              sponsorCarousel: true,
              cookieControl: true,
              distanceChip: true,
            },
          }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    cleanup();
  });

  it("every map-section, map-view, and tracker-menu class in the source has a CSS rule", () => {
    const css = readFileSync(tokensPath, "utf8");
    const classes = new Set<string>();
    for (const file of collectSources()) {
      for (const cls of findClassesInFile(readFileSync(file, "utf8"))) {
        classes.add(cls);
      }
    }
    // Guard: the extractor did find the well-known classes.
    expect(classes.has("map-section")).toBe(true);
    expect(classes.has("map-view__canvas")).toBe(true);
    expect(classes.has("tracker-menu")).toBe(true);
    const missing = [...classes].filter((cls) => !cssHasRuleFor(css, cls)).sort();
    expect(missing).toEqual([]);
  });
});
