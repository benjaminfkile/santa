// docs/site.md sections 7.4, 8.9, 22.1. RoutePreview without a recording:
//  - The heading and `emptyText` render, and no `<img>`, even when the
//    published section data carries an older `style` key.
//  - With no `emptyText` the section renders nothing.
//  - The map frame height comes from `--route-preview-max-h` in tokens.css.
// And the host's loading, with the host module mocked:
//  - The host is lazy-imported only for a path of two or more points.
//  - The section reads the top-level `routeMap`, `routeView`, and
//    `trackerThemes` of the vendored snapshot fixture: it draws with
//    `event` null, renders `emptyText` with `routeMap` null while an event
//    is current, and hands the host `routeView.bbox` as its pan limit and
//    `routeView.map` as its tiles.
//  - The renderer choice is reported once as the `route` surface; on
//    `google` the host gets the renderer and the Google theme of the
//    appearance, and with no Google theme the built-in default.
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
  hostProps: [] as Record<string, unknown>[],
  renderer: "maplibre" as "maplibre" | "google",
}));

vi.mock("../../../../src/mapHost/MapHost", () => {
  mocks.hostImports++;
  return {
    MapHost: (props: { theme: { key: string }; renderer?: string }) => {
      const { theme, renderer } = props;
      mocks.hostProps.push(props);
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

// The vendored contracts' snapshot fixture: an event current, the site
// route at the top level.
const FIXTURE = JSON.parse(
  readFileSync(resolve(ROOT, "contracts", "fixtures", "snapshot.json"), "utf8"),
) as Snapshot;

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
    snapshot: { ...FIXTURE, routeMap: null },
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
      ...FIXTURE,
      event: null,
      routeMap: { path, timeline: [], durationMinutes: 5, timed: false },
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
    mocks.hostProps.length = 0;
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

  it("draws on the google choice in the built-in theme when no Google theme is enabled", async () => {
    mocks.renderer = "google";
    setRoute(PATH, []);
    const { container } = renderSection({ heading: "The route", emptyText: "Not yet." });
    await settle();
    expect(container.querySelector('[data-testid="fake-host"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-preview-empty"]')).toBeNull();
    expect(mocks.hostThemes.at(-1)).toBe("google-default");
    expect(mocks.hostRenderers.at(-1)).toBe("google");
    expect(reportRenderer).toHaveBeenCalledTimes(1);
  });

  it("draws the site route with event null from the top-level routeMap", async () => {
    store.setState((s) => ({ ...s, snapshot: { ...FIXTURE, event: null } }));
    const { container } = renderSection({ heading: "The route", emptyText: "Not yet." });
    await settle();
    expect(container.querySelector('[data-testid="route-preview-map"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fake-host"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-preview-empty"]')).toBeNull();
    expect(mocks.hostProps.at(-1)?.path).toEqual(FIXTURE.routeMap?.path);
    expect(vi.mocked(reportRenderer).mock.calls[0][0]).toBe("route");
  });

  it("renders emptyText with routeMap null while an event is current", async () => {
    store.setState((s) => ({ ...s, snapshot: { ...FIXTURE, routeMap: null } }));
    const { container } = renderSection({ heading: "The route", emptyText: "Not yet." });
    await settle();
    expect(container.querySelector('[data-testid="route-preview-empty"]')).not.toBeNull();
    expect(container.textContent).toContain("Not yet.");
    expect(container.querySelector('[data-testid="fake-host"]')).toBeNull();
    expect(reportRenderer).not.toHaveBeenCalled();
  });

  it("uses routeView.bbox as the pan limit and routeView.map as the tiles, not the event's", async () => {
    const bbox = { west: -115, south: 46, east: -113, north: 47.5 };
    const map = { ...FIXTURE.routeView.map, tilesUrl: "https://cdn.example/maps/last-year/tiles.pmtiles" };
    store.setState((s) => ({ ...s, snapshot: { ...FIXTURE, routeView: { bbox, map } } }));
    renderSection({ emptyText: "Not yet." });
    await settle();
    const props = mocks.hostProps.at(-1);
    expect(props?.trackerBbox).toEqual(bbox);
    expect(props?.trackerBbox).not.toEqual(FIXTURE.event?.trackerBbox);
    expect(props?.trackerMap).toMatchObject({ tilesUrl: map.tilesUrl, terrainUrl: map.terrainUrl });
  });
});
