// docs/site.md sections 7.6 and 8.3. The live flip: the event's status
// flipping 2 to 3 and back mounts and unmounts the live takeover over and
// over while the map libraries load late, fail once, or arrive after the
// takeover has gone, and while fixes arrive before and after the map is
// ready. The cycle never throws, never leaves a map, overlay, marker, or
// listener behind, and never calls back into an unmounted section. The
// tracker menu's flight history toggle and the overlay always agree, and
// off stays off across a remount of the section.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../../src/pages/HomePage";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { ContentDocument, LiveObject } from "../../../src/contracts";
import { loadMaps } from "../../../src/map/loadMaps";
import { resetTrackerTogglesForTests } from "../../../src/content/sections/Map/trackerToggles";
import {
  FakeMap,
  FakeMapObject,
  FakeOverlayView,
  deferred,
  fakeLibs,
  installFakeGoogle,
  resetFakeGoogle,
} from "./fakeGoogle";

vi.mock("../../../src/map/loadMaps", () => ({ loadMaps: vi.fn() }));

const loadMapsMock = vi.mocked(loadMaps);

function presentation() {
  return {
    width: "wide",
    align: "center",
    background: { kind: "none" },
    spacing: "normal",
    iconBefore: null,
    iconAfter: null,
    anchor: null,
  };
}

const mapData = {
  flightHistoryDefault: true,
  controls: { flightHistory: true, timeLabels: true, location: true, dataRow: true },
};

function content(): ContentDocument {
  return {
    schemaVersion: 1,
    settings: {
      siteName: "WMSFO", tagline: null, homeNavLabel: "Track", logo: null, favicon: null,
      theme: { snowDefault: false, lightsDefault: false }, navExtraLinks: [], footerLinks: [],
      footerText: null, contactEmail: null, donateUrl: null, analyticsEnabled: false,
    },
    pages: [
      {
        id: 1, slug: "home", title: "Home", navLabel: null, navPosition: 0, role: "scheduled",
        sections: [{ id: 10, kind: "map", data: mapData, items: [], presentation: presentation() }],
      },
      {
        id: 2, slug: "live", title: "Live", navLabel: null, navPosition: 1, role: "live",
        sections: [{ id: 20, kind: "map", data: mapData, items: [], presentation: presentation() }],
      },
    ],
  } as unknown as ContentDocument;
}

function live(status: number, seq: number | null): LiveObject {
  return {
    schemaVersion: 1, eventId: 1, eventStatusId: status, pollIntervalMs: 5000,
    snapshotUrl: null, cookieTally: {}, seq,
    lat: seq === null ? null : 40 + seq / 100, lng: seq === null ? null : -105,
    speedMps: null, altitudeM: null, headingDeg: null, accuracyM: null,
    recordedAt: seq === null ? null : "2024-12-24T02:00:00Z",
    receivedAt: seq === null ? null : "2024-12-24T02:00:01Z",
    publishedAt: "2024-12-24T00:00:00Z",
  } as LiveObject;
}

const snapshot = {
  schemaVersion: 1,
  content: content() as unknown,
  media: {},
  icons: {},
  event: {
    flightHistory: {
      points: [
        { lat: 40, lng: -105, recordedAt: "2023-12-24T02:00:00Z" },
        { lat: 41, lng: -106, recordedAt: "2023-12-24T02:30:00Z" },
        { lat: 42, lng: -107, recordedAt: "2023-12-24T03:00:00Z" },
      ],
    },
    trackerBbox: { west: -110, south: 35, east: -100, north: 45 },
    trackerMap: null,
  },
  trackerThemes: [
    {
      id: 1,
      renderer: "google",
      key: "standard",
      name: "Standard",
      styleUrl: "https://cdn.example/themes/live-flip-standard.json",
      spriteUrl: null,
      thumbnailMediaId: null,
      chrome: { bg: "white", fg: "gray", text: "black", tile: "silver", tileFg: "black", panel: "white", accent: "blue" },
      overlay: {
        routeColor: "blue",
        routeOpacity: 0.9,
        arrowColor: "white",
        timeLabelBg: "black",
        timeLabelFg: "white",
        timeLabelOpacity: 0.8,
        userColor: "red",
      },
      defaultLightMode: true,
      defaultDarkMode: false,
    },
  ],
};

function setStatus(status: number, seq: number | null = null) {
  act(() => {
    store.setState({ live: live(status, seq) });
  });
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

// Maps whose controller is still alive: a live map keeps its listeners.
function liveMaps(): FakeMap[] {
  return FakeMap.instances.filter((m) => m.listenerCount() > 0);
}

function attachedOverlays(): FakeOverlayView[] {
  return FakeOverlayView.instances.filter((o) => o.getMap() !== null);
}

let errors: unknown[] = [];
const onWindowError = (e: ErrorEvent) => errors.push(e.error ?? e.message);

beforeEach(async () => {
  installFakeGoogle();
  resetFakeGoogle();
  errors = [];
  resetTrackerTogglesForTests();
  window.addEventListener("error", onWindowError);
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
  loadMapsMock.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
  act(() => {
    store.setState({ ...initialStore, snapshot: snapshot as never, live: live(2, null) });
  });
  // The map section's chunk is lazy; load it once up front so every mount
  // in a cycle builds synchronously.
  await import("../../../src/content/sections/Map/Map");
});

afterEach(() => {
  cleanup();
  window.removeEventListener("error", onWindowError);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  act(() => {
    store.setState({ ...initialStore });
  });
});

function mount() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("the live flip", () => {
  it("runs clean when the loader resolves late, after several flips", async () => {
    const loads = [deferred<ReturnType<typeof fakeLibs>>()];
    loadMapsMock.mockImplementation(() => loads[0].promise);
    const utils = mount();
    await utils.findByTestId("map");
    for (let i = 0; i < 4; i++) {
      setStatus(3, i);
      await flush();
      setStatus(2);
      await flush();
    }
    setStatus(3, 9);
    await flush();
    loads[0].resolve(fakeLibs());
    await flush();
    await flush();
    expect(errors).toEqual([]);
    expect(liveMaps()).toHaveLength(1);
    expect(attachedOverlays()).toHaveLength(1);
    utils.unmount();
    await flush();
    expect(liveMaps()).toHaveLength(0);
    expect(attachedOverlays()).toHaveLength(0);
    expect([...FakeMapObject.live]).toHaveLength(0);
  });

  it("runs clean when a load fails once and the retry lands after the flip back", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    let calls = 0;
    loadMapsMock.mockImplementation(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("blip")) : Promise.resolve(fakeLibs());
    });
    const utils = mount();
    await vi.waitFor(() => utils.getByTestId("map"));
    setStatus(3, 1);
    await flush();
    // The first attempt failed; its retry timer is pending. Flip back and
    // forth before it fires.
    setStatus(2);
    await flush();
    setStatus(3, 2);
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(errors).toEqual([]);
    expect(liveMaps()).toHaveLength(1);
    utils.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(errors).toEqual([]);
    expect(liveMaps()).toHaveLength(0);
    expect(attachedOverlays()).toHaveLength(0);
  });

  it("builds nothing when the load resolves after the takeover has gone", async () => {
    const load = deferred<ReturnType<typeof fakeLibs>>();
    loadMapsMock.mockImplementation(() => load.promise);
    const utils = mount();
    await utils.findByTestId("map");
    setStatus(3, 1);
    await flush();
    utils.unmount();
    load.resolve(fakeLibs());
    await flush();
    expect(errors).toEqual([]);
    expect(FakeMap.instances).toHaveLength(0);
  });

  it("a rapid flip leaves no listener on a disposed map and no callback into the gone section", async () => {
    loadMapsMock.mockImplementation(() => Promise.resolve(fakeLibs()));
    const utils = mount();
    await utils.findByTestId("map");
    await flush();
    setStatus(3, 1);
    await flush();
    setStatus(2);
    await flush();
    setStatus(3, 2);
    await flush();
    // Every map but the current one belongs to a disposed controller.
    const current = FakeMap.instances[FakeMap.instances.length - 1];
    for (const m of FakeMap.instances) {
      if (m !== current) expect(m.listenerCount()).toBe(0);
    }
    // A late zoom or drag on a disposed map does nothing.
    vi.useFakeTimers();
    for (const m of FakeMap.instances) {
      if (m === current) continue;
      m.trigger("zoom_changed");
      m.trigger("dragstart");
    }
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    expect(errors).toEqual([]);
    utils.unmount();
    await flush();
    expect(liveMaps()).toHaveLength(0);
    expect([...FakeMapObject.live]).toHaveLength(0);
  });

  it("places the pin whether the fix arrives before or after the map is ready", async () => {
    const load = deferred<ReturnType<typeof fakeLibs>>();
    loadMapsMock.mockImplementation(() => load.promise);
    const utils = mount();
    setStatus(3, 5);
    await utils.findByTestId("map");
    load.resolve(fakeLibs());
    await flush();
    const map = FakeMap.instances[0];
    await waitFor(() => expect(map.panes.markerLayer.querySelector("img")).not.toBeNull());
    setStatus(3, 6);
    await flush();
    expect(map.panes.markerLayer.querySelectorAll("img")).toHaveLength(1);
    // Waiting for a fix detaches the pin; a fix before `onAdd` ran is fine.
    act(() => {
      store.setState({ live: live(3, null) });
    });
    setStatus(3, 7);
    setStatus(2);
    await flush();
    expect(map.panes.markerLayer.querySelectorAll("img")).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});

describe("the flight history toggle", () => {
  function menuToggle(utils: ReturnType<typeof mount>): HTMLElement {
    if (utils.queryByTestId("tracker-menu") === null) {
      fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    }
    return utils.getByTestId("tracker-menu-flight-history");
  }

  // The flight history polylines on the current map: the line and the
  // arrows (no time labels here, the points carry no 20 minute step).
  function historyLines(): number {
    const current = FakeMap.instances[FakeMap.instances.length - 1];
    return [...FakeMapObject.live].filter((o) => o.map === current && "path" in o.opts).length;
  }

  it("turning it off unpresses the button and hides the overlay, and on brings both back", async () => {
    loadMapsMock.mockImplementation(() => Promise.resolve(fakeLibs()));
    setStatus(3, 1);
    const utils = mount();
    await utils.findByTestId("map");
    await flush();
    expect(menuToggle(utils).getAttribute("aria-pressed")).toBe("true");
    expect(utils.getByTestId("map").dataset.flightHistory).toBe("on");
    expect(historyLines()).toBeGreaterThan(0);

    fireEvent.click(menuToggle(utils));
    expect(menuToggle(utils).getAttribute("aria-pressed")).toBe("false");
    expect(utils.getByTestId("map").dataset.flightHistory).toBe("off");
    expect(historyLines()).toBe(0);

    // A poll with a new snapshot and a new fix changes nothing.
    act(() => {
      store.setState({ snapshot: { ...snapshot, content: content() as unknown } as never });
    });
    setStatus(3, 2);
    await flush();
    expect(menuToggle(utils).getAttribute("aria-pressed")).toBe("false");
    expect(historyLines()).toBe(0);

    fireEvent.click(menuToggle(utils));
    expect(menuToggle(utils).getAttribute("aria-pressed")).toBe("true");
    expect(utils.getByTestId("map").dataset.flightHistory).toBe("on");
    expect(historyLines()).toBeGreaterThan(0);
  });

  it("off stays off when the section remounts on a flip back to live", async () => {
    loadMapsMock.mockImplementation(() => Promise.resolve(fakeLibs()));
    setStatus(3, 1);
    const utils = mount();
    await utils.findByTestId("map");
    await flush();
    fireEvent.click(menuToggle(utils));
    expect(menuToggle(utils).getAttribute("aria-pressed")).toBe("false");

    setStatus(2);
    await flush();
    setStatus(3, 2);
    await flush();
    await flush();
    expect(menuToggle(utils).getAttribute("aria-pressed")).toBe("false");
    expect(utils.getByTestId("map").dataset.flightHistory).toBe("off");
    expect(historyLines()).toBe(0);
    expect(errors).toEqual([]);
  });
});
