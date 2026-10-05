// docs/site.md section 7.6. The map section's place filter: the site
// settings' `places.tracker` reaches the controller as `setPois`, null while
// it is absent and the known kinds in its `kinds` while it is present. The
// section's own data never changes it.

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
  setViewpoints: vi.fn(),
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

function buildBundle(settings: Record<string, unknown> = {}): ContentBundle {
  return {
    content: {
      pages: [],
      nav: [],
      settings: {
        landmarks: [],
        ...settings,
      },
    } as unknown,
    media: {},
    icons: {},
  } as ContentBundle;
}

function lastPois(): unknown {
  const calls = controller.setPois.mock.calls;
  return calls[calls.length - 1][0];
}

async function renderMap(data: Record<string, unknown>, settings: Record<string, unknown> = {}) {
  const { Map } = await import("../../../../src/content/sections/Map/Map");
  return render(
    <MemoryRouter>
      <Map data={data} items={[]} bundle={buildBundle(settings)} />
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
  it("sends the settings' tracker kinds", async () => {
    await renderMap({}, { places: { tracker: { kinds: ["park", "school"] } } });
    expect(lastPois()).toEqual({ kinds: ["park", "school"] });
  });

  it("sends null without the settings' places", async () => {
    await renderMap({});
    expect(lastPois()).toBeNull();
  });

  it("sends null with places that have no tracker part", async () => {
    await renderMap({}, { places: { routeMap: { kinds: ["peak"] } } });
    expect(lastPois()).toBeNull();
  });

  it("sends no kinds for an empty tracker list", async () => {
    await renderMap({}, { places: { tracker: { kinds: [] } } });
    expect(lastPois()).toEqual({ kinds: [] });
  });

  it("drops unknown and repeated kinds", async () => {
    await renderMap({}, { places: { tracker: { kinds: ["park", "zoo", "park"] } } });
    expect(lastPois()).toEqual({ kinds: ["park"] });
  });

  it("ignores a poiFilter and poiKinds in the section data", async () => {
    await renderMap({ poiFilter: true, poiKinds: ["park", "school"] });
    expect(lastPois()).toBeNull();
    cleanup();
    controller.setPois.mockClear();
    await renderMap({ poiFilter: true, poiKinds: ["park"] }, { places: { tracker: { kinds: ["school"] } } });
    expect(lastPois()).toEqual({ kinds: ["school"] });
  });
});
