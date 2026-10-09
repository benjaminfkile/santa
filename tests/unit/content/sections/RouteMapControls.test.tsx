// docs/site.md sections 8.9, 22.1. The route map's control stack with
// MapLibre and pmtiles mocked and the seeded route themes served from the
// contracts fixtures:
//  - The fullscreen button and the terrain toggle render by default and
//    hide when the event's `routeMapConfig.controls.fullscreen` or
//    `routeMapConfig.controls.terrain` is false, and a null config shows
//    both; the same switches in the section data change nothing; the
//    terrain toggle also hides when the theme has no terrain layer.
//  - Fullscreen enters and exits through the Fullscreen API and through
//    the takeover, resizing the map and refitting the path on both edges;
//    Escape exits both; the takeover alone locks the body scroll; the
//    stage holds no slider, and the same map, with no
//    cooperativeGestures option, stays up.
//  - A document with only the webkit flag (iPhone Safari) goes straight
//    to the takeover, which mounts under document.body; the API path
//    changes state only on a fullscreenchange, and a rejected or
//    unconfirmed request falls back to the takeover; a route change
//    releases the body scroll like every other exit.
//  - The terrain view starts on with no remembered choice and off with a
//    remembered off; the toggle adds and removes the hillshade layer, the
//    choice is stored, restores on the next mount, and survives an
//    appearance switch, each theme keeping its own hillshade paint.
// Every test imports the modules afresh, so the once-per-page-load theme
// bodies are fetched again.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import type { ComponentType } from "react";
import type { ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { ROUTE_THEME_ROWS, routeStyle, stubThemeFetch } from "../../mapHost/routeThemes";

type FakeMapInstance = {
  options: Record<string, unknown>;
  setStyle: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  maps: [] as FakeMapInstance[],
}));

vi.mock("../../../../src/map/renderer", () => ({
  reportRendererFallback: vi.fn(),
  reportRenderer: vi.fn(() => "maplibre"),
}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    setStyle = vi.fn();
    fitBounds = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.maps.push(this as unknown as FakeMapInstance);
    }
    on() {
      return this;
    }
    getZoom() {
      return 10;
    }
    getCanvas() {
      return this.canvas;
    }
    canvas = document.createElement("canvas");
    once() {
      return this;
    }
  }
  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class FakePopup {
    setLngLat() {
      return this;
    }
    setText() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  return { Map: FakeMap, Marker: FakeMarker, Popup: FakePopup, addProtocol: vi.fn(), setWorkerUrl: vi.fn() };
});

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));

vi.mock("pmtiles", () => {
  class Protocol {
    tile = vi.fn();
  }
  return { Protocol };
});

const BASEMAP = "https://cdn.example/basemap";
const TERRAIN_URL = `${BASEMAP}/terrain.pmtiles`;
const PATH = [
  { lat: 46.87, lng: -114.0 },
  { lat: 46.9, lng: -113.95 },
  { lat: 46.85, lng: -113.9 },
];
const TIMELINE = [
  { minutes: 0, lat: 46.87, lng: -114.0 },
  { minutes: 5, lat: 46.9, lng: -113.95 },
  { minutes: 10, lat: 46.85, lng: -113.9 },
];

type StyleShape = {
  sources: Record<string, { type: string; url?: string; encoding?: string }>;
  layers: { id: string; type: string; source?: string; paint?: Record<string, unknown> }[];
};

type SectionProps = { data: unknown; items: unknown[]; bundle: ContentBundle };

let RoutePreview: ComponentType<SectionProps>;
let store: typeof import("../../../../src/store/useStore").store;
let initialStore: typeof import("../../../../src/store/types").initialStore;

function buildBundle(): ContentBundle {
  return {
    content: { pages: [], nav: [] } as unknown as ContentDocument,
    media: {},
    icons: {},
  } as unknown as ContentBundle;
}

// A theme with the seeded light body less its terrain layer.
const FLAT_URL = "https://cdn.example/themes/flat.json";
const FLAT_ROWS = [{ ...ROUTE_THEME_ROWS[0], key: "flat", styleUrl: FLAT_URL }];

function hillshadePaint(key: "route-light" | "route-dark"): unknown {
  return routeStyle(key).layers.find((l) => l.id === "terrain-hillshade")?.paint;
}

function setEvent(
  routeMapConfig: Record<string, unknown> | null = null,
  terrainUrl: string | null = TERRAIN_URL,
  trackerThemes: unknown = ROUTE_THEME_ROWS,
): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: {
        id: 1,
        routeMap: { path: PATH, timeline: TIMELINE, durationMinutes: 10, timed: true },
        routeMapConfig,
        trackerMap: { id: 3, tilesUrl: `${BASEMAP}/tiles.pmtiles`, terrainUrl },
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

// Renders a `map` section with `config` as the event's `routeMapConfig`
// and `data` added to the section data.
async function renderSection(
  config: Record<string, unknown> | null = null,
  data: Record<string, unknown> = {},
  terrainUrl: string | null = TERRAIN_URL,
  trackerThemes: unknown = ROUTE_THEME_ROWS,
) {
  setEvent(config, terrainUrl, trackerThemes);
  const result = render(
    <MemoryRouter>
      <RoutePreview data={data} items={[]} bundle={buildBundle()} />
    </MemoryRouter>,
  );
  await settle();
  return result;
}

function q(container: ParentNode, testId: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${testId}"]`);
}

function hasHillshade(style: StyleShape): boolean {
  return style.layers.some((l) => l.id === "terrain-hillshade");
}

function lastStyle(map: FakeMapInstance): StyleShape {
  const calls = map.setStyle.mock.calls;
  return (calls.length > 0 ? calls[calls.length - 1][0] : map.options.style) as StyleShape;
}

// A document with the Fullscreen API: `requestFullscreen` makes the
// element the fullscreen element and fires `fullscreenchange`, as does
// `exitFullscreen` on the way out.
function installFullscreenApi() {
  let current: Element | null = null;
  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));
  const request = vi.fn(async function (this: Element) {
    current = this;
    fire();
  });
  const exit = vi.fn(async () => {
    current = null;
    fire();
  });
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => current });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: request,
  });
  return { request, exit };
}

function removeFullscreenApi(): void {
  const d = document as unknown as Record<string, unknown>;
  delete d.fullscreenEnabled;
  delete d.fullscreenElement;
  delete d.exitFullscreen;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
}

beforeEach(async () => {
  vi.resetModules();
  mocks.maps.length = 0;
  const flat = routeStyle("route-light");
  stubThemeFetch({
    extra: { [FLAT_URL]: { ...flat, layers: flat.layers.filter((l) => l.id !== "terrain-hillshade") } },
  });
  window.localStorage.clear();
  document.body.style.overflow = "";
  document.documentElement.setAttribute("data-theme", "light");
  ({ RoutePreview } = await import("../../../../src/content/sections/RoutePreview/RoutePreview"));
  ({ store } = await import("../../../../src/store/useStore"));
  ({ initialStore } = await import("../../../../src/store/types"));
  setEvent();
});

afterEach(() => {
  cleanup();
  removeFullscreenApi();
  store.setState(() => ({ ...initialStore }));
  document.documentElement.removeAttribute("data-theme");
  document.body.style.overflow = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("route map control stack", () => {
  it("renders the fullscreen button and the terrain toggle by default", async () => {
    const { container } = await renderSection();
    const fullscreen = q(container, "route-map-fullscreen");
    const terrain = q(container, "route-map-terrain");
    expect(fullscreen?.getAttribute("aria-label")).toBe("Show the route map fullscreen");
    expect(terrain?.getAttribute("aria-label")).toBe("Terrain view");
    expect(terrain?.getAttribute("aria-pressed")).toBe("true");
    expect(q(container, "route-map-controls")?.contains(fullscreen!)).toBe(true);
  });

  it("hides each button when its switch is false", async () => {
    const first = await renderSection({ controls: { fullscreen: false } });
    expect(q(first.container, "route-map-fullscreen")).toBeNull();
    expect(q(first.container, "route-map-terrain")).not.toBeNull();
    cleanup();

    const second = await renderSection({ controls: { terrain: false } });
    expect(q(second.container, "route-map-fullscreen")).not.toBeNull();
    expect(q(second.container, "route-map-terrain")).toBeNull();
    cleanup();

    const third = await renderSection({ controls: { fullscreen: false, terrain: false } });
    expect(q(third.container, "route-map-controls")).toBeNull();
  });

  it("shows both buttons for a null config or null switches", async () => {
    const first = await renderSection(null);
    expect(q(first.container, "route-map-fullscreen")).not.toBeNull();
    expect(q(first.container, "route-map-terrain")).not.toBeNull();
    cleanup();

    const second = await renderSection({ controls: { fullscreen: null, terrain: null } });
    expect(q(second.container, "route-map-fullscreen")).not.toBeNull();
    expect(q(second.container, "route-map-terrain")).not.toBeNull();
  });

  it("ignores switches in the section data", async () => {
    const { container } = await renderSection(null, { controls: { fullscreen: false, terrain: false } });
    expect(q(container, "route-map-fullscreen")).not.toBeNull();
    expect(q(container, "route-map-terrain")).not.toBeNull();
  });

  it("hides the terrain toggle when the theme has no terrain layer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = await renderSection(null, {}, TERRAIN_URL, FLAT_ROWS);
    expect(q(container, "route-map")).not.toBeNull();
    expect(q(container, "route-map-terrain")).toBeNull();
    expect(q(container, "route-map-fullscreen")).not.toBeNull();
    expect(hasHillshade(lastStyle(mocks.maps[0]))).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("shows no terrain toggle and no terrain layers when the event's map has no terrain archive", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = await renderSection(null, {}, null);
    expect(q(container, "route-map")).not.toBeNull();
    expect(q(container, "route-map-terrain")).toBeNull();
    expect(q(container, "route-map-fullscreen")).not.toBeNull();
    const style = lastStyle(mocks.maps[0]);
    expect(hasHillshade(style)).toBe(false);
    expect(style.sources.terrain).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("route map fullscreen", () => {
  it("enters and exits through the Fullscreen API, refitting on both edges", async () => {
    const api = installFullscreenApi();
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    const map = mocks.maps[0];
    const button = q(container, "route-map-fullscreen")!;

    await act(async () => {
      fireEvent.click(button);
    });
    await settle();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request.mock.contexts[0]).toBe(stage);
    expect(stage.getAttribute("data-fullscreen")).toBe("api");
    expect(stage.contains(q(container, "route-map-frame"))).toBe(true);
    expect(stage.querySelector('input[type="range"]')).toBeNull();
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(q(container, "route-map-fullscreen")?.getAttribute("aria-label")).toBe("Exit fullscreen");
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(api.exit).toHaveBeenCalledTimes(1);
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(map.resize).toHaveBeenCalledTimes(2);
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(q(container, "route-map-fullscreen")?.getAttribute("aria-label")).toBe(
      "Show the route map fullscreen",
    );
  });

  it("exits the Fullscreen API on Escape", async () => {
    const api = installFullscreenApi();
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("api");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await settle();
    expect(api.exit).toHaveBeenCalledTimes(1);
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(mocks.maps[0].resize).toHaveBeenCalledTimes(2);
  });

  it("follows a fullscreen exit made by the browser", async () => {
    const api = installFullscreenApi();
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    await act(async () => {
      await (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen();
    });
    await settle();
    expect(api.exit).toHaveBeenCalledTimes(1);
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(mocks.maps[0].fitBounds).toHaveBeenCalledTimes(2);
  });

  it("takes over the viewport where the API is missing, locking the body scroll only while up", async () => {
    const { container: section } = await renderSection();
    const container = document.body;
    const stage = q(container, "route-map-stage")!;
    const map = mocks.maps[0];
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");
    expect(document.body.style.overflow).toBe("hidden");
    expect(stage.parentElement?.parentElement).toBe(document.body);
    expect(section.contains(stage)).toBe(false);
    expect(mocks.maps).toHaveLength(1);
    expect(map.options).not.toHaveProperty("cooperativeGestures");
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(q(container, "route-map-fullscreen")?.getAttribute("aria-label")).toBe("Exit fullscreen");

    expect(stage.querySelector('input[type="range"]')).toBeNull();
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");

    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(document.body.style.overflow).toBe("");
    expect(section.contains(stage)).toBe(true);
    expect(map.resize).toHaveBeenCalledTimes(2);
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
  });

  it("leaves the takeover on Escape and releases the body scroll", async () => {
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(document.body.style.overflow).toBe("");
    expect(mocks.maps[0].resize).toHaveBeenCalledTimes(2);
    expect(mocks.maps[0].fitBounds).toHaveBeenCalledTimes(2);
  });

  it("releases the body scroll when the section unmounts in the takeover", async () => {
    const { container, unmount } = await renderSection();
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("route map fullscreen on a phone and on a refused request", () => {
  // iPhone Safari: the webkit flag and the prefixed element call, and no
  // unprefixed element API.
  function installIphoneApi() {
    const webkitRequest = vi.fn();
    Object.defineProperty(document, "webkitFullscreenEnabled", { configurable: true, get: () => true });
    Object.defineProperty(HTMLElement.prototype, "webkitRequestFullscreen", {
      configurable: true,
      value: webkitRequest,
    });
    return webkitRequest;
  }

  afterEach(() => {
    vi.useRealTimers();
    delete (document as unknown as Record<string, unknown>).webkitFullscreenEnabled;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).webkitRequestFullscreen;
  });

  it("goes straight to the takeover under document.body with only the webkit flag", async () => {
    const webkitRequest = installIphoneApi();
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(webkitRequest).not.toHaveBeenCalled();
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");
    expect(stage.parentElement?.parentElement).toBe(document.body);
    expect(container.contains(stage)).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("changes nothing until a fullscreenchange arrives", async () => {
    const api = installFullscreenApi();
    let confirm: () => void = () => {};
    api.request.mockImplementation(async function (this: Element) {
      confirm = () => {
        Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => this });
        document.dispatchEvent(new Event("fullscreenchange"));
      };
    });
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(mocks.maps[0].resize).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      confirm();
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("api");
    expect(container.contains(stage)).toBe(true);
    expect(document.body.style.overflow).toBe("");
    expect(mocks.maps[0].resize).toHaveBeenCalledTimes(1);
  });

  it("falls back to the takeover when the request rejects", async () => {
    const api = installFullscreenApi();
    api.request.mockImplementation(async () => {
      throw new TypeError("not allowed");
    });
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");
    expect(stage.parentElement?.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("falls back to the takeover when the request never brings a fullscreenchange", async () => {
    const api = installFullscreenApi();
    api.request.mockImplementation(async () => {});
    const { container } = await renderSection();
    const stage = q(container, "route-map-stage")!;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
      await Promise.resolve();
    });
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(document.body.style.overflow).toBe("");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("releases the body scroll on a route change", async () => {
    let go: (path: string) => void = () => {};
    function Navigator() {
      const navigate = useNavigate();
      go = (path) => void navigate(path);
      return null;
    }
    setEvent(null);
    const { container } = render(
      <MemoryRouter>
        <Navigator />
        <RoutePreview data={{}} items={[]} bundle={buildBundle()} />
      </MemoryRouter>,
    );
    await settle();
    const stage = q(container, "route-map-stage")!;
    await act(async () => {
      fireEvent.click(q(container, "route-map-fullscreen")!);
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("takeover");
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      go("/elsewhere");
    });
    await settle();
    expect(stage.getAttribute("data-fullscreen")).toBe("off");
    expect(document.body.style.overflow).toBe("");
    expect(container.contains(stage)).toBe(true);
  });
});

describe("route map terrain", () => {
  it("starts on with no remembered choice", async () => {
    expect(window.localStorage.getItem("wmsfo.routeMap.terrain")).toBeNull();
    const { container } = await renderSection();
    const map = mocks.maps[0];
    expect(q(container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("true");
    expect(q(container, "route-map")?.getAttribute("data-terrain")).toBe("on");
    const style = lastStyle(map);
    expect(hasHillshade(style)).toBe(true);
    expect(style.sources.terrain).toMatchObject({
      type: "raster-dem",
      url: `pmtiles://${TERRAIN_URL}`,
      encoding: "terrarium",
    });
  });

  it("stays off for a viewer who turned it off", async () => {
    window.localStorage.setItem("wmsfo.routeMap.terrain", "off");
    const { container } = await renderSection();
    const map = mocks.maps[0];
    expect(q(container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("false");
    expect(q(container, "route-map")?.getAttribute("data-terrain")).toBe("off");
    expect(hasHillshade(lastStyle(map))).toBe(false);
  });

  it("removes and adds the hillshade through the toggle and remembers the choice", async () => {
    const { container } = await renderSection();
    const map = mocks.maps[0];
    expect(hasHillshade(lastStyle(map))).toBe(true);

    await act(async () => {
      fireEvent.click(q(container, "route-map-terrain")!);
    });
    await settle();
    const off = lastStyle(map);
    expect(map.setStyle.mock.calls[map.setStyle.mock.calls.length - 1][1]).toEqual({ diff: true });
    expect(hasHillshade(off)).toBe(false);
    expect(off.layers.some((l) => l.source === "terrain")).toBe(false);
    expect(q(container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("wmsfo.routeMap.terrain")).toBe("off");

    await act(async () => {
      fireEvent.click(q(container, "route-map-terrain")!);
    });
    await settle();
    const on = lastStyle(map);
    expect(hasHillshade(on)).toBe(true);
    expect(on.sources.terrain).toMatchObject({
      type: "raster-dem",
      url: `pmtiles://${TERRAIN_URL}`,
      encoding: "terrarium",
    });
    expect(q(container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("wmsfo.routeMap.terrain")).toBe("on");
  });

  it("restores the remembered choice on the next mount and keeps it across an appearance switch", async () => {
    const first = await renderSection();
    await act(async () => {
      fireEvent.click(q(first.container, "route-map-terrain")!);
    });
    await settle();
    cleanup();

    const second = await renderSection();
    expect(q(second.container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("false");
    expect(hasHillshade(lastStyle(mocks.maps[1]))).toBe(false);
    await act(async () => {
      fireEvent.click(q(second.container, "route-map-terrain")!);
    });
    await settle();
    cleanup();

    const { container } = await renderSection();
    const map = mocks.maps[2];
    expect(q(container, "route-map-terrain")?.getAttribute("aria-pressed")).toBe("true");
    const light = lastStyle(map);
    expect(hasHillshade(light)).toBe(true);
    expect(light.layers.find((l) => l.id === "terrain-hillshade")?.paint).toEqual(hillshadePaint("route-light"));

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    await settle();
    const dark = lastStyle(map);
    expect(hasHillshade(dark)).toBe(true);
    expect(dark.layers.find((l) => l.id === "terrain-hillshade")?.paint).toEqual(hillshadePaint("route-dark"));
    expect(light.layers.map((l) => l.id)).toEqual(dark.layers.map((l) => l.id));
  });

  it("draws no hillshade when the switch is off, whatever was remembered", async () => {
    window.localStorage.setItem("wmsfo.routeMap.terrain", "on");
    const { container } = await renderSection({ controls: { terrain: false } });
    expect(q(container, "route-map-terrain")).toBeNull();
    expect(hasHillshade(lastStyle(mocks.maps[0]))).toBe(false);
  });
});
