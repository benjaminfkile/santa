// docs/site.md sections 7.6 and 8.5. The flight data dock: the speed and
// altitude dials, the heading compass, and the airborne ring with converted units, the airborne slot's blank and flag
// states, the foot line, collapse and expand with the handle pill, the
// first state by width, the dock height lifting the bottom stacks, the
// tracker menu's hide toggle, and hiding while the menu is open.

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
import { formatElapsed } from "../../../../src/lib/time";

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
  return utils.getByTestId(`flight-dock-${slot}-value`).textContent ?? "";
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

describe("the flight data dock", () => {
  it("renders the four instruments in order with the converted units", async () => {
    seed(FULL);
    const utils = await renderMap();
    const dock = utils.getByTestId("flight-dock");
    const slots = Array.from(dock.querySelectorAll('[data-testid^="flight-dock-"][data-testid$="-value"]')).map(
      (el) => el.getAttribute("data-testid"),
    );
    expect(slots).toEqual([
      "flight-dock-speed-value",
      "flight-dock-altitude-value",
      "flight-dock-heading-value",
      "flight-dock-airborne-value",
    ]);
    expect(value(utils, "speed")).toBe("100");
    expect(utils.getByTestId("flight-dock-speed").textContent).toContain("mph");
    expect(value(utils, "altitude")).toBe("5,000");
    expect(utils.getByTestId("flight-dock-altitude").textContent).toContain("ft");
    expect(value(utils, "heading")).toBe("92° E");
    expect(value(utils, "airborne")).toBe(formatElapsed(72.5 * 60 * 1000));
    expect(value(utils, "airborne")).toBe("1h 12m");
    expect(utils.getByTestId("flight-dock-airborne").textContent).toMatch(/Airborne/i);
  });

  it("the speed slot is the dial", async () => {
    seed(FULL);
    const utils = await renderMap();
    const speed = utils.getByTestId("flight-dock-speed");
    expect(speed.tagName.toLowerCase()).toBe("svg");
    expect(speed.getAttribute("aria-label")).toBe("Speed 100 mph");
    expect(utils.getByTestId("flight-dock-speed-arc")).toBeInTheDocument();
  });

  it("the airborne slot is the ring", async () => {
    seed(FULL);
    const utils = await renderMap();
    const airborne = utils.getByTestId("flight-dock-airborne");
    expect(airborne.tagName.toLowerCase()).toBe("svg");
    expect(airborne.getAttribute("aria-label")).toBe("Airborne 1h 12m");
    expect(utils.getByTestId("flight-dock-airborne-arc")).toBeInTheDocument();
    expect(utils.getByTestId("flight-dock-airborne-label").textContent).toBe("AIRBORNE");
  });

  it("the heading slot is the compass", async () => {
    seed(FULL);
    const utils = await renderMap();
    const heading = utils.getByTestId("flight-dock-heading");
    expect(heading.tagName.toLowerCase()).toBe("svg");
    expect(heading.getAttribute("aria-label")).toBe("Heading 92° E");
    expect(utils.getByTestId("flight-dock-heading-rose")).toBeInTheDocument();
    expect(utils.getByTestId("flight-dock-heading-needle-line").style.transform).toBe("rotate(92.4deg)");
    expect(utils.getByTestId("flight-dock-heading-label").textContent).toBe("HEADING");
  });

  it("the altitude slot is the dial", async () => {
    seed(FULL);
    const utils = await renderMap();
    const altitude = utils.getByTestId("flight-dock-altitude");
    expect(altitude.tagName.toLowerCase()).toBe("svg");
    expect(altitude.getAttribute("aria-label")).toBe("Altitude 5,000 ft");
    expect(utils.getByTestId("flight-dock-altitude-arc")).toBeInTheDocument();
    expect(utils.getByTestId("flight-dock-altitude-label").textContent).toBe("ALTITUDE");
  });

  it("shows the placeholder for a null field", async () => {
    seed({});
    const utils = await renderMap();
    expect(value(utils, "speed")).toBe("N/A");
    expect(value(utils, "altitude")).toBe("N/A");
    expect(value(utils, "heading")).toBe("N/A");
  });

  it("passes null to the airborne ring until timeReady and while wentLiveAt is null or unparseable", async () => {
    seed(FULL, { timeReady: false });
    const utils = await renderMap();
    expect(value(utils, "airborne")).toBe("N/A");
    expect(utils.queryByTestId("flight-dock-airborne-arc")).toBeNull();
    seed(FULL, { wentLiveAt: null });
    expect(value(utils, "airborne")).toBe("N/A");
    expect(utils.queryByTestId("flight-dock-airborne-arc")).toBeNull();
    seed(FULL, { wentLiveAt: "not a time" });
    expect(value(utils, "airborne")).toBe("N/A");
    expect(utils.queryByTestId("flight-dock-airborne-arc")).toBeNull();
    seed(FULL);
    expect(value(utils, "airborne")).toBe("1h 12m");
    expect(utils.getByTestId("flight-dock-airborne-arc")).toBeInTheDocument();
  });

  it("removes the airborne slot with liftoffTimer off", async () => {
    seed(FULL);
    const utils = await renderMap({ liftoffTimer: false });
    expect(utils.getByTestId("flight-dock-speed")).toBeInTheDocument();
    expect(utils.queryByTestId("flight-dock-airborne")).toBeNull();
  });

  it("flightDock off removes the other instruments and accuracy, keeping airborne", async () => {
    seed(FULL);
    const utils = await renderMap({ flightDock: false });
    expect(utils.queryByTestId("flight-dock-speed")).toBeNull();
    expect(utils.queryByTestId("flight-dock-altitude")).toBeNull();
    expect(utils.queryByTestId("flight-dock-heading")).toBeNull();
    expect(utils.queryByTestId("flight-dock-accuracy")).toBeNull();
    expect(value(utils, "airborne")).toBe("1h 12m");
  });

  it("the foot line shows accuracy when present and is absent when both are empty", async () => {
    seed(FULL);
    const utils = await renderMap({ distanceChip: true });
    expect(utils.getByTestId("flight-dock-accuracy").textContent).toBe("Accuracy 10 ft");
    expect(utils.queryByTestId("flight-dock-distance")).toBeNull();
    seed({ ...FULL, accuracyM: null });
    expect(utils.queryByTestId("flight-dock-foot")).toBeNull();
  });

  it("the foot line shows distance only with the flag and a location fix", async () => {
    seed({ ...FULL, accuracyM: null });
    const on = await renderMap({ distanceChip: true });
    act(() =>
      mapView.options!.onUserLocationChange({ enabled: true, position: null, error: null, distanceMetres: null }),
    );
    expect(on.queryByTestId("flight-dock-foot")).toBeNull();
    act(() =>
      mapView.options!.onUserLocationChange({
        enabled: true,
        position: { lat: 1, lng: 2 },
        error: null,
        distanceMetres: 5000,
      }),
    );
    expect(on.getByTestId("flight-dock-distance").textContent).toBe("Distance 3.11 mi");
    cleanup();

    const off = await renderMap({ distanceChip: false });
    act(() =>
      mapView.options!.onUserLocationChange({
        enabled: true,
        position: { lat: 1, lng: 2 },
        error: null,
        distanceMetres: 5000,
      }),
    );
    expect(off.queryByTestId("flight-dock-distance")).toBeNull();
    expect(off.queryByTestId("flight-dock-foot")).toBeNull();
  });

  it("collapsing shows the handle pill with speed and airborne; expanding returns the dock", async () => {
    seed(FULL);
    const utils = await renderMap();
    const toggle = utils.getByTestId("flight-dock-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toContain("Flight data");
    fireEvent.click(toggle);
    expect(utils.queryByTestId("flight-dock")).toBeNull();
    const handle = utils.getByTestId("flight-dock-handle");
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    expect(utils.getByTestId("map-bottom-left").contains(handle)).toBe(true);
    expect(utils.getByTestId("flight-dock-handle-speed").textContent).toBe("100 mph");
    expect(utils.getByTestId("flight-dock-handle-airborne").textContent).toBe("1h 12m");
    expect(handle.textContent).toContain("·");
    fireEvent.click(handle);
    expect(utils.getByTestId("flight-dock")).toBeInTheDocument();
    expect(utils.queryByTestId("flight-dock-handle")).toBeNull();
  });

  it("remembers the collapsed choice across a remount", async () => {
    seed(FULL);
    const first = await renderMap();
    fireEvent.click(first.getByTestId("flight-dock-toggle"));
    cleanup();
    const second = await renderMap();
    expect(second.queryByTestId("flight-dock")).toBeNull();
    expect(second.getByTestId("flight-dock-handle")).toBeInTheDocument();
  });

  it("starts collapsed under 760 px and open above", async () => {
    seed(FULL);
    setWidth(390);
    const phone = await renderMap();
    expect(phone.queryByTestId("flight-dock")).toBeNull();
    expect(phone.getByTestId("flight-dock-handle")).toBeInTheDocument();
    cleanup();
    resetTrackerTogglesForTests();
    setWidth(1280);
    const desktop = await renderMap();
    expect(desktop.getByTestId("flight-dock")).toBeInTheDocument();
    expect(desktop.queryByTestId("flight-dock-handle")).toBeNull();
  });

  it("writes --dock-height and lifts both bottom stacks while open", async () => {
    let fire: (() => void) | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          fire = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 96 } as DOMRect);
    seed(FULL);
    const utils = await renderMap();
    const section = utils.getByTestId("map");
    expect(section.style.getPropertyValue("--dock-height")).toBe("96px");
    rect.mockReturnValue({ height: 120 } as DOMRect);
    act(() => fire!());
    expect(section.style.getPropertyValue("--dock-height")).toBe("120px");
    expect(utils.getByTestId("map-bottom-left").className).toContain("lifted");
    expect(utils.getByTestId("map-bottom-right").className).toContain("lifted");

    fireEvent.click(utils.getByTestId("flight-dock-toggle"));
    expect(utils.getByTestId("map-bottom-left").className).not.toContain("lifted");
    expect(utils.getByTestId("map-bottom-right").className).not.toContain("lifted");
    expect(section.style.getPropertyValue("--dock-height")).toBe("");
    rect.mockRestore();
  });

  it("the lifted rule puts the stacks above the dock", () => {
    const css = readFileSync(resolve(mapDir, "Map.module.css"), "utf8");
    expect(css).toMatch(/\.lifted \{ bottom: calc\(8px \+ var\(--dock-height, 0px\) \+ 6px\); \}/);
    const dockCss = readFileSync(resolve(mapDir, "FlightDock.module.css"), "utf8");
    expect(dockCss).toMatch(/\.dock \{[^}]*left: 8px;[^}]*right: 8px;[^}]*bottom: 8px;/);
    expect(dockCss).toMatch(/\.handle \{[^}]*height: 28px;/);
    expect(dockCss).not.toMatch(/transition/);
  });

  it("the tracker menu toggle hides the dock and the handle pill, and aria-pressed follows", async () => {
    seed(FULL);
    const utils = await renderMap();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    const btn = utils.getByTestId("tracker-menu-flight-dock");
    expect(btn.getAttribute("aria-label")).toBe("Flight data");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    const group = utils.getByTestId("tracker-menu-toggles");
    expect(group.querySelector("button")).toBe(btn);
    fireEvent.click(btn);
    expect(utils.getByTestId("tracker-menu-flight-dock").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(utils.getByRole("button", { name: "Close menu" }));
    expect(utils.queryByTestId("flight-dock")).toBeNull();
    expect(utils.queryByTestId("flight-dock-handle")).toBeNull();
    expect(utils.getByTestId("map-bottom-left").className).not.toContain("lifted");
    cleanup();

    // Hidden stays hidden across a remount, collapsed or not.
    const again = await renderMap();
    expect(again.queryByTestId("flight-dock")).toBeNull();
    expect(again.queryByTestId("flight-dock-handle")).toBeNull();
    fireEvent.click(again.getByRole("button", { name: "Tracker menu" }));
    fireEvent.click(again.getByTestId("tracker-menu-flight-dock"));
    fireEvent.click(again.getByRole("button", { name: "Close menu" }));
    expect(again.getByTestId("flight-dock")).toBeInTheDocument();
  });

  it("the dock and the handle pill hide while the tracker menu is open", async () => {
    seed(FULL);
    const utils = await renderMap();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    expect(utils.queryByTestId("flight-dock")).toBeNull();
    fireEvent.click(utils.getByRole("button", { name: "Close menu" }));
    fireEvent.click(utils.getByTestId("flight-dock-toggle"));
    expect(utils.getByTestId("flight-dock-handle")).toBeInTheDocument();
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    expect(utils.queryByTestId("flight-dock-handle")).toBeNull();
  });

  it("the top-left stack holds no flight readouts and the old components are gone", async () => {
    seed(FULL);
    const utils = await renderMap({ distanceChip: true });
    expect(utils.queryByTestId("live-strip")).toBeNull();
    expect(utils.queryByTestId("distance-chip")).toBeNull();
    for (const name of ["LiftoffTimer.tsx", "DistanceChip.tsx", "LiveStrip.tsx"]) {
      expect(existsSync(resolve(mapDir, name))).toBe(false);
    }
    const css = readFileSync(resolve(mapDir, "Map.module.css"), "utf8");
    expect(css).not.toMatch(/\.liveStrip|\.liftoffTimer|\.distanceChip/);
    const map = readFileSync(resolve(mapDir, "Map.tsx"), "utf8");
    expect(map).not.toMatch(/liveStrip/);
  });
});
