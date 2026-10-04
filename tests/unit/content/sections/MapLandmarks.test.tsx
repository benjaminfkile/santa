// docs/site.md sections 7.6 and 8.5. The live tracker's landmarks: with
// landmarks in the site settings the tracker menu shows the Landmarks
// button, pressed by default, and the controller receives the toggle;
// pressing it sends false; with `controls.landmarks` false the button is
// absent and the controller still draws the landmarks.

import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ContentBundle } from "../../../../src/store/types";
import { resetTrackerTogglesForTests } from "../../../../src/content/sections/Map/trackerToggles";

const controller = {
  setTheme: vi.fn(),
  setMapType: vi.fn(),
  setToggles: vi.fn(),
  setFlightHistory: vi.fn(),
  setLandmarks: vi.fn(),
  setLiveFix: vi.fn(),
  follow: vi.fn(),
  recenter: vi.fn(),
  zoomBy: vi.fn(),
  fitHistory: vi.fn(),
  enableUserLocation: vi.fn(() => Promise.resolve()),
  disableUserLocation: vi.fn(),
  getUserLocation: vi.fn(() => null),
  destroy: vi.fn(),
};

// MapView hands the section a stand-in controller so the test sees every
// call the section makes.
vi.mock("../../../../src/map/MapView", () => ({
  MapView: (props: {
    onController: (c: unknown) => void;
    children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
  }) => {
    useEffect(() => {
      props.onController(controller);
    }, [props]);
    return (
      <div>
        {typeof props.children === "function"
          ? (props.children({ controller, error: null, retry: () => {} }) as React.ReactNode)
          : null}
      </div>
    );
  },
}));

const bundle = {
  content: {
    pages: [],
    nav: [],
    settings: {
      landmarks: [
        { name: "Town Hall", lat: 40, lng: -105, icon: { source: "library", id: "no-such-icon" } },
        { name: "Fire Station", lat: 41, lng: -106, description: "Station 3." },
      ],
    },
  } as unknown,
  media: {},
  icons: {},
} as ContentBundle;

function lastToggles(): { landmarks?: boolean } {
  const calls = controller.setToggles.mock.calls;
  return calls[calls.length - 1][0] as { landmarks?: boolean };
}

async function renderMap(data: Record<string, unknown>) {
  const { Map } = await import("../../../../src/content/sections/Map/Map");
  const utils = render(
    <MemoryRouter>
      <Map data={data} items={[]} bundle={bundle} />
    </MemoryRouter>,
  );
  fireEvent.click(utils.container.querySelector('button[aria-label="Tracker menu"]')!);
  return utils;
}

beforeEach(() => {
  resetTrackerTogglesForTests();
  for (const fn of Object.values(controller)) fn.mockClear();
});

afterEach(() => {
  cleanup();
  resetTrackerTogglesForTests();
});

describe("Map section landmarks", () => {
  it("with controls.landmarks absent the Landmarks button shows pressed and the controller receives landmarks: true", async () => {
    const utils = await renderMap({});
    const button = utils.getByTestId("tracker-menu-landmarks");
    expect(button.getAttribute("aria-label")).toBe("Viewpoints");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(lastToggles().landmarks).toBe(true);
    const list = controller.setLandmarks.mock.calls[controller.setLandmarks.mock.calls.length - 1][0] as {
      name: string;
      icon?: unknown;
    }[];
    expect(list.map((l) => l.name)).toEqual(["Town Hall", "Fire Station"]);
    // An icon that does not resolve leaves the landmark on the dot.
    expect(list[0].icon).toBeNull();
  });

  it("pressing the Landmarks button sends landmarks: false", async () => {
    const utils = await renderMap({});
    fireEvent.click(utils.getByTestId("tracker-menu-landmarks"));
    expect(utils.getByTestId("tracker-menu-landmarks").getAttribute("aria-pressed")).toBe("false");
    expect(lastToggles().landmarks).toBe(false);
  });

  it("with controls.landmarks false the button is absent and the overlay still draws", async () => {
    const utils = await renderMap({ controls: { landmarks: false } });
    expect(utils.getByTestId("tracker-menu")).toBeTruthy();
    expect(utils.queryByTestId("tracker-menu-landmarks")).toBeNull();
    expect(lastToggles().landmarks).toBe(true);
    const calls = controller.setLandmarks.mock.calls;
    expect((calls[calls.length - 1][0] as unknown[]).length).toBe(2);
  });
});
