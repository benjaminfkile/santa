// docs/site.md section 7.6 and S16f. After the module conversion every
// map-section, map-view, and tracker-menu class lives in a typed CSS
// module. tsc catches an unknown export at compile time. This test keeps
// the render-smoke check and confirms the Map.module.css sidecar carries
// the classes the map section references at runtime.
// The map styles come from the snapshot's `trackerThemes` (the event's
// enabled Google themes), never from the section data's `themes` or
// `defaultTheme`, and mounting reports the renderer choice as the `live`
// surface. The controllers get the event's `trackerStartView` and no
// default centre or zoom. The tracker menu's toggles follow the tracker store, so a
// replace after mount (the account sync) shows at once. A theme pick
// writes the stored theme key, and a key written after mount that names
// another offered theme switches the map; one that names none changes
// nothing.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const here = dirname(fileURLToPath(import.meta.url));
const mapModulePath = resolve(here, "../../../../src/content/sections/Map/Map.module.css");
const mapViewModulePath = resolve(here, "../../../../src/map/MapView.module.css");
const trackerModulePath = resolve(here, "../../../../src/content/sections/Map/TrackerMenu.module.css");

// Rendering the Map section pulls in Google Maps through MapView; mock the
// module so the test exercises the JSX without a network load.
vi.mock("../../../../src/map/renderer", () => ({
  reportRendererFallback: vi.fn(),
  reportRenderer: vi.fn(() => "google"),
}));

// A test that sets `mocked.controller` gets it handed to the section on
// mount; the rest run without one.
// Every render records the options it was handed in `mocked.options`.
const mocked = vi.hoisted(() => ({ controller: null as unknown, options: null as unknown }));

vi.mock("../../../../src/map/MapView", async () => {
  const { useEffect } = await import("react");
  return {
    MapView: (props: {
      options?: unknown;
      className?: string;
      onController?: (c: unknown) => void;
      children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
    }) => {
      const { onController } = props;
      mocked.options = props.options;
      useEffect(() => {
        if (mocked.controller !== null) onController?.(mocked.controller);
      }, [onController]);
      return (
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
      );
    },
  };
});

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
              flightHistory: true,
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
              flightDock: true,
            },
          }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    cleanup();
  });

  it("hides the flight history toggle when snapshot.event.flightHistory is null", async () => {
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    const bundle = {
      content: null as unknown,
      media: {},
      icons: {},
    } as import("../../../../src/store/types").ContentBundle;
    const utils = render(
      <MemoryRouter>
        <Map
          data={{
            controls: {
              themePicker: true,
              terrain: true,
              snow: true,
              flightHistory: true,
              timeLabels: true,
              location: true,
              dataRow: true,
            },
            overlays: { flightDock: true },
          }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    const trackerButton = utils.container.querySelector('button[aria-label="Tracker menu"]') as HTMLButtonElement | null;
    trackerButton?.click();
    expect(utils.queryByTestId("tracker-menu-flight-history")).toBeNull();
    cleanup();
  });

  it("the tracker menu's Snow button still toggles, without writing the choice to storage", async () => {
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    const { clearSnowOverride, SNOW_KEY } = await import("../../../../src/content/theme/seasonalLayers");
    clearSnowOverride();
    const bundle = {
      content: null as unknown,
      media: {},
      icons: {},
    } as import("../../../../src/store/types").ContentBundle;
    const utils = render(
      <MemoryRouter>
        <Map data={{ controls: { snow: true } }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    fireEvent.click(utils.container.querySelector('button[aria-label="Tracker menu"]')!);
    const snow = utils.getByTestId("tracker-menu-snow");
    expect(snow.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(snow);
    expect(utils.getByTestId("tracker-menu-snow").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(utils.getByTestId("tracker-menu-snow"));
    expect(utils.getByTestId("tracker-menu-snow").getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem(SNOW_KEY)).toBeNull();
    cleanup();
    clearSnowOverride();
  });

  it("the tracker menu's toggles follow a replace of the tracker store after mount", async () => {
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    const { replaceTrackerSettings, resetTrackerTogglesForTests } = await import(
      "../../../../src/content/sections/Map/trackerToggles"
    );
    const { store } = await import("../../../../src/store/useStore");
    const { initialStore } = await import("../../../../src/store/types");
    resetTrackerTogglesForTests();
    act(() =>
      store.setState({
        ...initialStore,
        snapshot: { event: { flightHistory: { points: [{ lat: 1, lng: 2, recordedAt: null }] } } } as never,
      }),
    );
    const bundle = {
      content: null as unknown,
      media: {},
      icons: {},
    } as import("../../../../src/store/types").ContentBundle;
    const utils = render(
      <MemoryRouter>
        <Map
          data={{ controls: { terrain: true, snow: true, flightHistory: true, timeLabels: true }, overlays: { flightDock: true } }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    fireEvent.click(utils.container.querySelector('button[aria-label="Tracker menu"]')!);
    const pressed = (id: string) => utils.getByTestId(id).getAttribute("aria-pressed");
    const road = () => utils.getByRole("radio", { name: /Road/ });
    expect(road().getAttribute("aria-checked")).toBe("false");
    expect(pressed("tracker-menu-flight-dock")).toBe("true");
    expect(pressed("tracker-menu-flight-history")).toBe("false");
    expect(pressed("tracker-menu-snow")).toBe("false");

    act(() =>
      replaceTrackerSettings({
        mapType: "roadmap",
        flightDock: false,
        flightHistory: true,
        timeLabels: false,
        snow: true,
      }),
    );
    expect(road().getAttribute("aria-checked")).toBe("true");
    expect(pressed("tracker-menu-flight-dock")).toBe("false");
    expect(pressed("tracker-menu-flight-history")).toBe("true");
    expect(pressed("tracker-menu-time-labels")).toBe("false");
    expect(pressed("tracker-menu-snow")).toBe("true");

    act(() => replaceTrackerSettings({}));
    expect(road().getAttribute("aria-checked")).toBe("false");
    expect(pressed("tracker-menu-flight-dock")).toBe("true");
    expect(pressed("tracker-menu-flight-history")).toBe("false");
    cleanup();
    resetTrackerTogglesForTests();
    act(() => store.setState({ ...initialStore }));
  });

  it("map and tracker-menu modules carry the recipes the section uses", () => {
    const mapCss = readFileSync(mapModulePath, "utf8");
    const mapViewCss = readFileSync(mapViewModulePath, "utf8");
    const trackerCss = readFileSync(trackerModulePath, "utf8");
    for (const name of [
      ".mapSection",
      ".mapSectionTakeover",
      ".topLeft",
      ".topRight",
      ".bottomLeft",
      ".bottomRight",
      ".messagesPill",
      ".messagesDot",
      ".messagesShake",
      ".liveIndicator",
      ".mapControls",
      ".menuButton",
      ".cookieTally",
      ".cookieLeave",
    ]) {
      expect(mapCss).toContain(name);
    }
    for (const name of [".mapView", ".mapViewCanvas"]) {
      expect(mapViewCss).toContain(name);
    }
    for (const name of [
      ".trackerMenu",
      ".panel",
      ".theme",
      ".pill",
      ".toggle",
      ".dataRow",
      ".footerBtn",
    ]) {
      expect(trackerCss).toContain(name);
    }
  });
});

describe("Map section themes", () => {
  function themeRow(key: string, renderer: string, flags: { light?: boolean; dark?: boolean } = {}) {
    return {
      id: key.length,
      renderer,
      key,
      name: key.toUpperCase(),
      styleUrl: `https://cdn.example/themes/${key}.json`,
      spriteUrl: null,
      thumbnailMediaId: null,
      chrome: { bg: "white", fg: "gray", text: "black", tile: "silver", tileFg: "black", panel: "white", accent: "blue" },
      overlay: {
        routeColor: "blue",
        routeOpacity: 1,
        arrowColor: "white",
        timeLabelBg: "black",
        timeLabelFg: "white",
        timeLabelOpacity: 1,
        userColor: "red",
        headingColor: "#ffb300",
      },
      defaultLightMode: flags.light === true,
      defaultDarkMode: flags.dark === true,
    };
  }

  async function renderWithThemes(data: Record<string, unknown>, event: Record<string, unknown> = {}) {
    const { store } = await import("../../../../src/store/useStore");
    const { initialStore } = await import("../../../../src/store/types");
    store.setState({
      ...initialStore,
      snapshot: {
        schemaVersion: 1,
        media: {},
        icons: {},
        event: { id: 1, trackerBbox: { west: -114.3, south: 46.75, east: -113.8, north: 47.05 }, trackerMap: null, ...event },
        trackerThemes: [
          themeRow("expedition", "google"),
          themeRow("standard", "google", { light: true }),
          themeRow("night", "google", { dark: true }),
          themeRow("light", "maplibre", { light: true }),
        ],
      } as never,
    });
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    const bundle = { content: null as unknown, media: {}, icons: {} } as import("../../../../src/store/types").ContentBundle;
    return render(
      <MemoryRouter>
        <Map data={data} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
  }

  it("offers the snapshot's Google themes and starts from the appearance's flag, ignoring data.themes and data.defaultTheme", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    const utils = await renderWithThemes({
      themes: ["nebula", "charcoal"],
      defaultTheme: "charcoal",
      controls: { themePicker: true },
    });
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("standard");
    (utils.container.querySelector('button[aria-label="Tracker menu"]') as HTMLButtonElement).click();
    const keys = await utils.findAllByRole("radio");
    const themeKeys = keys
      .map((b) => b.getAttribute("data-testid"))
      .filter((id): id is string => id !== null && id.startsWith("tracker-menu-theme-"));
    expect(themeKeys).toEqual([
      "tracker-menu-theme-expedition",
      "tracker-menu-theme-standard",
      "tracker-menu-theme-night",
    ]);
    cleanup();
    document.documentElement.removeAttribute("data-theme");
  });

  it("starts from the dark flag holder on a dark page", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const utils = await renderWithThemes({ defaultTheme: "expedition" });
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("night");
    cleanup();
    document.documentElement.removeAttribute("data-theme");
  });

  it("hands the controllers the event's start view and never the section's default centre or zoom", async () => {
    const startView = { center: { lat: 46.87, lng: -113.99 }, zoom: 11 };
    await renderWithThemes(
      { defaultCenter: { lat: 39.7, lng: -104.9 }, defaultZoom: 4 },
      { trackerStartView: startView },
    );
    const options = mocked.options as Record<string, unknown>;
    expect(options.startView).toEqual(startView);
    expect(options).not.toHaveProperty("defaultCenter");
    expect(options).not.toHaveProperty("defaultZoom");
    cleanup();
  });

  it("hands the controllers a null start view when the event has none", async () => {
    await renderWithThemes({}, { trackerStartView: null });
    expect((mocked.options as Record<string, unknown>).startView).toBeNull();
    cleanup();
  });

  it("reports the renderer choice as the live surface on mount", async () => {
    const { reportRenderer } = await import("../../../../src/map/renderer");
    vi.mocked(reportRenderer).mockClear();
    await renderWithThemes({});
    expect(reportRenderer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(reportRenderer).mock.calls[0][0]).toBe("live");
    cleanup();
  });

  function fakeController() {
    const setTheme = vi.fn(() => Promise.resolve());
    const controller = new Proxy({ setTheme } as Record<string | symbol, unknown>, {
      get(target, prop) {
        if (prop === "then") return undefined;
        if (!(prop in target)) target[prop] = vi.fn();
        return target[prop];
      },
    });
    return { controller, setTheme };
  }

  it("a pick writes the stored theme key", async () => {
    const { readThemeKey, resetThemeKeyForTests } = await import("../../../../src/map/themes");
    resetThemeKeyForTests();
    const fake = fakeController();
    mocked.controller = fake.controller;
    document.documentElement.setAttribute("data-theme", "light");
    const utils = await renderWithThemes({ controls: { themePicker: true } });
    fireEvent.click(utils.container.querySelector('button[aria-label="Tracker menu"]')!);
    await act(async () => {
      fireEvent.click(await utils.findByTestId("tracker-menu-theme-expedition"));
    });
    expect(fake.setTheme).toHaveBeenLastCalledWith(expect.objectContaining({ key: "expedition" }));
    expect(readThemeKey()).toBe("expedition");
    expect(window.localStorage.getItem("wmsfo.tracker.theme")).toBe("expedition");
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("expedition");
    cleanup();
    mocked.controller = null;
    resetThemeKeyForTests();
    document.documentElement.removeAttribute("data-theme");
  });

  it("a key written after mount that names an offered theme switches the map", async () => {
    const { resetThemeKeyForTests, writeThemeKey } = await import("../../../../src/map/themes");
    resetThemeKeyForTests();
    const fake = fakeController();
    mocked.controller = fake.controller;
    document.documentElement.setAttribute("data-theme", "light");
    const utils = await renderWithThemes({ controls: { themePicker: true } });
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("standard");
    fake.setTheme.mockClear();
    await act(async () => writeThemeKey("night"));
    expect(fake.setTheme).toHaveBeenCalledTimes(1);
    expect(fake.setTheme).toHaveBeenCalledWith(expect.objectContaining({ key: "night" }));
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("night");
    cleanup();
    mocked.controller = null;
    resetThemeKeyForTests();
    document.documentElement.removeAttribute("data-theme");
  });

  it("a key written after mount that names no offered theme changes nothing", async () => {
    const { resetThemeKeyForTests, writeThemeKey } = await import("../../../../src/map/themes");
    resetThemeKeyForTests();
    const fake = fakeController();
    mocked.controller = fake.controller;
    document.documentElement.setAttribute("data-theme", "light");
    const utils = await renderWithThemes({ controls: { themePicker: true } });
    fake.setTheme.mockClear();
    // `light` is a MapLibre theme and `nebula` is not enabled.
    await act(async () => writeThemeKey("light"));
    await act(async () => writeThemeKey("nebula"));
    await act(async () => writeThemeKey(null));
    expect(fake.setTheme).not.toHaveBeenCalled();
    expect(utils.getByTestId("map").getAttribute("data-theme-key")).toBe("standard");
    cleanup();
    mocked.controller = null;
    resetThemeKeyForTests();
    document.documentElement.removeAttribute("data-theme");
  });

  it("reads neither themes nor defaultTheme from the section data", () => {
    const src = readFileSync(resolve(here, "../../../../src/content/sections/Map/Map.tsx"), "utf8");
    expect(src).not.toMatch(/d\.themes|d\.defaultTheme|defaultTheme\?:|themes\?:/);
  });
});
