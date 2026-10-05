// docs/site.md sections 7.6 and 8.1. The map section's error boundary: a
// throw anywhere under it, the live takeover included, renders the "map
// unavailable" panel with the reason instead of a blank page, reports the
// failure with the source "render", and its button reloads the page.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import { reloadPage } from "../../../../src/lib/reload";
import { reportMapError } from "../../../../src/lib/analytics";

const failing = { now: false };

vi.mock("../../../../src/content/sections/Map/Map", () => ({
  Map: () => {
    if (failing.now) throw new TypeError("live flip");
    return <div data-testid="map">tracker</div>;
  },
}));

vi.mock("../../../../src/lib/reload", () => ({ reloadPage: vi.fn() }));

vi.mock("../../../../src/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/analytics")>();
  return { ...actual, reportMapError: vi.fn() };
});

const reloadMock = vi.mocked(reloadPage);
const reportMock = vi.mocked(reportMapError);

const bundle = { content: null, media: {}, icons: {} } as unknown as ContentBundle;

beforeEach(() => {
  reloadMock.mockReset();
  reportMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  act(() => {
    store.setState({
      ...initialStore,
      live: { eventStatusId: 3 } as never,
    });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  failing.now = false;
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("MapErrorBoundary", () => {
  it("renders the fallback with the reason when a child throws", async () => {
    const { MapErrorBoundary } = await import("../../../../src/content/sections/Map/index");
    const { MapUnavailable } = await import("../../../../src/content/sections/Map/MapUnavailable");
    function Thrower(): never {
      throw new Error("boom");
    }
    const utils = render(
      <MapErrorBoundary fallback={(reason) => <MapUnavailable reason={reason} />}>
        <Thrower />
      </MapErrorBoundary>,
    );
    expect(utils.getByTestId("map-unavailable")).toBeInTheDocument();
    expect(utils.getByTestId("map-unavailable-reason")).toHaveTextContent("boom");
    expect(utils.getByRole("button", { name: "Reload the page" })).toBeInTheDocument();
  });
});

describe("MapSection", () => {
  it("a throw in the live takeover shows the panel with the reason, reports it, and the button reloads the page", async () => {
    const { MapSection } = await import("../../../../src/content/sections/Map/index");
    failing.now = true;
    const utils = render(<MapSection data={{}} items={[]} bundle={bundle} />);
    const panel = await utils.findByTestId("map-unavailable");
    expect(panel).toHaveTextContent("Map unavailable");
    expect(utils.getByTestId("map-unavailable-reason")).toHaveTextContent("TypeError: live flip");
    expect(utils.getByTestId("map").getAttribute("data-takeover")).toBe("live");
    expect(utils.queryByText("tracker")).toBeNull();

    expect(reportMock).toHaveBeenCalledTimes(1);
    expect(reportMock.mock.calls[0]![0]).toBe("render");
    expect(reportMock.mock.calls[0]![1]).toBeInstanceOf(TypeError);

    fireEvent.click(utils.getByRole("button", { name: "Reload the page" }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
