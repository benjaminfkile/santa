// docs/site.md section 7.6. The messages pill on the tracker: absent with
// no messages or with `overlays.latestMessage` off; the count and the
// unread dot against `wmsfo.messages.seen.<eventId>`; opening stores the
// newest id and clears the dot; the dialog lists the messages newest
// first with their times and the New markers; the dialog never opens on
// mount or on a new message; the shake and reduced motion.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Snapshot } from "../../../../src/contracts";
import { formatEventTime } from "../../../../src/lib/time";

// The test run loads no CSS, so the module's class names are stood in by
// their own keys, read from the typed sidecar.
vi.mock("../../../../src/content/sections/Map/Map.module.css", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sidecar = readFileSync(
    resolve(here, "../../../../src/content/sections/Map/Map.module.d.css.ts"),
    "utf8",
  );
  const names: Record<string, string> = {};
  for (const m of sidecar.matchAll(/export const (\w+): string;/g)) names[m[1]] = m[1];
  return names;
});

// Rendering the Map section pulls in Google Maps through MapView; the mock
// renders the overlays with no map.
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

import { Map } from "../../../../src/content/sections/Map/Map";

const bundle = { content: null as unknown, media: {}, icons: {} } as ContentBundle;
const EVENT_ID = 7;
const SEEN_KEY = `wmsfo.messages.seen.${EVENT_ID}`;

type Message = NonNullable<Snapshot["event"]>["messages"][number];

const M10: Message = { id: 10, body: "The sleigh is loaded.", eventTime: null, createdAt: "2026-12-22T00:40:00.000Z" };
const M11: Message = { id: 11, body: "Wheels up at the airport.", eventTime: "2026-12-22T01:00:00.000Z", createdAt: "2026-12-22T01:01:00.000Z" };
const M12: Message = { id: 12, body: "Santa is over the valley.", eventTime: "2026-12-22T01:30:00.000Z", createdAt: "2026-12-22T01:31:00.000Z" };

function setMessages(messages: Message[]) {
  act(() =>
    store.setState({
      snapshot: { schemaVersion: 1, event: { id: EVENT_ID, statusId: 3, messages } } as Snapshot,
    }),
  );
}

function renderMap(latestMessage = true) {
  return render(
    <MemoryRouter>
      <Map data={{ overlays: { latestMessage } }} items={[]} bundle={bundle} />
    </MemoryRouter>,
  );
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // The route disclaimer dialog stays out of the way.
  window.localStorage.setItem("wmsfo.routeDisclaimerAck", "1");
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  act(() => store.setState({ ...initialStore }));
});

describe("MessagesPill presence", () => {
  it("is absent with no messages", () => {
    setMessages([]);
    const view = renderMap();
    expect(view.queryByTestId("messages-pill")).toBeNull();
  });

  it("is absent with overlays.latestMessage off", () => {
    setMessages([M10, M11]);
    const view = renderMap(false);
    expect(view.queryByTestId("messages-pill")).toBeNull();
  });

  it("renders no ticker on the tracker", () => {
    setMessages([M10]);
    const view = renderMap();
    expect(view.getByTestId("messages-pill")).toBeTruthy();
    expect(view.queryByTestId("latest-message")).toBeNull();
  });
});

describe("MessagesPill count and dot", () => {
  it("counts every message and shows the dot while no seen mark is stored", () => {
    setMessages([M10, M11, M12]);
    const view = renderMap();
    const pill = view.getByTestId("messages-pill");
    expect(view.getByTestId("messages-count").textContent).toBe("3 messages");
    expect(pill.getAttribute("aria-label")).toBe("3 messages, 3 new");
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });

  it("counts only the ids above the stored mark as new", () => {
    window.localStorage.setItem(SEEN_KEY, "11");
    setMessages([M10, M11, M12]);
    const view = renderMap();
    expect(view.getByTestId("messages-pill").getAttribute("aria-label")).toBe("3 messages, 1 new");
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });

  it("shows no dot when every message is seen", () => {
    window.localStorage.setItem(SEEN_KEY, "12");
    setMessages([M10, M11, M12]);
    const view = renderMap();
    expect(view.getByTestId("messages-pill").getAttribute("aria-label")).toBe("3 messages");
    expect(view.queryByTestId("messages-dot")).toBeNull();
  });

  it("reads the mark of this event only", () => {
    window.localStorage.setItem("wmsfo.messages.seen.6", "12");
    setMessages([M10, M11, M12]);
    const view = renderMap();
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });
});

describe("MessagesPill opening", () => {
  it("stores the newest id and clears the dot", () => {
    window.localStorage.setItem(SEEN_KEY, "10");
    setMessages([M10, M12, M11]);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(window.localStorage.getItem(SEEN_KEY)).toBe("12");
    expect(view.queryByTestId("messages-dot")).toBeNull();
    expect(view.getByTestId("messages-pill").getAttribute("aria-label")).toBe("3 messages");
  });

  it("lists the messages newest first with their times and the New markers", () => {
    window.localStorage.setItem(SEEN_KEY, "10");
    setMessages([M10, M12, M11]);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    const dialog = view.getByTestId("messages-dialog");
    expect(within(dialog).getByText("Flight updates")).toBeTruthy();
    const rows = within(dialog).getAllByTestId(/^messages-dialog-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([
      "messages-dialog-row-12",
      "messages-dialog-row-11",
      "messages-dialog-row-10",
    ]);
    expect(rows[0].textContent).toContain("Santa is over the valley.");
    expect(within(rows[0]).getByTestId("messages-dialog-time").textContent).toBe(formatEventTime(M12.eventTime));
    expect(within(rows[2]).getByTestId("messages-dialog-time").textContent).toBe(formatEventTime(M10.createdAt));
    expect(within(rows[0]).queryByTestId("messages-dialog-new")).not.toBeNull();
    expect(within(rows[1]).queryByTestId("messages-dialog-new")).not.toBeNull();
    expect(within(rows[2]).queryByTestId("messages-dialog-new")).toBeNull();
  });

  it("keeps the New markers until the dialog closes", () => {
    setMessages([M10, M11]);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(view.getAllByTestId("messages-dialog-new")).toHaveLength(2);
    fireEvent.click(view.getByTestId("messages-dialog-close"));
    expect(view.queryByTestId("messages-dialog")).toBeNull();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(view.queryAllByTestId("messages-dialog-new")).toHaveLength(0);
  });

  it("closes on a backdrop press", () => {
    setMessages([M10]);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    fireEvent.click(view.getByTestId("messages-dialog"));
    expect(view.queryByTestId("messages-dialog")).toBeNull();
  });
});

describe("MessagesPill never opens on its own", () => {
  it("does not open the dialog on mount", () => {
    setMessages([M10, M11]);
    const view = renderMap();
    expect(view.queryByTestId("messages-dialog")).toBeNull();
  });

  it("a new message changes only the count and the dot", () => {
    window.localStorage.setItem(SEEN_KEY, "11");
    setMessages([M10, M11]);
    const view = renderMap();
    expect(view.queryByTestId("messages-dot")).toBeNull();
    setMessages([M10, M11, M12]);
    expect(view.queryByTestId("messages-dialog")).toBeNull();
    expect(view.getByTestId("messages-count").textContent).toBe("3 messages");
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });
});

describe("MessagesPill shake", () => {
  it("shakes when the newest id grows while mounted", () => {
    stubReducedMotion(false);
    setMessages([M10, M11]);
    const view = renderMap();
    expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
    setMessages([M10, M11, M12]);
    expect(view.getByTestId("messages-envelope").className).toContain("messagesShake");
  });

  it("does not shake on the first render", () => {
    stubReducedMotion(false);
    setMessages([M10, M11, M12]);
    const view = renderMap();
    expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
  });

  it("adds no shake class under reduced motion", () => {
    stubReducedMotion(true);
    setMessages([M10, M11]);
    const view = renderMap();
    setMessages([M10, M11, M12]);
    expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
  });
});
