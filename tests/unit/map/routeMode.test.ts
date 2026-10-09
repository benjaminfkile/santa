// docs/site.md sections 8.2 and 8.9. Route mode on Google over the fake
// Google libraries:
//  - The path is a polyline in the theme's route colour and opacity, its
//    width times the route width scale; the arrows are open arrow symbols
//    tinted in the arrow colour, spaced and sized by the arrow scale.
//  - The marks are circle symbols in the chrome background ringed in the
//    route colour; each time label is a titled dot and a label marker,
//    the labels on the map only at `labelMinZoom` and above.
//  - The viewpoints draw a dot and a name (no dot for a badge, whose
//    element stands on its point); a click calls `onViewpointClick`.
//  - The start element stands on the first point and the end is a circle.
//  - The map type follows `terrain`; the map is restricted to the box with
//    its fitted least zoom, recomputed on resize.
//  - The path is fitted on mount and on resize, clamped to the box only
//    where it leaves it; a new path refits and a same path does not.
//  - A new theme or place filter applies its styles with `setOptions`.
//  - `destroy` takes everything off the map.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FakeMap,
  FakeMapObject,
  fakeLibs,
  installFakeGoogle,
  resetFakeGoogle,
} from "./fakeGoogle";
import {
  ARROW_SCALE,
  ARROW_SPACING,
  FIT_PADDING,
  ROUTE_WEIGHT,
  mountGoogleRoute,
  type GoogleRouteOptions,
  type GoogleRouteTheme,
} from "../../../src/map/routeMode";
import { fittedMinZoom } from "../../../src/map/bounds";
import { SEEDED } from "./themeFixtures";

const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];
const BOX = { west: -114.5, south: 46.5, east: -113.5, north: 47.2 };

const STANDARD_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "water", stylers: [{ color: "#aadaff" }] },
];

function themeOf(key: "standard" | "night" = "standard"): GoogleRouteTheme {
  const t = SEEDED[key];
  return { key: t.key, overlay: t.overlay, chrome: t.chrome, style: STANDARD_STYLE };
}

const observers: { callback: () => void }[] = [];

let container: HTMLElement;

function sized(width: number, height: number): void {
  Object.defineProperty(container, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(container, "clientHeight", { configurable: true, value: height });
}

function mount(options: Partial<GoogleRouteOptions> = {}) {
  return mountGoogleRoute(fakeLibs(), container, {
    theme: themeOf(),
    path: PATH,
    bbox: BOX,
    ...options,
  });
}

function map(): FakeMap {
  return FakeMap.instances[FakeMap.instances.length - 1];
}

type Drawn = FakeMapObject & { opts: Record<string, unknown> };

function live(): Drawn[] {
  return [...FakeMapObject.live] as Drawn[];
}

function polylines(): Drawn[] {
  return live().filter((o) => "path" in o.opts);
}

function markers(): Drawn[] {
  return live().filter((o) => "position" in o.opts);
}

type Circle = { path: number; fillColor: string; strokeColor: string; scale: number };

function circles(fill: string): Drawn[] {
  return markers().filter((m) => {
    const icon = m.opts.icon as Partial<Circle> | undefined;
    return icon?.path === google.maps.SymbolPath.CIRCLE && icon.fillColor === fill;
  });
}

function labelMarkers(): Drawn[] {
  return markers().filter((m) => typeof (m.opts.icon as { url?: unknown } | undefined)?.url === "string");
}

function labelText(m: Drawn): string {
  return decodeURIComponent((m.opts.icon as { url: string }).url);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  installFakeGoogle();
  resetFakeGoogle();
  observers.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  sized(600, 400);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      entry: { callback: () => void };
      constructor(callback: () => void) {
        this.entry = { callback };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.callback = () => {};
      }
    },
  );
});

afterEach(() => {
  container.remove();
  vi.unstubAllGlobals();
});

describe("route mode on Google: the path and the arrows", () => {
  it("draws the path in the theme's route colour and opacity, at the width scale", () => {
    const theme = themeOf();
    mount({ routeWidthScale: 1.5 });
    const [line] = polylines();
    expect(line.opts.path).toEqual(PATH);
    expect(line.opts.strokeColor).toBe(theme.overlay.routeColor);
    expect(line.opts.strokeOpacity).toBe(theme.overlay.routeOpacity);
    expect(line.opts.strokeWeight).toBe(ROUTE_WEIGHT * 1.5);
    expect(line.opts.icons).toEqual([]);
  });

  it("repeats open arrows tinted in the arrow colour, spaced and scaled by the arrow scale", () => {
    const theme = themeOf();
    mount({ arrows: true, arrowScale: 2 });
    const icons = polylines()[0].opts.icons as google.maps.IconSequence[];
    expect(icons).toHaveLength(1);
    const icon = icons[0].icon as google.maps.Symbol;
    expect(icon.path).toBe(google.maps.SymbolPath.FORWARD_OPEN_ARROW);
    expect(icon.strokeColor).toBe(theme.overlay.arrowColor);
    expect(icon.scale).toBe(ARROW_SCALE * 2);
    expect(icons[0].repeat).toBe(`${ARROW_SPACING * 2}px`);
  });

  it("reads an arrow scale at or under 0 as 1", () => {
    mount({ arrows: true, arrowScale: 0 });
    const icons = polylines()[0].opts.icons as google.maps.IconSequence[];
    expect(icons[0].repeat).toBe(`${ARROW_SPACING}px`);
  });
});

describe("route mode on Google: marks and time labels", () => {
  it("draws each mark as a circle in the chrome background ringed in the route colour", () => {
    const theme = themeOf();
    mount({ marks: PATH });
    const marks = circles(theme.chrome.bg);
    expect(marks).toHaveLength(3);
    expect((marks[0].opts.icon as Circle).strokeColor).toBe(theme.overlay.routeColor);
  });

  it("draws a titled dot per time label and the label only at labelMinZoom and above", () => {
    const theme = themeOf();
    const timeLabels = [
      { lat: 46.9, lng: -113.95, label: "15m" },
      { lat: 46.86, lng: -113.92, label: "30m" },
    ];
    mount({ timeLabels, labelMinZoom: 12, labelScale: 1.3 });
    const dots = circles(theme.overlay.routeColor);
    expect(dots.map((d) => d.opts.title)).toEqual(["15m", "30m"]);
    // The map opens at zoom 10: the labels wait.
    expect(labelMarkers()).toHaveLength(0);
    expect(container.getAttribute("data-names")).toBe("hidden");

    map().setZoom(13);
    const labels = labelMarkers();
    expect(labels).toHaveLength(2);
    expect(labelText(labels[0])).toContain(">15m<");
    expect(labelText(labels[0])).toContain(`fill="${theme.overlay.timeLabelFg}"`);
    expect(labelText(labels[0])).toContain(`fill="${theme.overlay.timeLabelBg}"`);
    expect(labelText(labels[0])).toContain(`font-size="${14 * 1.3}"`);
    expect(container.getAttribute("data-names")).toBe("shown");

    map().setZoom(11);
    expect(labelMarkers()).toHaveLength(0);
  });

  it("shows the labels at every zoom without labelMinZoom", () => {
    mount({ timeLabels: [{ lat: 46.9, lng: -113.95, label: "15m" }] });
    expect(labelMarkers()).toHaveLength(1);
  });
});

describe("route mode on Google: viewpoints", () => {
  it("draws a dot and a name for a plain viewpoint, and a click reports its point", async () => {
    const theme = themeOf();
    const onViewpointClick = vi.fn();
    mount({
      viewpoints: [{ lat: 46.88, lng: -113.97, label: "Ridge & Pass" }],
      onViewpointClick,
    });
    const [dot] = circles(theme.chrome.fg);
    expect(dot.opts.title).toBe("Ridge & Pass");
    expect(dot.opts.clickable).toBe(true);
    const [name] = labelMarkers();
    expect(labelText(name)).toContain(">Ridge &amp; Pass<");
    dot.trigger("click");
    name.trigger("click");
    expect(onViewpointClick).toHaveBeenCalledTimes(2);
    expect(onViewpointClick).toHaveBeenCalledWith({ lat: 46.88, lng: -113.97 });
  });

  it("draws no dot for a badge viewpoint and stands its element on the point", async () => {
    const theme = themeOf();
    const element = document.createElement("div");
    element.setAttribute("data-testid", "badge");
    mount({
      viewpoints: [{ lat: 46.88, lng: -113.97, label: "Lookout", badge: true }],
      viewpointMarkers: [{ lat: 46.88, lng: -113.97, element }],
    });
    await flush();
    expect(circles(theme.chrome.fg)).toHaveLength(0);
    expect(labelMarkers()).toHaveLength(1);
    expect(map().panes.overlayMouseTarget.contains(element)).toBe(true);
  });
});

describe("route mode on Google: the start and the end", () => {
  it("stands the start element on the first point and a circle on the last", async () => {
    const theme = themeOf();
    const startElement = document.createElement("div");
    mount({ startElement });
    await flush();
    expect(map().panes.overlayMouseTarget.contains(startElement)).toBe(true);
    const holder = startElement.parentElement!;
    expect(holder.style.transform).toBe("translate(-50%, -100%)");
    expect(holder.style.left).toBe(`${PATH[0].lng * 10}px`);
    expect(holder.style.top).toBe(`${PATH[0].lat * 10}px`);
    const [end] = circles(theme.chrome.text);
    expect(end.opts.position).toEqual(PATH[2]);
    expect((end.opts.icon as Circle).strokeColor).toBe(theme.chrome.bg);
  });
});

describe("route mode on Google: the map", () => {
  it("opens on the terrain map type when terrain is on, else roadmap, and switches on update", () => {
    const handle = mount({ terrain: true });
    expect(map().createOptions.mapTypeId).toBe("terrain");
    handle.update({ theme: themeOf(), path: PATH, terrain: false });
    expect(map().mapTypeId).toBe("roadmap");
    handle.destroy();
    mount();
    expect(map().createOptions.mapTypeId).toBe("roadmap");
  });

  it("restricts the map to the box with its fitted least zoom, recomputed on resize", () => {
    mount();
    const options = map().createOptions;
    expect(options.restriction).toEqual({ latLngBounds: BOX, strictBounds: true });
    expect(options.minZoom).toBe(fittedMinZoom(BOX, { width: 600, height: 400 }));
    expect(options.gestureHandling).toBe("greedy");
    expect(options.disableDefaultUI).toBe(true);
    sized(1600, 1200);
    observers[0].callback();
    expect(map().optionsCalls).toContainEqual({ minZoom: fittedMinZoom(BOX, { width: 1600, height: 1200 }) });
  });

  it("styles the map with the theme's array and hides the kinds the place filter leaves out", () => {
    mount({ poiKinds: ["park"] });
    const styles = map().createOptions.styles as google.maps.MapTypeStyle[];
    expect(styles[0]).toEqual(STANDARD_STYLE[0]);
    expect(styles).toContainEqual({ featureType: "poi.school", stylers: [{ visibility: "off" }] });
    expect(styles).not.toContainEqual({ featureType: "poi.park", stylers: [{ visibility: "off" }] });
  });

  it("applies a new theme with setOptions and redraws in its palette", () => {
    const handle = mount();
    const night = { ...themeOf("night"), style: [{ stylers: [{ invert_lightness: true }] }] };
    handle.update({ theme: night, path: PATH });
    const call = map().optionsCalls.find((c) => "styles" in c);
    expect((call!.styles as google.maps.MapTypeStyle[])[0]).toEqual(night.style[0]);
    expect(polylines()[0].opts.strokeColor).toBe(night.overlay.routeColor);
  });
});

describe("route mode on Google: the fit", () => {
  type Bounds = { points: google.maps.LatLngLiteral[] };

  it("fits the path's bounds with the padding on mount and on resize", () => {
    mount();
    expect(map().fitBoundsCalls).toHaveLength(1);
    expect((map().fitBoundsCalls[0] as Bounds).points).toEqual([
      { lat: 46.85, lng: -114.0 },
      { lat: 46.9, lng: -113.9 },
    ]);
    const fake = map() as unknown as { fitBounds: (b: unknown, p?: unknown) => void };
    const spy = vi.spyOn(fake, "fitBounds");
    observers[0].callback();
    expect(spy).toHaveBeenCalledWith(expect.anything(), FIT_PADDING);
  });

  it("clamps the path's bounds to the box only where the path leaves it", () => {
    mount({ bbox: { ...BOX, east: -113.95 } });
    expect((map().fitBoundsCalls[0] as Bounds).points).toEqual([
      { lat: 46.85, lng: -114.0 },
      { lat: 46.9, lng: -113.95 },
    ]);
  });

  it("refits on a new path and not on a same path", async () => {
    const startElement = document.createElement("div");
    const handle = mount({ startElement });
    await flush();
    handle.update({ theme: themeOf(), path: PATH.map((p) => ({ ...p })) });
    expect(map().fitBoundsCalls).toHaveLength(1);
    const moved = [{ lat: 46.8, lng: -114.1 }, ...PATH];
    handle.update({ theme: themeOf(), path: moved });
    expect(map().fitBoundsCalls).toHaveLength(2);
    expect(polylines()[0].opts.path).toEqual(moved);
    expect(startElement.parentElement!.style.left).toBe(`${-114.1 * 10}px`);
  });
});

describe("route mode on Google: destroy", () => {
  it("takes every line, marker, and element off the map", async () => {
    const startElement = document.createElement("div");
    const element = document.createElement("div");
    const handle = mount({
      startElement,
      marks: PATH,
      arrows: true,
      timeLabels: [{ lat: 46.9, lng: -113.95, label: "15m" }],
      viewpoints: [
        { lat: 46.88, lng: -113.97, label: "Ridge" },
        { lat: 46.86, lng: -113.96, label: "Lookout", badge: true },
      ],
      viewpointMarkers: [{ lat: 46.86, lng: -113.96, element }],
    });
    await flush();
    expect(live().length).toBeGreaterThan(0);
    handle.destroy();
    expect(live()).toHaveLength(0);
    expect(map().listenerCount()).toBe(0);
    expect(map().panes.overlayMouseTarget.contains(startElement)).toBe(false);
    expect(map().panes.overlayMouseTarget.contains(element)).toBe(false);
  });
});
