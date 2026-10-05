// docs/site.md section 7.6. The Live pill carries an eye and the count of
// connected viewers from `live.onlineCount`, abbreviated from a thousand up,
// only while the transport is live and the count is known, and only while
// `overlays.onlineCount` is on.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LiveIndicator } from "../../../../src/content/sections/Map/LiveIndicator";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle, HubStatus } from "../../../../src/store/types";
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

function setState(hub: HubStatus, onlineCount: number | null, lastPollOkAt: number | null = null) {
  act(() =>
    store.setState({
      hub,
      diag: { ...initialStore.diag, lastPollOkAt },
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

describe("LiveIndicator watching count", () => {
  it("renders 1204 beside Live as 1.2k", () => {
    setState("connected", 1204);
    const { getByTestId, getByRole } = render(<LiveIndicator />);
    const count = getByTestId("watching-count");
    expect(count.firstChild?.textContent).toBe("1.2k");
    expect(count.textContent).toBe("1.2k watching");
    const pill = getByRole("status");
    expect(pill.querySelector("svg")?.getAttribute("width")).toBe("14");
    expect(pill.textContent?.startsWith("Live")).toBe(true);
  });

  it("renders 12345 as 12.3k", () => {
    setState("connected", 12345);
    const { getByTestId } = render(<LiveIndicator />);
    expect(getByTestId("watching-count").firstChild?.textContent).toBe("12.3k");
  });

  it("puts the word watching in its own span inside the count", () => {
    setState("connected", 3);
    const { getByTestId } = render(<LiveIndicator />);
    const hidden = getByTestId("watching-count").querySelector("span");
    expect(hidden?.textContent).toBe(" watching");
  });

  it("renders nothing of the count while the count is null", () => {
    setState("connected", null);
    const { queryByTestId, getByRole } = render(<LiveIndicator />);
    expect(queryByTestId("watching-count")).toBeNull();
    expect(getByRole("status").querySelector("svg")).toBeNull();
  });

  it("renders nothing of the count while polling, even with a count", () => {
    setState("reconnecting", 42, performance.now());
    const { queryByTestId, getByRole } = render(<LiveIndicator />);
    expect(getByRole("status").getAttribute("data-transport")).toBe("polling");
    expect(queryByTestId("watching-count")).toBeNull();
    expect(getByRole("status").querySelector("svg")).toBeNull();
  });

  it("renders nothing of the count while offline, even with a count", () => {
    setState("disconnected", 42, null);
    const { queryByTestId, getByRole } = render(<LiveIndicator />);
    expect(getByRole("status").getAttribute("data-transport")).toBe("offline");
    expect(queryByTestId("watching-count")).toBeNull();
  });

  it("hides the count when showCount is false", () => {
    setState("connected", 42);
    const { queryByTestId } = render(<LiveIndicator showCount={false} />);
    expect(queryByTestId("watching-count")).toBeNull();
  });

  it("updates in place as live objects arrive", () => {
    setState("connected", 5);
    const { getByTestId, queryByTestId } = render(<LiveIndicator />);
    expect(getByTestId("watching-count").firstChild?.textContent).toBe("5");
    setState("connected", 6);
    expect(getByTestId("watching-count").firstChild?.textContent).toBe("6");
    setState("connected", null);
    expect(queryByTestId("watching-count")).toBeNull();
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

  it("shows the count in the Live pill by default", async () => {
    setState("connected", 42);
    const { getByTestId } = await renderMap({});
    expect(getByTestId("watching-count").firstChild?.textContent).toBe("42");
  });

  it("hides the count when the overlay flag is false", async () => {
    setState("connected", 42);
    const { queryByTestId } = await renderMap({ onlineCount: false });
    expect(queryByTestId("watching-count")).toBeNull();
  });
});
