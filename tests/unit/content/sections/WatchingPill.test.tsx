// docs/site.md section 7.6. The "N watching" pill: shows `live.onlineCount`
// with a thousands separator, singular for one, nothing for a null count,
// and nothing while `overlays.onlineCount` is off.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WatchingPill } from "../../../../src/content/sections/Map/WatchingPill";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { LiveObject } from "../../../../src/contracts";

vi.mock("../../../../src/map/MapView", () => ({
  MapView: (props: {
    children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
  }) => (
    <div>
      {typeof props.children === "function"
        ? (props.children({ controller: null, error: null, retry: () => {} }) as React.ReactNode)
        : null}
    </div>
  ),
}));

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function setCount(onlineCount: number | null) {
  act(() =>
    store.setState({
      live: { schemaVersion: 1, publishedAt: "", onlineCount } as LiveObject,
    }),
  );
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("WatchingPill", () => {
  it("renders the count", () => {
    setCount(214);
    const { getByTestId } = render(<WatchingPill />);
    expect(getByTestId("watching-pill").textContent).toBe("214 watching");
  });

  it("renders nothing for a null count", () => {
    setCount(null);
    const { queryByTestId } = render(<WatchingPill />);
    expect(queryByTestId("watching-pill")).toBeNull();
  });

  it("formats 12345 with a thousands separator", () => {
    setCount(12345);
    const { getByTestId } = render(<WatchingPill />);
    expect(getByTestId("watching-pill").textContent).toBe("12,345 watching");
  });

  it("reads 1 watching for one viewer", () => {
    setCount(1);
    const { getByTestId } = render(<WatchingPill />);
    expect(getByTestId("watching-pill").textContent).toBe("1 watching");
  });

  it("updates in place as live objects arrive", () => {
    setCount(5);
    const { getByTestId, queryByTestId } = render(<WatchingPill />);
    expect(getByTestId("watching-pill").textContent).toBe("5 watching");
    setCount(6);
    expect(getByTestId("watching-pill").textContent).toBe("6 watching");
    setCount(null);
    expect(queryByTestId("watching-pill")).toBeNull();
  });
});

describe("Map section onlineCount overlay", () => {
  async function renderMap(overlays: Record<string, boolean>) {
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    return render(
      <MemoryRouter>
        <Map data={{ overlays }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
  }

  it("shows the pill by default when the live object carries a count", async () => {
    setCount(42);
    const { getByTestId } = await renderMap({});
    expect(getByTestId("watching-pill").textContent).toBe("42 watching");
  });

  it("hides the pill when the overlay flag is false", async () => {
    setCount(42);
    const { queryByTestId } = await renderMap({ onlineCount: false });
    expect(queryByTestId("watching-pill")).toBeNull();
  });
});
