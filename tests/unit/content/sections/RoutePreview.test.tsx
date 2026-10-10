// docs/site.md sections 7.4, 8.9, 22.1. RoutePreview without a recording:
//  - The heading and `emptyText` render, and no `<img>`, even when the
//    published section data carries an older `style` key.
//  - With no `emptyText` the section renders nothing.
//  - The map frame height comes from `--route-preview-max-h` in tokens.css.
// And the host's loading, with the host module mocked:
//  - The host is lazy-imported only for a path of two or more points.
//  - The renderer choice is reported once as the `route` surface; on
//    `google` the host gets the renderer and the Google theme of the
//    appearance, and with no Google theme the section renders `emptyText`.
// The map itself is covered in RouteMap.test.tsx.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import { reportRenderer } from "../../../../src/map/renderer";
import { GOOGLE_THEME_ROWS, ROUTE_THEME_ROWS, stubThemeFetch } from "../../mapHost/routeThemes";

const mocks = vi.hoisted(() => ({
  hostImports: 0,
  hostThemes: [] as string[],
  hostRenderers: [] as (string | undefined)[],
  renderer: "maplibre" as "maplibre" | "google",
}));

vi.mock("../../../../src/mapHost/MapHost", () => {
  mocks.hostImports++;
  return {
    MapHost: ({ theme, renderer }: { theme: { key: string }; renderer?: string }) => {
      mocks.hostThemes.push(theme.key);
      mocks.hostRenderers.push(renderer);
      return <div data-testid="fake-host" />;
    },
  };
});

vi.mock("../../../../src/map/renderer", () => ({
  reportRendererFallback: vi.fn(),
  reportRenderer: vi.fn(() => mocks.renderer),
}));

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
  vi.unstubAllGlobals();
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

const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
];

function setRoute(path: { lat: number; lng: number }[], trackerThemes: unknown = ROUTE_THEME_ROWS): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        routeMap: { path, timeline: [], durationMinutes: 5, timed: false },
        trackerMap: { id: 3, tilesUrl: "https://cdn.example/basemap/tiles.pmtiles", terrainUrl: null },
      },
      trackerThemes,
    } as unknown as Snapshot,
  }));
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) {
      await vi.dynamicImportSettled();
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

describe("RoutePreview loading the map host", () => {
  beforeEach(() => {
    mocks.renderer = "maplibre";
    mocks.hostThemes.length = 0;
    vi.mocked(reportRenderer).mockClear();
    stubThemeFetch();
    document.documentElement.setAttribute("data-theme", "light");
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("imports the host only for a path of two or more points, and reports the renderer once", async () => {
    setRoute(PATH.slice(0, 1));
    renderSection({ emptyText: "Not yet." });
    await settle();
    expect(mocks.hostImports).toBe(0);
    expect(reportRenderer).not.toHaveBeenCalled();
    cleanup();

    setRoute(PATH);
    const { container } = renderSection({ emptyText: "Not yet." });
    await settle();
    expect(mocks.hostImports).toBe(1);
    expect(container.querySelector('[data-testid="fake-host"]')).not.toBeNull();
    expect(mocks.hostThemes.at(-1)).toBe("light");
    expect(reportRenderer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(reportRenderer).mock.calls[0][0]).toBe("route");
  });

  it("renders the host on the google choice with the Google theme of the appearance", async () => {
    mocks.renderer = "google";
    setRoute(PATH, [...ROUTE_THEME_ROWS, ...GOOGLE_THEME_ROWS]);
    const { container } = renderSection({ heading: "The route", emptyText: "Not yet." });
    await settle();
    expect(container.querySelector('[data-testid="fake-host"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-preview-empty"]')).toBeNull();
    expect(mocks.hostThemes.at(-1)).toBe("standard");
    expect(mocks.hostRenderers.at(-1)).toBe("google");
  });

  it("renders emptyText on the google choice when the event has no Google theme", async () => {
    mocks.renderer = "google";
    setRoute(PATH);
    const { container } = renderSection({ heading: "The route", emptyText: "Not yet." });
    await settle();
    expect(container.querySelector('[data-testid="route-preview-empty"]')).not.toBeNull();
    expect(container.textContent).toContain("Not yet.");
    expect(container.querySelector('[data-testid="fake-host"]')).toBeNull();
    expect(reportRenderer).toHaveBeenCalledTimes(1);
  });
});
