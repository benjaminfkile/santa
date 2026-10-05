// docs/site.md sections 7.6 and 8.5. The flight gauge: three dials stacked
// above the sponsor tile with the converted units, the airborne and
// distance pills in the top-left stack (neither is a dial), the tracker
// menu's hide toggle, and hiding while the menu is open.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { LiveObject, Snapshot } from "../../../../src/contracts";
import type { UserLocationState } from "../../../../src/map/userLocation";
import { resetTrackerTogglesForTests } from "../../../../src/content/sections/Map/trackerToggles";

// CSS processing is off in unit tests, so the Map module's classes map to
// their own names here; the rules themselves are read from the file.
vi.mock("../../../../src/content/sections/Map/Map.module.css", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const css = readFileSync(resolve(__dirname, "../../../../src/content/sections/Map/Map.module.css"), "utf8");
  const names = new Set(Array.from(css.matchAll(/\.([a-zA-Z][a-zA-Z0-9]*)/g), (m) => m[1]));
  return Object.fromEntries(Array.from(names, (n) => [n, n]));
});

type Options = { onUserLocationChange: (s: UserLocationState) => void };
const mapView: { options: Options | null } = { options: null };

vi.mock("../../../../src/map/MapView", () => ({
  MapView: (props: {
    options: Options;
    children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
  }) => {
    mapView.options = props.options;
    return (
      <div>
        {typeof props.children === "function"
          ? (props.children({ controller: null, error: null, retry: () => {} }) as React.ReactNode)
          : null}
      </div>
    );
  },
}));

const mapDir = resolve(__dirname, "../../../../src/content/sections/Map");

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

const WENT_LIVE = "2026-12-24T01:00:00Z";

function seed(live: Partial<LiveObject>, opts: { timeReady?: boolean; wentLiveAt?: string | null } = {}) {
  const timeReady = opts.timeReady ?? true;
  act(() =>
    store.setState({
      ...initialStore,
      live: {
        schemaVersion: 1,
        publishedAt: "",
        eventStatusId: 3,
        cookieTally: {},
        speedMps: null,
        altitudeM: null,
        headingDeg: null,
        accuracyM: null,
        ...live,
      } as LiveObject,
      snapshot: {
        schemaVersion: 1,
        event: {
          statusId: timeReady ? 3 : 2,
          wentLiveAt: opts.wentLiveAt === undefined ? WENT_LIVE : opts.wentLiveAt,
        },
      } as unknown as Snapshot,
    }),
  );
}

const FULL = { speedMps: 44.704, altitudeM: 1524, headingDeg: 92.4, accuracyM: 3.048 };

async function renderMap(overlays: Record<string, boolean> = {}) {
  const { Map } = await import("../../../../src/content/sections/Map/Map");
  return render(
    <MemoryRouter>
      <Map data={{ overlays }} items={[]} bundle={bundle} />
    </MemoryRouter>,
  );
}

function value(utils: ReturnType<typeof render>, slot: string): string {
  return utils.getByTestId(`flight-gauge-${slot}-value`).textContent ?? "";
}

function setWidth(px: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
}

beforeEach(() => {
  resetTrackerTogglesForTests();
  setWidth(1024);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-24T02:12:30Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => store.setState({ ...initialStore }));
  resetTrackerTogglesForTests();
});

describe("the flight gauge", () => {
  it("stacks speed, altitude and heading, all three up, above the sponsor tile", async () => {
    seed(FULL);
    const utils = await renderMap();
    const gauge = utils.getByTestId("flight-gauge");
    expect(utils.getByTestId("map-bottom-left").contains(gauge)).toBe(true);

    // All three are drawn at once, in order, each in its own glass face.
    const dials = Array.from(gauge.querySelectorAll('[data-testid$="-value"]')).map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(dials).toEqual([
      "flight-gauge-speed-value",
      "flight-gauge-altitude-value",
      "flight-gauge-heading-value",
    ]);
    expect(gauge.children).toHaveLength(3);

    expect(utils.getByTestId("flight-gauge-speed").getAttribute("aria-label")).toBe("Speed 100 mph");
    expect(utils.getByTestId("flight-gauge-speed-arc")).toBeInTheDocument();
    expect(utils.getByTestId("flight-gauge-altitude").getAttribute("aria-label")).toBe("Altitude 5k ft");
    expect(utils.getByTestId("flight-gauge-altitude-label").textContent).toBe("ALTITUDE");
    expect(utils.getByTestId("flight-gauge-heading").getAttribute("aria-label")).toBe("Heading 92° E");
    expect(utils.getByTestId("flight-gauge-heading-rose")).toBeInTheDocument();
    expect(utils.getByTestId("flight-gauge-heading-needle-line").style.transform).toBe("rotate(92.4deg)");

    // Nothing to step with, and the airborne time is a pill, not a dial.
    expect(utils.queryByTestId("flight-gauge-next")).toBeNull();
    expect(utils.queryByTestId("flight-gauge-prev")).toBeNull();
    expect(utils.queryByTestId("flight-gauge-airborne")).toBeNull();
  });

  it("reads thousands the way the rest of the tracker does", async () => {
    // 1524 m is 5000 ft, so the dial abbreviates like every other number.
    seed(FULL);
    const utils = await renderMap();
    expect(value(utils, "altitude")).toBe("5k");
    expect(utils.getByTestId("flight-gauge-altitude").getAttribute("aria-label")).toBe("Altitude 5k ft");
  });

  it("shows the placeholder and no arc for a null reading", async () => {
    seed({});
    const utils = await renderMap();
    expect(value(utils, "speed")).toBe("N/A");
    expect(utils.queryByTestId("flight-gauge-speed-arc")).toBeNull();
    expect(value(utils, "altitude")).toBe("N/A");
    expect(value(utils, "heading")).toBe("N/A");
  });

  it("the airborne pill is up the whole time, directly under the live pill", async () => {
    seed(FULL);
    const utils = await renderMap({ liveIndicator: true });
    const pill = utils.getByTestId("airborne-pill");
    expect(pill.textContent).toContain("1h 12m");
    const stack = utils.container.querySelector(".topLeft")!;
    const ids = Array.from(stack.children).map((el) => el.getAttribute("data-testid") ?? el.className);
    expect(ids[0]).toContain("liveIndicator");
    expect(ids[1]).toBe("airborne-pill");
    // Not one of the dials.
    expect(utils.queryByTestId("flight-gauge-airborne")).toBeNull();
  });

  it("the airborne pill is absent until timeReady and without a liftoff time", async () => {
    seed(FULL, { timeReady: false });
    const utils = await renderMap();
    expect(utils.queryByTestId("airborne-pill")).toBeNull();
    seed(FULL, { wentLiveAt: null });
    expect(utils.queryByTestId("airborne-pill")).toBeNull();
    seed(FULL, { wentLiveAt: "not a time" });
    expect(utils.queryByTestId("airborne-pill")).toBeNull();
    seed(FULL);
    expect(utils.getByTestId("airborne-pill").textContent).toContain("1h 12m");
  });

  it("liftoffTimer off removes the airborne pill and leaves the dials alone", async () => {
    seed(FULL);
    const utils = await renderMap({ liftoffTimer: false });
    expect(utils.queryByTestId("airborne-pill")).toBeNull();
    expect(utils.getByTestId("flight-gauge").children).toHaveLength(3);
  });

  it("flightDock off removes the gauge and its menu button, the airborne pill staying", async () => {
    seed(FULL);
    const utils = await renderMap({ flightDock: false });
    expect(utils.queryByTestId("flight-gauge")).toBeNull();
    expect(utils.getByTestId("airborne-pill")).toBeInTheDocument();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    expect(utils.queryByTestId("tracker-menu-flight-dock")).toBeNull();
  });

  it("the distance pill sits directly under the live pill with the messages pill last", async () => {
    seed(FULL);
    act(() =>
      store.setState((prev) => ({
        ...prev,
        snapshot: {
          ...prev.snapshot,
          event: { ...prev.snapshot!.event, id: 7, latestMessage: { id: 3, body: "Hello" } },
        } as unknown as Snapshot,
      })),
    );
    const utils = await renderMap({ distanceChip: true, liveIndicator: true, latestMessage: true });
    const stack = () => utils.container.querySelector(".topLeft")!;
    const ids = () =>
      Array.from(stack().children).map((el) => el.getAttribute("data-testid") ?? el.className);

    // No location, no distance pill; the messages pill is still last.
    expect(utils.queryByTestId("distance-pill")).toBeNull();
    expect(ids()[ids().length - 1]).toBe("messages-pill");

    act(() =>
      mapView.options!.onUserLocationChange({
        enabled: true,
        position: { lat: 1, lng: 2 },
        error: null,
        distanceMetres: 5000,
      }),
    );
    const pill = utils.getByTestId("distance-pill");
    expect(pill.textContent).toContain("3.11 mi");
    expect(stack().contains(pill)).toBe(true);
    // The live pill first, the distance directly under it, the messages
    // pill last.
    const order = ids();
    expect(order[0]).toContain("liveIndicator");
    expect(order[1]).toBe("airborne-pill");
    expect(order[2]).toBe("distance-pill");
    expect(order[order.length - 1]).toBe("messages-pill");
  });

  it("the distance pill follows the distance chip flag", async () => {
    seed(FULL);
    const utils = await renderMap({ distanceChip: false, liveIndicator: true });
    act(() =>
      mapView.options!.onUserLocationChange({
        enabled: true,
        position: { lat: 1, lng: 2 },
        error: null,
        distanceMetres: 5000,
      }),
    );
    expect(utils.queryByTestId("distance-pill")).toBeNull();
  });

  it("the tracker menu's gauge button hides it, and that choice survives a remount", async () => {
    seed(FULL);
    const utils = await renderMap();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    const btn = utils.getByTestId("tracker-menu-flight-dock");
    expect(btn.getAttribute("aria-label")).toBe("Gauges");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(utils.getByTestId("tracker-menu-flight-dock").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(utils.getByRole("button", { name: "Close menu" }));
    expect(utils.queryByTestId("flight-gauge")).toBeNull();
    cleanup();

    const again = await renderMap();
    expect(again.queryByTestId("flight-gauge")).toBeNull();
    fireEvent.click(again.getByRole("button", { name: "Tracker menu" }));
    fireEvent.click(again.getByTestId("tracker-menu-flight-dock"));
    fireEvent.click(again.getByRole("button", { name: "Close menu" }));
    expect(again.getByTestId("flight-gauge")).toBeInTheDocument();
  });

  it("hides with the other overlays while the tracker menu is open", async () => {
    seed(FULL);
    const utils = await renderMap();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    expect(utils.queryByTestId("flight-gauge")).toBeNull();
    fireEvent.click(utils.getByRole("button", { name: "Close menu" }));
    expect(utils.getByTestId("flight-gauge")).toBeInTheDocument();
  });

  it("nothing spans the map any more: the dock is gone and neither stack lifts", async () => {
    seed(FULL);
    const utils = await renderMap({ distanceChip: true });
    expect(utils.queryByTestId("flight-dock")).toBeNull();
    expect(utils.queryByTestId("flight-dock-handle")).toBeNull();
    expect(utils.getByTestId("map-bottom-left").className).not.toContain("lifted");
    expect(utils.getByTestId("map-bottom-right").className).not.toContain("lifted");
    for (const name of [
      "FlightDock.tsx",
      "FlightDock.module.css",
      "LiftoffTimer.tsx",
      "DistanceChip.tsx",
      "LiveStrip.tsx",
    ]) {
      expect(existsSync(resolve(mapDir, name))).toBe(false);
    }
    const css = readFileSync(resolve(mapDir, "Map.module.css"), "utf8");
    expect(css).not.toContain("--dock-height");
    expect(css).not.toContain(".lifted");
  });
});
