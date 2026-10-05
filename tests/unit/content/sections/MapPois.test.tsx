// docs/site.md section 7.6. The map section's place filter: `poiFilter`
// and `poiKinds` reach the controller as `setPois`, null while the filter is
// off and the known kinds while it is on.

import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ContentBundle } from "../../../../src/store/types";
import { resetTrackerTogglesForTests } from "../../../../src/content/sections/Map/trackerToggles";

const controller = {
  setTheme: vi.fn(),
  setMapType: vi.fn(),
  setToggles: vi.fn(),
  setFlightHistory: vi.fn(),
  setLandmarks: vi.fn(),
  setPois: vi.fn(),
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
      landmarks: [],
    },
  } as unknown,
  media: {},
  icons: {},
} as ContentBundle;

function lastPois(): unknown {
  const calls = controller.setPois.mock.calls;
  return calls[calls.length - 1][0];
}

async function renderMap(data: Record<string, unknown>) {
  const { Map } = await import("../../../../src/content/sections/Map/Map");
  return render(
    <MemoryRouter>
      <Map data={data} items={[]} bundle={bundle} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetTrackerTogglesForTests();
  for (const fn of Object.values(controller)) fn.mockClear();
});

afterEach(() => {
  cleanup();
  resetTrackerTogglesForTests();
});

describe("Map section place filter", () => {
  it("with poiFilter on it sends the section's kinds", async () => {
    await renderMap({ poiFilter: true, poiKinds: ["park", "school"] });
    expect(lastPois()).toEqual({ kinds: ["park", "school"] });
  });

  it("with poiFilter absent it sends null", async () => {
    await renderMap({ poiKinds: ["park"] });
    expect(lastPois()).toBeNull();
  });

  it("with poiFilter on and no poiKinds it sends no kinds", async () => {
    await renderMap({ poiFilter: true });
    expect(lastPois()).toEqual({ kinds: [] });
  });

  it("drops unknown and repeated kinds", async () => {
    await renderMap({ poiFilter: true, poiKinds: ["park", "zoo", "park"] });
    expect(lastPois()).toEqual({ kinds: ["park"] });
  });
});
