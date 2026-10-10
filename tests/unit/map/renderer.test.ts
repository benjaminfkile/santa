// docs/site.md sections 8.1 and 16. The renderer choice: no map, no
// MapLibre theme, and no WebGL 2 each give `google` with their reason, in
// that order of precedence; a map, a MapLibre theme, and WebGL 2 give
// `maplibre`. The WebGL 2 probe runs once per page. `reportRenderer` sends
// one `map_renderer` event per surface with `surface`, `renderer`, and
// `reason`.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendEvent = vi.fn();
vi.mock("../../../src/lib/analytics", () => ({ sendEvent }));

type RendererModule = typeof import("../../../src/map/renderer");

const MAP = { id: 3, tilesUrl: "https://cdn.example/basemap/tiles.pmtiles", terrainUrl: null };

function snapshot(opts: { map?: boolean; maplibre?: boolean }) {
  return {
    event: { trackerBbox: {}, trackerMap: opts.map === false ? null : MAP },
    trackerThemes: [
      { key: "standard", renderer: "google" },
      ...(opts.maplibre === false ? [] : [{ key: "light", renderer: "maplibre" }]),
    ],
  } as never;
}

let getContext: ReturnType<typeof vi.fn>;
let loseContext: ReturnType<typeof vi.fn>;
let mod: RendererModule;

async function load(webgl2: boolean): Promise<void> {
  vi.resetModules();
  loseContext = vi.fn();
  getContext = vi.fn((kind: string) =>
    kind === "webgl2" && webgl2
      ? { getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null) }
      : null,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(getContext as never);
  mod = await import("../../../src/map/renderer");
}

beforeEach(() => {
  sendEvent.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickRenderer", () => {
  it("gives google with no_map when the event has no map", async () => {
    await load(true);
    expect(mod.rendererChoice(snapshot({ map: false }))).toEqual({ renderer: "google", reason: "no_map" });
    expect(mod.pickRenderer(snapshot({ map: false, maplibre: false }))).toBe("google");
    expect(mod.rendererChoice(null)).toEqual({ renderer: "google", reason: "no_map" });
    expect(getContext).not.toHaveBeenCalled();
  });

  it("gives google with no_theme when no MapLibre theme is enabled", async () => {
    await load(true);
    expect(mod.rendererChoice(snapshot({ maplibre: false }))).toEqual({ renderer: "google", reason: "no_theme" });
    expect(getContext).not.toHaveBeenCalled();
  });

  it("gives google with webgl2_unavailable without WebGL 2", async () => {
    await load(false);
    expect(mod.rendererChoice(snapshot({}))).toEqual({ renderer: "google", reason: "webgl2_unavailable" });
    expect(mod.pickRenderer(snapshot({}))).toBe("google");
  });

  it("gives maplibre with a map, a MapLibre theme, and WebGL 2", async () => {
    await load(true);
    expect(mod.rendererChoice(snapshot({}))).toEqual({ renderer: "maplibre", reason: "ok" });
    expect(mod.pickRenderer(snapshot({}))).toBe("maplibre");
  });

  it("probes once per page, asking for no performance caveat and losing the context", async () => {
    await load(true);
    mod.pickRenderer(snapshot({}));
    mod.pickRenderer(snapshot({}));
    expect(mod.canUseWebGl2()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith("webgl2", { failIfMajorPerformanceCaveat: true });
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});

describe("reportRenderer", () => {
  it("sends one map_renderer event per surface with the three bare params", async () => {
    await load(false);
    expect(mod.reportRenderer("route", snapshot({}))).toBe("google");
    mod.reportRenderer("route", snapshot({}));
    mod.reportRenderer("live", snapshot({ map: false }));
    mod.reportRenderer("live", snapshot({}));
    expect(sendEvent).toHaveBeenCalledTimes(2);
    expect(sendEvent).toHaveBeenNthCalledWith(1, "map_renderer", {
      surface: "route",
      renderer: "google",
      reason: "webgl2_unavailable",
    });
    expect(sendEvent).toHaveBeenNthCalledWith(2, "map_renderer", {
      surface: "live",
      renderer: "google",
      reason: "no_map",
    });
  });

  it("reports maplibre with the reason ok", async () => {
    await load(true);
    mod.reportRenderer("live", snapshot({}));
    expect(sendEvent).toHaveBeenCalledWith("map_renderer", { surface: "live", renderer: "maplibre", reason: "ok" });
  });
});
