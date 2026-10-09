// docs/site.md sections 7.6 and 8. MapView's root takes its geometry from
// its class alone, so the section around it sets the map's height; a
// transient library-load failure retries by itself before the unavailable
// panel appears, and the surfaced failure is reported with the source
// "load". The controller is built only once both the Maps libraries and
// the starting theme's style body are in hand, with that body.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MapView } from "../../../src/map/MapView";
import { loadMaps } from "../../../src/map/loadMaps";
import { reportMapError } from "../../../src/lib/analytics";
import { createMapController } from "../../../src/map/mapController";
import type { MapViewOptions } from "../../../src/map/MapView";
import { SEEDED, seededStyle } from "./themeFixtures";

vi.mock("../../../src/map/loadMaps", () => ({
  loadMaps: vi.fn(() => new Promise(() => {})),
}));
vi.mock("../../../src/map/mapController", () => ({
  createMapController: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("../../../src/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/analytics")>();
  return { ...actual, reportMapError: vi.fn() };
});

const loadMapsMock = vi.mocked(loadMaps);
const createMock = vi.mocked(createMapController);

const OPTIONS = {
  theme: SEEDED.standard,
  bbox: null,
  defaultCenter: { lat: 46.87, lng: -114 },
  defaultZoom: 11,
  showSantaMarker: true,
  showUserLocation: false,
} satisfies MapViewOptions;
const reportMock = vi.mocked(reportMapError);

beforeEach(() => {
  loadMapsMock.mockReset();
  reportMock.mockReset();
  createMock.mockClear();
  loadMapsMock.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MapView", () => {
  it("carries no inline geometry on its root", () => {
    const { container } = render(<MapView options={OPTIONS} className="host" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("host");
    expect(root.getAttribute("style")).toBeNull();
    expect(root.style.height).toBe("");
    expect(root.style.position).toBe("");
  });

  it("retries a failed load by itself and recovers without the error state", async () => {
    vi.useFakeTimers();
    loadMapsMock
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValue({} as never);
    const seen: Array<unknown> = [];
    render(
      <MapView options={OPTIONS} className="host">
        {({ controller, error }) => {
          seen.push({ controller, error });
          return null;
        }}
      </MapView>,
    );
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
    }
    expect(loadMapsMock.mock.calls.length).toBe(3);
    const last = seen[seen.length - 1] as { controller: unknown; error: unknown };
    expect(last.error).toBeNull();
    expect(last.controller).not.toBeNull();
  });

  it("shows the error only after the automatic retries are spent", async () => {
    vi.useFakeTimers();
    loadMapsMock.mockRejectedValue(new Error("down"));
    const seen: Array<unknown> = [];
    render(
      <MapView options={OPTIONS} className="host">
        {({ error }) => {
          seen.push(error);
          return null;
        }}
      </MapView>,
    );
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
    }
    // First try plus three automatic retries, then the surfaced error.
    expect(loadMapsMock.mock.calls.length).toBe(4);
    expect(seen[seen.length - 1]).toBeInstanceOf(Error);
  });

  it("reports the surfaced error once with the source load, and not the automatic retries", async () => {
    vi.useFakeTimers();
    const failure = new Error("down");
    loadMapsMock.mockRejectedValue(failure);
    render(<MapView options={OPTIONS} className="host">{() => null}</MapView>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(reportMock).not.toHaveBeenCalled();
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
    }
    expect(reportMock).toHaveBeenCalledTimes(1);
    expect(reportMock).toHaveBeenCalledWith("load", failure);
  });

  it("a manual retry after the surfaced error starts a fresh set of attempts", async () => {
    vi.useFakeTimers();
    loadMapsMock.mockRejectedValue(new Error("down"));
    let doRetry: (() => void) | null = null;
    const seen: Array<unknown> = [];
    render(
      <MapView options={OPTIONS} className="host">
        {({ error, retry }) => {
          doRetry = retry;
          seen.push(error);
          return null;
        }}
      </MapView>,
    );
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
    }
    expect(seen[seen.length - 1]).toBeInstanceOf(Error);
    loadMapsMock.mockResolvedValue({} as never);
    await act(async () => {
      doRetry!();
    });
    vi.useRealTimers();
    await waitFor(() => expect(seen[seen.length - 1]).toBeNull());
  });

  it("builds the controller only after the style body and the Maps libraries both resolve", async () => {
    let releaseLibs: (v: unknown) => void = () => {};
    let releaseStyle: (v: google.maps.MapTypeStyle[]) => void = () => {};
    loadMapsMock.mockImplementation(() => new Promise((res) => (releaseLibs = res)) as never);
    const body = seededStyle("night");
    const theme = { ...SEEDED.night, getStyle: () => new Promise<google.maps.MapTypeStyle[]>((res) => (releaseStyle = res)) };
    render(<MapView options={{ ...OPTIONS, theme }} className="host" />);
    await act(async () => {
      releaseLibs({});
      await Promise.resolve();
    });
    expect(createMock).not.toHaveBeenCalled();
    await act(async () => {
      releaseStyle(body);
      await Promise.resolve();
    });
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const opts = createMock.mock.calls[0][2];
    expect(opts.theme).toBe(theme);
    expect(opts.style).toBe(body);
  });

  it("waits for the Maps libraries when the style body comes first", async () => {
    let releaseLibs: (v: unknown) => void = () => {};
    loadMapsMock.mockImplementation(() => new Promise((res) => (releaseLibs = res)) as never);
    render(<MapView options={OPTIONS} className="host" />);
    await act(async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(createMock).not.toHaveBeenCalled();
    await act(async () => {
      releaseLibs({});
      await Promise.resolve();
    });
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
  });

  it("surfaces a missing theme as a load failure", async () => {
    vi.useFakeTimers();
    loadMapsMock.mockResolvedValue({} as never);
    const seen: unknown[] = [];
    render(
      <MapView options={{ ...OPTIONS, theme: null }} className="host">
        {({ error }) => {
          seen.push(error);
          return null;
        }}
      </MapView>,
    );
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
    }
    expect(createMock).not.toHaveBeenCalled();
    expect(String(seen[seen.length - 1])).toContain("no map theme");
  });
});
