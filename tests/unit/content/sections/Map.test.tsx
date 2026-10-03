// docs/site.md section 7.6 and S16f. After the module conversion every
// map-section, map-view, and tracker-menu class lives in a typed CSS
// module. tsc catches an unknown export at compile time. This test keeps
// the render-smoke check and confirms the Map.module.css sidecar carries
// the classes the map section references at runtime.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const here = dirname(fileURLToPath(import.meta.url));
const mapModulePath = resolve(here, "../../../../src/content/sections/Map/Map.module.css");
const mapViewModulePath = resolve(here, "../../../../src/map/MapView.module.css");
const trackerModulePath = resolve(here, "../../../../src/content/sections/Map/TrackerMenu.module.css");

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
              liveStrip: true,
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
            overlays: { liveStrip: true },
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
      ".messageOverlay",
      ".liveStrip",
      ".liveIndicator",
      ".liftoffTimer",
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
