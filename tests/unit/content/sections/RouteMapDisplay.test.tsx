// docs/site.md section 8.9. The route map's display settings, landmark
// markers, and gestures, with MapLibre and pmtiles mocked:
//  - Each of the four display values (time label interval, arrows, arrow
//    size, route width) resolves from the section's `display`, then the
//    site settings' `routeMap` block, then the default (15, true, medium,
//    normal), and reaches the style: the labels at the interval's
//    interior multiples (none at 0), the arrow layer and its scale, and
//    the route line width.
//  - The named sizes map to scales through one table.
//  - A landmark with an icon stands a badge marker (a library icon
//    inline, a media icon through an image) and has no style dot; a
//    landmark with a description stands a button that opens its popover,
//    one at a time, closed by its close button, Escape, a tap elsewhere,
//    and its own button again; plain landmarks get no marker and stay as
//    the style draws them.
//  - The map is created without cooperativeGestures.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { env } from "../../../../src/config/env";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import {
  DISPLAY_DEFAULTS,
  DISPLAY_SCALES,
  resolveRouteMapDisplay,
} from "../../../../src/content/sections/RoutePreview/routeMapDisplay";
import { routeTimeLabels } from "../../../../src/content/sections/RoutePreview/routeTimelineData";

type Handler = (event: unknown) => void;

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  handlers: Map<string, Handler[]>;
};

type FakeMarkerInstance = {
  element: HTMLElement | undefined;
  lngLats: [number, number][];
  removed: boolean;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
  markers: [] as FakeMarkerInstance[],
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    handlers = new Map<string, Handler[]>();
    images = new Set<string>();
    setStyle = vi.fn();
    fitBounds = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    addImage = vi.fn((id: string) => {
      this.images.add(id);
    });
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.maps.push(this as unknown as FakeMapInstance);
    }
    hasImage(id: string) {
      return this.images.has(id);
    }
    on(name: string, handler: Handler) {
      this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
      return this;
    }
    once() {
      return this;
    }
  }
  class FakeMarker {
    element: HTMLElement | undefined;
    lngLats: [number, number][] = [];
    removed = false;
    constructor(options: { element?: HTMLElement }) {
      this.element = options.element;
      mocks.markers.push(this);
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLats.push(lngLat);
      return this;
    }
    addTo(map: { options: { container: HTMLElement } }) {
      if (this.element) map.options.container.appendChild(this.element);
      return this;
    }
    remove() {
      this.removed = true;
      this.element?.remove();
    }
  }
  return { Map: FakeMap, Marker: FakeMarker, addProtocol: vi.fn(), setWorkerUrl: vi.fn() };
});

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));

vi.mock("pmtiles", () => {
  class PMTiles {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    async getHeader() {
      return { minZoom: 0, maxZoom: 15 };
    }
  }
  class Protocol {
    tiles = new Map<string, PMTiles>();
    tile = vi.fn();
    add(p: PMTiles) {
      this.tiles.set(p.url, p);
    }
    get(url: string) {
      return this.tiles.get(url);
    }
  }
  return { PMTiles, Protocol };
});

const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];

// Every 5 minutes from liftoff to 90, then the last point at 93.
const TIMELINE = [
  ...Array.from({ length: 19 }, (_, i) => ({
    minutes: i * 5,
    lat: 46.8 + i * 0.01,
    lng: -114.0 + i * 0.01,
  })),
  { minutes: 93, lat: 47.0, lng: -113.8 },
];

const mutableEnv = env as unknown as { ROUTE_BASEMAP_URL: string };
const originalBasemap = mutableEnv.ROUTE_BASEMAP_URL;

type Display = Record<string, unknown>;

function buildBundle(routeMap?: Display): ContentBundle {
  return {
    content: {
      pages: [],
      nav: [],
      settings: routeMap === undefined ? {} : { routeMap },
    } as unknown as ContentDocument,
    media: {
      "11111111-1111-4111-8111-111111111111": {
        url: "https://cdn.example/media/bridge.svg",
        kind: "svg",
        alt: "Bridge",
      },
    },
    icons: {},
  } as unknown as ContentBundle;
}

function setEvent(): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        scheduledAt: null,
        routeImageMediaId: null,
        routeMap: { path: PATH, timeline: TIMELINE, durationMinutes: 93, timed: true },
      },
    } as unknown as Snapshot,
  }));
}

async function settle(): Promise<void> {
  await act(async () => {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

async function renderSection(data: Record<string, unknown> = {}, sitewide?: Display) {
  const result = render(
    <MemoryRouter>
      <RoutePreview data={{ style: "map", ...data }} items={[]} bundle={buildBundle(sitewide)} />
    </MemoryRouter>,
  );
  await settle();
  return result;
}

type Layer = { id: string; filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> };
type StyleShape = { sources: Record<string, { data?: unknown }>; layers: Layer[] };

function currentStyle(): StyleShape {
  const map = mocks.maps[0];
  const calls = map.setStyle.mock.calls;
  return (calls.length > 0 ? calls[calls.length - 1][0] : map.options.style) as StyleShape;
}

function layerOf(style: StyleShape, id: string): Layer | undefined {
  return style.layers.find((l) => l.id === id);
}

function labelsOf(style: StyleShape): string[] {
  const source = style.sources["route-time-labels"];
  if (source === undefined) return [];
  const data = source.data as { features: { properties: { label: string } }[] };
  return data.features.map((f) => f.properties.label);
}

function lineWidth(style: StyleShape): unknown {
  return layerOf(style, "route-line")?.paint?.["line-width"];
}

function widthAt(scale: number): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 8, 3 * scale, 14, 5 * scale];
}

function q(root: ParentNode, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

function qa(root: ParentNode, id: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
}

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.markers.length = 0;
  mutableEnv.ROUTE_BASEMAP_URL = "https://cdn.example/basemap";
  document.documentElement.setAttribute("data-theme", "light");
  setEvent();
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
  mutableEnv.ROUTE_BASEMAP_URL = originalBasemap;
  document.documentElement.removeAttribute("data-theme");
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("route map display resolution", () => {
  const settings = (routeMap: Display | undefined) =>
    ({ routeMap }) as unknown as Parameters<typeof resolveRouteMapDisplay>[1];

  it("maps the named sizes to scales in one table", () => {
    expect(DISPLAY_SCALES).toEqual({
      arrowSize: { small: 0.75, medium: 1, large: 1.5, xlarge: 2 },
      routeWidth: { thin: 0.75, normal: 1, thick: 1.5, xthick: 2 },
    });
    expect(DISPLAY_DEFAULTS).toEqual({
      timeLabelIntervalMinutes: 15,
      arrows: true,
      arrowSize: "medium",
      routeWidth: "normal",
    });
    for (const [name, scale] of Object.entries(DISPLAY_SCALES.arrowSize)) {
      const size = name as keyof typeof DISPLAY_SCALES.arrowSize;
      expect(resolveRouteMapDisplay({ arrowSize: size }, null).arrowScale).toBe(scale);
    }
    for (const [name, scale] of Object.entries(DISPLAY_SCALES.routeWidth)) {
      const width = name as keyof typeof DISPLAY_SCALES.routeWidth;
      expect(resolveRouteMapDisplay({ routeWidth: width }, null).routeWidthScale).toBe(scale);
    }
  });

  it("resolves every value from the section, then the site settings, then the default", () => {
    const section = { timeLabelIntervalMinutes: 5, arrows: false, arrowSize: "small", routeWidth: "thin" } as const;
    const sitewide = { timeLabelIntervalMinutes: 30, arrows: true, arrowSize: "xlarge", routeWidth: "xthick" } as const;
    expect(resolveRouteMapDisplay(section, settings(sitewide))).toEqual({
      timeLabelIntervalMinutes: 5,
      arrows: false,
      arrowScale: 0.75,
      routeWidthScale: 0.75,
    });
    expect(resolveRouteMapDisplay({}, settings(sitewide))).toEqual({
      timeLabelIntervalMinutes: 30,
      arrows: true,
      arrowScale: 2,
      routeWidthScale: 2,
    });
    expect(resolveRouteMapDisplay(null, settings({ ...sitewide, arrows: false }))).toMatchObject({
      arrows: false,
    });
    for (const level of [undefined, {}]) {
      expect(resolveRouteMapDisplay(undefined, settings(level))).toEqual({
        timeLabelIntervalMinutes: 15,
        arrows: true,
        arrowScale: 1,
        routeWidthScale: 1,
      });
    }
    expect(resolveRouteMapDisplay(null, null)).toEqual(resolveRouteMapDisplay(undefined, settings(undefined)));
  });

  it("resolves each value on its own, a mixed section falling through key by key", () => {
    const resolved = resolveRouteMapDisplay(
      { arrowSize: "large" },
      settings({ timeLabelIntervalMinutes: 10, routeWidth: "thick" }),
    );
    expect(resolved).toEqual({
      timeLabelIntervalMinutes: 10,
      arrows: true,
      arrowScale: 1.5,
      routeWidthScale: 1.5,
    });
    expect(
      resolveRouteMapDisplay({ timeLabelIntervalMinutes: 0 }, settings({ timeLabelIntervalMinutes: 30 }))
        .timeLabelIntervalMinutes,
    ).toBe(0);
  });

  it("keeps labels on the interior multiples of the interval, and none at 0", () => {
    expect(routeTimeLabels(TIMELINE, 30).map((l) => l.label)).toEqual(["30m", "1h 0m", "1h 30m"]);
    expect(routeTimeLabels(TIMELINE, 10).map((l) => l.label)).toEqual([
      "10m",
      "20m",
      "30m",
      "40m",
      "50m",
      "1h 0m",
      "1h 10m",
      "1h 20m",
      "1h 30m",
    ]);
    expect(routeTimeLabels(TIMELINE, 0)).toEqual([]);
    expect(routeTimeLabels(TIMELINE)).toEqual(routeTimeLabels(TIMELINE, 15));
  });
});

describe("route map display reaching the style", () => {
  it("uses the defaults with neither level set: labels every 15, medium arrows, normal width", async () => {
    await renderSection();
    const style = currentStyle();
    expect(labelsOf(style)).toEqual(["15m", "30m", "45m", "1h 0m", "1h 15m", "1h 30m"]);
    const arrows = layerOf(style, "route-arrows");
    expect(arrows).toBeDefined();
    expect(arrows?.layout?.["icon-size"]).toBe(1);
    expect(arrows?.layout?.["symbol-spacing"]).toBe(140);
    expect(lineWidth(style)).toEqual(widthAt(1));
  });

  it("uses the site settings where the section is silent", async () => {
    await renderSection(
      { display: {} },
      { timeLabelIntervalMinutes: 30, arrows: true, arrowSize: "xlarge", routeWidth: "thick" },
    );
    const style = currentStyle();
    expect(labelsOf(style)).toEqual(["30m", "1h 0m", "1h 30m"]);
    expect(layerOf(style, "route-arrows")?.layout?.["icon-size"]).toBe(2);
    expect(layerOf(style, "route-arrows")?.layout?.["symbol-spacing"]).toBe(280);
    expect(lineWidth(style)).toEqual(widthAt(1.5));
  });

  it("uses the section over the site settings", async () => {
    await renderSection(
      { display: { timeLabelIntervalMinutes: 10, arrowSize: "small", routeWidth: "xthick" } },
      { timeLabelIntervalMinutes: 30, arrows: true, arrowSize: "xlarge", routeWidth: "thin" },
    );
    const style = currentStyle();
    expect(labelsOf(style)[0]).toBe("10m");
    expect(labelsOf(style)).toHaveLength(9);
    expect(layerOf(style, "route-arrows")?.layout?.["icon-size"]).toBe(0.75);
    expect(lineWidth(style)).toEqual(widthAt(2));
  });

  it("turns the arrows off from either level, and on from the section over the site", async () => {
    await renderSection({ display: { arrows: false } });
    expect(layerOf(currentStyle(), "route-arrows")).toBeUndefined();
    cleanup();
    mocks.maps.length = 0;
    await renderSection({}, { arrows: false });
    expect(layerOf(currentStyle(), "route-arrows")).toBeUndefined();
    cleanup();
    mocks.maps.length = 0;
    await renderSection({ display: { arrows: true } }, { arrows: false });
    expect(layerOf(currentStyle(), "route-arrows")).toBeDefined();
  });

  it("removes the time labels at an interval of 0, from either level", async () => {
    await renderSection({ display: { timeLabelIntervalMinutes: 0 } }, { timeLabelIntervalMinutes: 30 });
    let style = currentStyle();
    expect(style.sources["route-time-labels"]).toBeUndefined();
    expect(style.layers.some((l) => l.id.startsWith("route-time-label"))).toBe(false);
    expect(layerOf(style, "route-marks")).toBeDefined();
    cleanup();
    mocks.maps.length = 0;
    await renderSection({}, { timeLabelIntervalMinutes: 0 });
    style = currentStyle();
    expect(style.sources["route-time-labels"]).toBeUndefined();
    cleanup();
    mocks.maps.length = 0;
    await renderSection({ display: { timeLabelIntervalMinutes: 15 } }, { timeLabelIntervalMinutes: 0 });
    expect(labelsOf(currentStyle())).toHaveLength(6);
  });

  it("adds the arrowhead image when the style asks for it", async () => {
    await renderSection();
    const map = mocks.maps[0];
    const missing = map.handlers.get("styleimagemissing") ?? [];
    expect(missing).toHaveLength(1);
    missing[0]({ id: "something-else" });
    expect(map.addImage).not.toHaveBeenCalled();
    missing[0]({ id: "route-arrow" });
    missing[0]({ id: "route-arrow" });
    expect(map.addImage).toHaveBeenCalledTimes(1);
    expect(map.addImage.mock.calls[0][0]).toBe("route-arrow");
    expect(map.addImage.mock.calls[0][2]).toMatchObject({ sdf: true });
  });

  it("creates the map without cooperativeGestures", async () => {
    await renderSection();
    expect(mocks.maps).toHaveLength(1);
    expect(mocks.maps[0].options).not.toHaveProperty("cooperativeGestures");
  });
});

const PLAIN = { name: "Caras Park", lat: 46.87, lng: -113.99 };
const LIBRARY = { name: "Mount Jumbo", lat: 46.88, lng: -113.96, icon: { source: "library", id: "tree" } };
const MEDIA = {
  name: "Higgins Bridge",
  lat: 46.86,
  lng: -113.99,
  icon: { source: "media", id: "11111111-1111-4111-8111-111111111111" },
};
const TOLD = { name: "The Oval", lat: 46.86, lng: -113.98, description: "Where the reindeer rest." };
const TOLD_ICON = {
  name: "Clock Tower",
  lat: 46.85,
  lng: -113.97,
  icon: { source: "library", id: "bell" },
  description: "Chimes at midnight.",
};

function landmarkProperties(style: StyleShape): Record<string, unknown>[] {
  const data = style.sources["route-landmarks"].data as { features: { properties: Record<string, unknown> }[] };
  return data.features.map((f) => f.properties);
}

function landmarkMarkers(): FakeMarkerInstance[] {
  return mocks.markers.filter((m) => m.element?.getAttribute("data-testid") === "route-landmark");
}

function popover(): HTMLElement | null {
  return q(document, "route-landmark-popover");
}

function buttonFor(name: string): HTMLButtonElement {
  const button = qa(document, "route-landmark-button").find(
    (b) => b.getAttribute("aria-label") === `About ${name}`,
  );
  expect(button, name).toBeDefined();
  return button as HTMLButtonElement;
}

async function open(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(buttonFor(name));
  });
}

describe("route map landmarks", () => {
  it("keeps plain landmarks exactly as the style draws them, with no marker", async () => {
    await renderSection({ landmarks: [PLAIN, { ...PLAIN, name: "Rattlesnake", lat: 46.9 }] });
    const style = currentStyle();
    expect(landmarkProperties(style)).toEqual([{ label: "Caras Park" }, { label: "Rattlesnake" }]);
    expect(layerOf(style, "route-landmark-dots")?.filter).toBeUndefined();
    expect(layerOf(style, "route-landmarks")?.layout?.["text-radial-offset"]).toBe(0.5);
    expect(landmarkMarkers()).toHaveLength(0);
    expect(mocks.markers).toHaveLength(1);
    expect(qa(document, "route-landmark")).toHaveLength(0);
  });

  it("draws an icon landmark as a badge in place of the dot, the label beside it", async () => {
    await renderSection({ landmarks: [PLAIN, LIBRARY, MEDIA] });
    const style = currentStyle();
    expect(landmarkProperties(style)).toEqual([
      { label: "Caras Park" },
      { label: "Mount Jumbo", badge: true },
      { label: "Higgins Bridge", badge: true },
    ]);
    expect(layerOf(style, "route-landmark-dots")?.filter).toEqual(["!", ["has", "badge"]]);
    expect(layerOf(style, "route-landmarks")).toBeDefined();

    const markers = landmarkMarkers();
    expect(markers).toHaveLength(2);
    expect(markers[0].lngLats).toEqual([[LIBRARY.lng, LIBRARY.lat]]);
    expect(markers[1].lngLats).toEqual([[MEDIA.lng, MEDIA.lat]]);

    const libraryBadge = q(markers[0].element!, "route-landmark-badge")!;
    expect(libraryBadge.getAttribute("aria-hidden")).toBe("true");
    const svg = libraryBadge.querySelector('svg[data-icon-source="library"]');
    expect(svg?.getAttribute("data-icon-id")).toBe("tree");
    expect(libraryBadge.querySelector("img")).toBeNull();

    const mediaBadge = q(markers[1].element!, "route-landmark-badge")!;
    const img = mediaBadge.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example/media/bridge.svg");
    expect(img?.getAttribute("data-icon-source")).toBe("media");
    expect(qa(document, "route-landmark-button")).toHaveLength(0);
  });

  it("treats an icon that does not resolve as no icon", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderSection({
      landmarks: [{ ...MEDIA, icon: { source: "media", id: "22222222-2222-4222-8222-222222222222" } }],
    });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Higgins Bridge" }]);
    expect(landmarkMarkers()).toHaveLength(0);
  });

  it("opens a description landmark's popover with its name and description, and closes it with the close button", async () => {
    await renderSection({ landmarks: [PLAIN, TOLD] });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Caras Park" }, { label: "The Oval" }]);
    const markers = landmarkMarkers();
    expect(markers).toHaveLength(1);
    expect(markers[0].lngLats).toEqual([[TOLD.lng, TOLD.lat]]);

    const button = buttonFor("The Oval");
    expect(markers[0].element!.contains(button)).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(q(button, "route-landmark-badge")).toBeNull();
    expect(popover()).toBeNull();

    await open("The Oval");
    const panel = popover()!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("role")).toBe("dialog");
    const title = document.getElementById(panel.getAttribute("aria-labelledby")!);
    expect(title?.textContent).toBe("The Oval");
    expect(panel.textContent).toContain("Where the reindeer rest.");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(panel.id);
    expect(q(document, "route-map-frame")!.contains(panel)).toBe(true);

    const close = q(panel, "route-landmark-popover-close")!;
    expect(close.getAttribute("aria-label")).toBe("Close");
    expect(document.activeElement).toBe(close);
    await act(async () => {
      fireEvent.click(close);
    });
    expect(popover()).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes the popover on Escape, keeping a fullscreen map fullscreen", async () => {
    await renderSection({ landmarks: [TOLD] });
    const stage = q(document, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(document, "route-map-fullscreen")!);
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");

    await open("The Oval");
    expect(popover()).not.toBeNull();
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    });
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(buttonFor("The Oval"));
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
  });

  it("closes the popover on a tap elsewhere, and not on a tap inside it", async () => {
    await renderSection({ landmarks: [TOLD] });
    await open("The Oval");
    const panel = popover()!;
    await act(async () => {
      fireEvent.pointerDown(panel.querySelector("p")!);
    });
    expect(popover()).not.toBeNull();
    await act(async () => {
      fireEvent.pointerDown(q(document, "route-map")!);
    });
    expect(popover()).toBeNull();

    await open("The Oval");
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(popover()).toBeNull();
  });

  it("closes the popover from its own landmark's button", async () => {
    await renderSection({ landmarks: [TOLD] });
    await open("The Oval");
    expect(popover()).not.toBeNull();
    await act(async () => {
      fireEvent.pointerDown(buttonFor("The Oval"));
    });
    expect(popover()).not.toBeNull();
    await open("The Oval");
    expect(popover()).toBeNull();
  });

  it("keeps one popover open at a time", async () => {
    await renderSection({ landmarks: [TOLD, TOLD_ICON] });
    await open("The Oval");
    await act(async () => {
      fireEvent.pointerDown(buttonFor("Clock Tower"));
    });
    await open("Clock Tower");
    expect(qa(document, "route-landmark-popover")).toHaveLength(1);
    expect(popover()!.textContent).toContain("Chimes at midnight.");
    expect(buttonFor("The Oval").getAttribute("aria-expanded")).toBe("false");
    expect(buttonFor("Clock Tower").getAttribute("aria-expanded")).toBe("true");
  });

  it("makes an icon landmark with a description a button around its badge", async () => {
    await renderSection({ landmarks: [TOLD_ICON] });
    expect(landmarkProperties(currentStyle())).toEqual([{ label: "Clock Tower", badge: true }]);
    const button = buttonFor("Clock Tower");
    const badge = q(button, "route-landmark-badge")!;
    expect(badge.querySelector('svg[data-icon-id="bell"]')).not.toBeNull();
    await open("Clock Tower");
    expect(popover()!.textContent).toContain("Clock Tower");
    expect(popover()!.textContent).toContain("Chimes at midnight.");
  });

  it("removes the landmark markers with the map", async () => {
    const { unmount } = await renderSection({ landmarks: [LIBRARY, TOLD] });
    const markers = landmarkMarkers();
    expect(markers).toHaveLength(2);
    unmount();
    expect(markers.every((m) => m.removed)).toBe(true);
  });
});
