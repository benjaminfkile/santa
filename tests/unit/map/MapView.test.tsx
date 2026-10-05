// docs/site.md sections 7.6 and 8. MapView's root takes its geometry from
// its class alone, so the section around it sets the map's height; a
// transient library-load failure retries by itself before the unavailable
// panel appears, and the surfaced failure is reported with the source
// "load".

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MapView } from "../../../src/map/MapView";
import { loadMaps } from "../../../src/map/loadMaps";
import { reportMapError } from "../../../src/lib/analytics";

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
const reportMock = vi.mocked(reportMapError);

beforeEach(() => {
  loadMapsMock.mockReset();
  reportMock.mockReset();
  loadMapsMock.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MapView", () => {
  it("carries no inline geometry on its root", () => {
    const { container } = render(<MapView options={{} as never} className="host" />);
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
      <MapView options={{} as never} className="host">
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
      <MapView options={{} as never} className="host">
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
    render(<MapView options={{} as never} className="host">{() => null}</MapView>);
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
      <MapView options={{} as never} className="host">
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
});
