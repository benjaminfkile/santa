// docs/site.md sections 7.6 and 8.1. The map section's error boundary: a
// throw anywhere under it, the live takeover included, renders the "map
// unavailable" panel instead of a blank page, and Retry mounts the section
// again.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";

const failing = { now: false };

vi.mock("../../../../src/content/sections/Map/Map", () => ({
  Map: () => {
    if (failing.now) throw new Error("live flip");
    return <div data-testid="map">tracker</div>;
  },
}));

const bundle = { content: null, media: {}, icons: {} } as unknown as ContentBundle;

beforeEach(() => {
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
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("MapErrorBoundary", () => {
  it("renders the fallback when a child throws", async () => {
    const { MapErrorBoundary } = await import("../../../../src/content/sections/Map/index");
    const { MapUnavailable } = await import("../../../../src/content/sections/Map/MapUnavailable");
    function Thrower(): never {
      throw new Error("boom");
    }
    const utils = render(
      <MapErrorBoundary onRetry={() => {}} fallback={(retry) => <MapUnavailable onRetry={retry} />}>
        <Thrower />
      </MapErrorBoundary>,
    );
    expect(utils.getByTestId("map-unavailable")).toBeInTheDocument();
    expect(utils.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("MapSection", () => {
  it("a throw in the live takeover shows the unavailable panel over the viewport, and Retry mounts the tracker", async () => {
    const { MapSection } = await import("../../../../src/content/sections/Map/index");
    failing.now = true;
    const utils = render(<MapSection data={{}} items={[]} bundle={bundle} />);
    const panel = await utils.findByTestId("map-unavailable");
    expect(panel).toHaveTextContent("Map unavailable");
    expect(utils.getByTestId("map").getAttribute("data-takeover")).toBe("live");
    expect(utils.queryByText("tracker")).toBeNull();

    failing.now = false;
    fireEvent.click(utils.getByRole("button", { name: "Retry" }));
    expect(await utils.findByText("tracker")).toBeInTheDocument();
    expect(utils.queryByTestId("map-unavailable")).toBeNull();
  });
});
