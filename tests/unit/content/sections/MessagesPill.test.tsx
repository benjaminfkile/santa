// docs/site.md section 7.6. The messages pill on the tracker: absent with
// a null `latestMessage` or with `overlays.latestMessage` off; the unread
// dot against `wmsfo.messages.seen.<eventId>`; pressing marks the message
// read, clears the dot, and opens the one-message dialog with its time and
// the New marker; the dialog never opens on mount or on a new message; a
// rising id shakes once and brings the dot back; reduced motion; a
// `latest_message` section on the same page clears the dot.

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
import { LatestMessage } from "../../../../src/content/sections/LatestMessage/LatestMessage";

const bundle = { content: null as unknown, media: {}, icons: {} } as ContentBundle;
const EVENT_ID = 7;
const SEEN_KEY = `wmsfo.messages.seen.${EVENT_ID}`;

type Message = NonNullable<NonNullable<Snapshot["event"]>["latestMessage"]>;

const M11: Message = { id: 11, body: "Wheels up at the airport.", createdAt: "2026-12-22T01:01:00.000Z" };
const M12: Message = { id: 12, body: "Santa is over the valley.", createdAt: "2026-12-22T01:31:00.000Z" };

function setMessage(latestMessage: Message | null) {
  act(() =>
    store.setState({
      snapshot: { schemaVersion: 1, event: { id: EVENT_ID, statusId: 3, latestMessage } } as Snapshot,
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
  it("is absent with a null message", () => {
    setMessage(null);
    const view = renderMap();
    expect(view.queryByTestId("messages-pill")).toBeNull();
  });

  it("is absent with overlays.latestMessage off", () => {
    setMessage(M12);
    const view = renderMap(false);
    expect(view.queryByTestId("messages-pill")).toBeNull();
  });

  it("is absent for a message with no id", () => {
    setMessage({ body: "No id." });
    const view = renderMap();
    expect(view.queryByTestId("messages-pill")).toBeNull();
  });

  it("shows the envelope and no count", () => {
    setMessage(M12);
    const view = renderMap();
    const pill = view.getByTestId("messages-pill");
    expect(within(pill).getByTestId("messages-envelope")).toBeTruthy();
    expect(view.queryByTestId("messages-count")).toBeNull();
    expect(pill.textContent).toBe("");
    expect(view.queryByTestId("latest-message")).toBeNull();
  });
});

describe("MessagesPill dot", () => {
  it("shows the dot while no read mark is stored", () => {
    setMessage(M12);
    const view = renderMap();
    expect(view.getByTestId("messages-pill").getAttribute("aria-label")).toBe("Latest message, new");
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });

  it("shows the dot while the stored id is lower", () => {
    window.localStorage.setItem(SEEN_KEY, "11");
    setMessage(M12);
    const view = renderMap();
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });

  it("shows no dot when the stored id is equal", () => {
    window.localStorage.setItem(SEEN_KEY, "12");
    setMessage(M12);
    const view = renderMap();
    expect(view.getByTestId("messages-pill").getAttribute("aria-label")).toBe("Latest message");
    expect(view.queryByTestId("messages-dot")).toBeNull();
  });

  it("shows no dot when the stored id is higher", () => {
    window.localStorage.setItem(SEEN_KEY, "13");
    setMessage(M12);
    const view = renderMap();
    expect(view.queryByTestId("messages-dot")).toBeNull();
  });

  it("reads the mark of this event only", () => {
    window.localStorage.setItem("wmsfo.messages.seen.6", "12");
    setMessage(M12);
    const view = renderMap();
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });
});

describe("MessagesPill opening", () => {
  it("stores the id and clears the dot", () => {
    window.localStorage.setItem(SEEN_KEY, "11");
    setMessage(M12);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(window.localStorage.getItem(SEEN_KEY)).toBe("12");
    expect(view.queryByTestId("messages-dot")).toBeNull();
    expect(view.getByTestId("messages-pill").getAttribute("aria-label")).toBe("Latest message");
  });

  it("shows the one message with its time and the New marker", () => {
    setMessage(M12);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    const dialog = view.getByTestId("messages-dialog");
    expect(within(dialog).getByText("Flight updates")).toBeTruthy();
    const rows = within(dialog).getAllByTestId("messages-dialog-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Santa is over the valley.");
    expect(within(rows[0]).getByTestId("messages-dialog-time").textContent).toBe(formatEventTime(M12.createdAt));
    expect(within(rows[0]).getByTestId("messages-dialog-new").textContent).toBe("New");
  });

  it("renders the message's createdAt, ignoring any other time on a raw snapshot", () => {
    setMessage({ ...M11, eventTime: "2026-12-22T05:00:00.000Z" } as unknown as Message);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(view.getByTestId("messages-dialog-time").textContent).toBe(formatEventTime(M11.createdAt));
  });

  it("shows no New marker for a message already read", () => {
    window.localStorage.setItem(SEEN_KEY, "12");
    setMessage(M12);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(view.getByTestId("messages-dialog-row")).toBeTruthy();
    expect(view.queryByTestId("messages-dialog-new")).toBeNull();
  });

  it("keeps the New marker until the dialog closes", () => {
    setMessage(M12);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(view.getByTestId("messages-dialog-new")).toBeTruthy();
    fireEvent.click(view.getByTestId("messages-dialog-close"));
    expect(view.queryByTestId("messages-dialog")).toBeNull();
    fireEvent.click(view.getByTestId("messages-pill"));
    expect(view.queryByTestId("messages-dialog-new")).toBeNull();
  });

  it("closes on a backdrop press", () => {
    setMessage(M12);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    fireEvent.click(view.getByTestId("messages-dialog"));
    expect(view.queryByTestId("messages-dialog")).toBeNull();
  });
});

describe("MessagesPill never opens on its own", () => {
  it("does not open the dialog on mount", () => {
    setMessage(M12);
    const view = renderMap();
    expect(view.queryByTestId("messages-dialog")).toBeNull();
  });

  it("a new message brings the dot back and opens nothing", () => {
    setMessage(M11);
    const view = renderMap();
    fireEvent.click(view.getByTestId("messages-pill"));
    fireEvent.click(view.getByTestId("messages-dialog-close"));
    expect(view.queryByTestId("messages-dot")).toBeNull();
    setMessage(M12);
    expect(view.queryByTestId("messages-dialog")).toBeNull();
    expect(view.getByTestId("messages-dot")).toBeTruthy();
  });
});

describe("MessagesPill shake", () => {
  it("shakes once when the id rises while mounted", () => {
    vi.useFakeTimers();
    try {
      stubReducedMotion(false);
      window.localStorage.setItem(SEEN_KEY, "11");
      setMessage(M11);
      const view = renderMap();
      expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
      expect(view.queryByTestId("messages-dot")).toBeNull();
      setMessage(M12);
      expect(view.getByTestId("messages-envelope").className).toContain("messagesShake");
      expect(view.getByTestId("messages-dot")).toBeTruthy();
      expect(view.queryByTestId("messages-dialog")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
      // The same id again does not shake.
      setMessage({ ...M12 });
      expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not shake on the first render", () => {
    stubReducedMotion(false);
    setMessage(M12);
    const view = renderMap();
    expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
  });

  it("adds no shake class under reduced motion", () => {
    stubReducedMotion(true);
    setMessage(M11);
    const view = renderMap();
    setMessage(M12);
    expect(view.getByTestId("messages-envelope").className).not.toContain("messagesShake");
  });
});

describe("MessagesPill and the latest_message section", () => {
  it("clears the dot when a section on the same page marks the message read", () => {
    setMessage(M12);
    const view = renderMap();
    expect(view.getByTestId("messages-dot")).toBeTruthy();
    const section = render(<LatestMessage data={{ style: "ticker" }} items={[]} bundle={bundle} />);
    expect(section.getByTestId("latest-message")).toBeTruthy();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe("12");
    expect(view.queryByTestId("messages-dot")).toBeNull();
  });
});
