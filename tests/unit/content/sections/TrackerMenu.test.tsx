// docs/site.md section 7.6 and S17f. Tracker menu data row units:
// distance in feet under a mile / miles above; the viewer's timezone for the
// liftoff, recorded, and received timestamps; every value in --font-mono
// with tabular numerals through the co-located CSS module. The footer row:
// the account button alone on the left, the other buttons on the right.
// The style picker: each theme's thumbnail is the 480 variant of its
// `thumbnailMediaId` from the snapshot's media, a theme without one shows a
// swatch of its chrome, the active theme carries the underline, and a pick
// stays busy until `onThemeChange` settles. In the Map section the picker
// lists the enabled themes of the active renderer, and the Terrain and
// Road pair calls the controller's `setMapType`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { formatEventTime } from "../../../../src/lib/time";

import { TrackerMenu } from "../../../../src/content/sections/Map/TrackerMenu";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { MapTheme } from "../../../../src/map/themes";
import { AuthProvider, type AuthState } from "../../../../src/auth/AuthProvider";
import { session } from "../../../../src/auth/session";
import { copy } from "../../../../src/copy/copy";

// CSS processing is off in unit tests, so the TrackerMenu module's classes
// map to their own names here, with a composed class appended as CSS
// modules do; the rules themselves are read from the file.
vi.mock("../../../../src/content/sections/Map/TrackerMenu.module.css", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const css = readFileSync(resolve(__dirname, "../../../../src/content/sections/Map/TrackerMenu.module.css"), "utf8");
  const names = new Set(Array.from(css.matchAll(/\.([a-zA-Z][a-zA-Z0-9]*)/g), (m) => m[1]));
  const composed = new Map(Array.from(css.matchAll(/\.(\w+)\s*\{\s*composes:\s*(\w+)/g), (m) => [m[1], m[2]]));
  return Object.fromEntries(
    Array.from(names, (n) => [n, composed.has(n) ? `${n} ${composed.get(n)}` : n]),
  );
});

// The Map section over a controller that records its calls, on the
// renderer the test picks.
const sectionMocks = vi.hoisted(() => ({
  renderer: "maplibre" as "maplibre" | "google",
  controller: null as null | Record<string, ReturnType<typeof import("vitest").vi.fn>>,
}));

vi.mock("../../../../src/map/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/map/renderer")>();
  return { ...actual, reportRenderer: vi.fn(() => sectionMocks.renderer) };
});

vi.mock("../../../../src/map/MapView", async () => {
  const { useEffect } = await import("react");
  return {
    MapView: (props: {
      onController?: (c: unknown) => void;
      children?: (state: { controller: unknown; error: unknown; retry: () => void }) => unknown;
    }) => {
      const controller = sectionMocks.controller;
      const { onController } = props;
      useEffect(() => {
        onController?.(controller);
      }, [onController, controller]);
      return (
        <div>
          {typeof props.children === "function"
            ? (props.children({ controller, error: null, retry: () => {} }) as React.ReactNode)
            : null}
        </div>
      );
    },
  };
});

const here = dirname(fileURLToPath(import.meta.url));
const trackerModulePath = resolve(here, "../../../../src/content/sections/Map/TrackerMenu.module.css");

function makeTheme(key: string, over: Partial<MapTheme> = {}): MapTheme {
  return {
    key,
    renderer: "google",
    name: key.charAt(0).toUpperCase() + key.slice(1),
    styleUrl: `https://cdn.example/themes/${key}.json`,
    spriteUrl: null,
    thumbnailMediaId: null,
    defaultLightMode: false,
    defaultDarkMode: false,
    overlay: {
      routeColor: "hsl(210 100% 40%)",
      routeOpacity: 1,
      arrowColor: "hsl(210 100% 40%)",
      timeLabelBg: "hsl(0 0% 100%)",
      timeLabelFg: "hsl(0 0% 0%)",
      timeLabelOpacity: 1,
      userColor: "hsl(210 100% 40%)",
    },
    chrome: {
      bg: "hsl(0 0% 100%)",
      fg: "hsl(0 0% 40%)",
      text: "hsl(0 0% 0%)",
      tile: "hsl(120 30% 80%)",
      tileFg: "hsl(0 0% 0%)",
      panel: "hsl(0 0% 100%)",
      accent: "hsl(210 100% 40%)",
    },
    getStyle: () => Promise.resolve([]),
    ...over,
  };
}

const themes: MapTheme[] = [makeTheme("standard")];

function seedLive(): void {
  act(() => {
    store.setState({
      ...initialStore,
      live: {
        schemaVersion: 1,
        eventId: 1,
        eventStatusId: 3,
        pollIntervalMs: 5000,
        snapshotUrl: "https://cdn/snap.json",
        cookieTally: {},
        seq: 12,
        lat: 46.8,
        lng: -114,
        speedMps: 20,
        altitudeM: 100,
        headingDeg: 90,
        accuracyM: 5,
        recordedAt: "2026-12-24T02:15:00Z",
        receivedAt: "2026-12-24T02:15:03Z",
        publishedAt: "2026-12-24T02:15:03Z",
      },
      snapshot: {
        schemaVersion: 1,
        content: {} as unknown,
        media: {},
        icons: {},
        event: {
          statusId: 3,
          wentLiveAt: "2026-12-24T01:00:00Z",
        } as unknown as never,
      } as never,
    });
  });
}

beforeEach(() => {
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("TrackerMenu data row", () => {
  it("formats distance in feet under one mile and miles above", () => {
    seedLive();
    const shared = {
      open: true,
      onClose: () => {},
      controls: {
        themePicker: false,
        terrain: false,
        snow: false,
        flightHistory: false,
        timeLabels: false,
        location: false,
        dataRow: true,
      },
      themes,
      themeKey: "standard",
      onThemeChange: () => {},
      mapType: "terrain" as const,
      onMapTypeChange: () => {},
      snow: false,
      onSnowChange: () => {},
      flightHistoryAvailable: false,
      flightHistory: false,
      onFlightHistoryChange: () => {},
      timeLabels: false,
      onTimeLabelsChange: () => {},
      flightDockAvailable: false,
      flightDock: false,
      onFlightDockChange: () => {},
      onOpenLocation: () => {},
    locationEnabled: false,
    };
    const { getByTestId, rerender } = render(
      <MemoryRouter>
        <TrackerMenu {...shared} distanceMetres={500} />
      </MemoryRouter>,
    );
    // 500 m < 1 mile → feet.
    expect(getByTestId("data-row-distance").textContent).toContain("ft");

    rerender(
      <MemoryRouter>
        <TrackerMenu {...shared} distanceMetres={5000} />
      </MemoryRouter>,
    );
    // 5000 m > 1 mile → miles with two decimals.
    expect(getByTestId("data-row-distance").textContent).toMatch(/\d+\.\d{2} mi/);
  });

  it("shows the liftoff time alone, through formatEventTime", () => {
    seedLive();
    const { getByTestId, queryByTestId } = render(
      <MemoryRouter>
        <TrackerMenu
          open
          onClose={() => {}}
          controls={{
            themePicker: false,
            terrain: false,
            snow: false,
            flightHistory: false,
            timeLabels: false,
            location: false,
            dataRow: true,
          }}
          themes={themes}
          themeKey="standard"
          onThemeChange={() => {}}
          mapType="terrain"
          onMapTypeChange={() => {}}
          snow={false}
          onSnowChange={() => {}}
          flightHistoryAvailable={false}
          flightHistory={false}
          onFlightHistoryChange={() => {}}
          timeLabels={false}
          onTimeLabelsChange={() => {}}
          flightDockAvailable={false}
          flightDock={false}
          onFlightDockChange={() => {}}
          onOpenLocation={() => {}}
          locationEnabled={false}
          distanceMetres={null}
        />
      </MemoryRouter>,
    );
    expect(getByTestId("data-row-liftoff").textContent).toContain(formatEventTime("2026-12-24T01:00:00Z"));
    // Every number in the row reads like the rest of the tracker: 100 m is
    // 328 ft here, and a four-figure reading would abbreviate.
    const row = getByTestId("tracker-menu-data-row").textContent ?? "";
    expect(row).toContain("328 ft");
    expect(getByTestId("data-row-speed").textContent).toBe("45 mph");
    // Liftoff is the only time in the data row; the fix diagnostics are gone.
    expect(queryByTestId("data-row-recorded")).toBeNull();
    expect(queryByTestId("data-row-received")).toBeNull();
  });

  it("data row cells are rendered in --font-mono with tabular numerals", () => {
    const css = readFileSync(trackerModulePath, "utf8");
    expect(css).toMatch(/\.dataRow\s+dd\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
    expect(css).toMatch(/\.dataRow\s+dd\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });
});

function footerProps(onClose: () => void) {
  return {
    open: true,
    onClose,
    controls: {
      themePicker: false,
      terrain: false,
      snow: false,
      flightHistory: true,
      timeLabels: true,
      location: true,
      dataRow: false,
    },
    themes,
    themeKey: "standard",
    onThemeChange: () => {},
    mapType: "terrain" as const,
    onMapTypeChange: () => {},
    snow: false,
    onSnowChange: () => {},
    flightHistoryAvailable: true,
    flightHistory: true,
    onFlightHistoryChange: () => {},
    timeLabels: false,
    onTimeLabelsChange: () => {},
    flightDockAvailable: true,
    flightDock: true,
    onFlightDockChange: () => {},
    onOpenLocation: () => {},
    locationEnabled: false,
    distanceMetres: null,
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="probe-location">{loc.pathname + loc.search}</output>;
}

function renderMenu(state: AuthState, onClose: () => void = () => {}) {
  return render(
    <MemoryRouter initialEntries={["/live?theme=night"]}>
      <AuthProvider initialState={state}>
        <TrackerMenu {...footerProps(onClose)} />
      </AuthProvider>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const rightTestIds = [
  "tracker-menu-flight-dock",
  "tracker-menu-flight-history",
  "tracker-menu-time-labels",
];

// The declarations of one rule, for asserting on the stylesheet without a
// regex per property.
function ruleOf(css: string, selector: string): string {
  const i = css.indexOf(selector + " {");
  expect(i).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
}

function expectRightGroupUnchanged(getByTestId: (id: string) => HTMLElement): void {
  const right = getByTestId("tracker-menu-toggles");
  // One row, in written order. Route and the buttons it switches on sit in
  // a bracketed group, so the row reads Gauges, Location, [Route Times],
  // Close.
  const labels = Array.from(right.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"));
  expect(labels).toEqual(["Gauges", "Your location", "Route", "Time labels", "Close menu"]);
  const captions = Array.from(right.querySelectorAll("span[aria-hidden]")).map((s) => s.textContent);
  expect(captions).toEqual(["Gauges", "Location", "Route", "Times", "Close"]);
  const group = getByTestId("tracker-menu-route-group");
  expect(right.contains(group)).toBe(true);
  expect(group.getAttribute("aria-label")).toBe("Route");
  expect(group.contains(getByTestId("tracker-menu-flight-history"))).toBe(true);
  expect(group.contains(getByTestId("tracker-menu-time-labels"))).toBe(true);
  // The brackets are drawn only while the extras are there.
  expect(group.className).toContain("footerGroupOpen");
  for (const id of rightTestIds) expect(right.contains(getByTestId(id))).toBe(true);
}

describe("TrackerMenu account button", () => {
  it("signed out renders the sign-in button alone on the left and the right group unchanged", () => {
    const { getByTestId, queryByTestId } = renderMenu({ status: "signedOut" });
    const left = getByTestId("tracker-menu-account");
    const button = getByTestId("tracker-menu-sign-in");
    expect(left.querySelectorAll("button")).toHaveLength(1);
    expect(left.contains(button)).toBe(true);
    expect(button.getAttribute("aria-label")).toBe(copy.signIn.button);
    expect(queryByTestId("tracker-menu-sign-out")).toBeNull();
    // The left group comes first in the footer row, the right group second.
    const footer = left.parentElement as HTMLElement;
    expect(Array.from(footer.children)).toEqual([left, getByTestId("tracker-menu-toggles")]);
    expectRightGroupUnchanged(getByTestId);
  });

  it("a sign-in click closes the menu and navigates to /auth/sign-in with the encoded returnTo", () => {
    const onClose = vi.fn();
    const { getByTestId } = renderMenu({ status: "signedOut" }, onClose);
    fireEvent.click(getByTestId("tracker-menu-sign-in"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getByTestId("probe-location").textContent).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent("/live?theme=night")}`,
    );
  });

  it("signed in renders sign-out, and a click calls signOut and leaves the menu open", async () => {
    const onClose = vi.fn();
    // With no stored session, AuthProvider's signOut goes straight to
    // session.clear().
    const clear = vi.spyOn(session, "clear");
    const { getByTestId, queryByTestId } = renderMenu(
      { status: "signedIn", email: "a@b.c", expired: false },
      onClose,
    );
    const button = getByTestId("tracker-menu-sign-out");
    expect(button.getAttribute("aria-label")).toBe(copy.signIn.signOut);
    expect(queryByTestId("tracker-menu-sign-in")).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
    clear.mockRestore();
    expect(onClose).not.toHaveBeenCalled();
    expect(getByTestId("tracker-menu")).toBeTruthy();
    expectRightGroupUnchanged(getByTestId);
  });

  it("unknown auth renders neither button and an empty left group", () => {
    const { getByTestId, queryByTestId } = renderMenu({ status: "unknown" });
    expect(queryByTestId("tracker-menu-sign-in")).toBeNull();
    expect(queryByTestId("tracker-menu-sign-out")).toBeNull();
    expect(getByTestId("tracker-menu-account").children).toHaveLength(0);
    expectRightGroupUnchanged(getByTestId);
  });

  it("the location button is pressed while the visitor's location is on and not otherwise", () => {
    const { getByTestId, unmount } = render(
      <MemoryRouter initialEntries={["/live"]}>
        <AuthProvider initialState={{ status: "signedOut" }}>
          <TrackerMenu {...footerProps(() => {})} locationEnabled />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(getByTestId("tracker-menu-location")).toHaveAttribute("aria-pressed", "true");
    unmount();
    const off = render(
      <MemoryRouter initialEntries={["/live"]}>
        <AuthProvider initialState={{ status: "signedOut" }}>
          <TrackerMenu {...footerProps(() => {})} locationEnabled={false} />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(off.getByTestId("tracker-menu-location")).toHaveAttribute("aria-pressed", "false");
  });

  it("with every control on and a flight history present the buttons are fixed 44 px squares under their labels on one row, route and its extras bracketed together", () => {
    const { getByTestId } = renderMenu({ status: "signedOut" });
    const left = getByTestId("tracker-menu-account");
    const right = getByTestId("tracker-menu-toggles");
    expect(left.parentElement).toBe(right.parentElement);
    expect(left.parentElement?.children).toHaveLength(2);
    const buttons = [...Array.from(left.querySelectorAll("button")), ...Array.from(right.querySelectorAll("button"))];
    expect(buttons).toHaveLength(6);
    expect(left.querySelector("span[aria-hidden]")?.textContent).toBe("Sign in");
    for (const b of buttons) expect(b.className).toContain("footerBtn");
    expect(right.className).toContain("footerEnd");
    expectRightGroupUnchanged(getByTestId);

    const src = readFileSync(resolve(here, "../../../../src/content/sections/Map/TrackerMenu.tsx"), "utf8");
    expect(src).toMatch(/className=\{styles\.footer\}/);
    expect(src).toMatch(/className=\{styles\.footerStart\} data-testid="tracker-menu-account"/);
    expect(src).toMatch(/className=\{styles\.footerEnd\} data-testid="tracker-menu-toggles"/);
    // Every button in both groups is the 44 px footerBtn square.
    const footerSrc = src.slice(src.indexOf("styles.footerStart"));
    const classes = [...footerSrc.matchAll(/<button[^>]*?className=\{styles\.(\w+)\}/g)].map((m) => m[1]);
    expect(classes.length).toBe(8);
    for (const c of classes) expect(["footerBtn", "close"]).toContain(c);

    const css = readFileSync(trackerModulePath, "utf8");
    expect(css).toMatch(/\.footer\s*\{[^}]*justify-content:\s*space-between/);
    expect(ruleOf(css, ".footer")).toContain("align-items: flex-start");
    expect(css).toMatch(/\.footerStart\s*\{[^}]*flex:\s*none/);
    // One row that never wraps, with route and its extras bracketed.
    const footerEndRule = ruleOf(css, ".footerEnd");
    expect(footerEndRule).toContain("flex-wrap: nowrap");
    expect(footerEndRule).toContain("justify-content: flex-end");
    expect(footerEndRule).toContain("gap: 4px");
    expect(ruleOf(css, ".footerGroup")).toContain("flex: none");
    const open = ruleOf(css, ".footerGroupOpen");
    expect(open).toContain("border-left: 1px solid var(--line)");
    expect(open).toContain("border-right: 1px solid var(--line)");
    expect(css).toMatch(/\.footerBtn\s*\{[^}]*flex:\s*none;[^}]*width:\s*44px;[^}]*height:\s*44px/);
    expect(css).not.toMatch(/\.footerBtn\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.close\s*\{\s*composes:\s*footerBtn/);
    expect(ruleOf(css, ".trackerMenu")).toContain("width: min(360px, 100%)");
    expect(css).toMatch(/\.panel\s*\{[^}]*padding:\s*6px/);
  });
});


describe("TrackerMenu themes", () => {
  const picker = [
    makeTheme("standard", { thumbnailMediaId: "thumb-standard" }),
    makeTheme("night", {
      chrome: {
        bg: "hsl(215 48% 11%)",
        fg: "hsl(216 29% 66%)",
        text: "hsl(220 100% 97%)",
        tile: "hsl(216 36% 19%)",
        tileFg: "hsl(220 100% 97%)",
        panel: "hsl(215 48% 8%)",
        accent: "hsl(192 100% 60%)",
      },
    }),
  ];

  function seedMedia(): void {
    act(() => {
      store.setState({
        ...initialStore,
        snapshot: {
          schemaVersion: 1,
          media: {
            "thumb-standard": {
              url: "https://cdn.example/media/thumb-standard/original.png",
              kind: "raster",
              variants: {
                "480": "https://cdn.example/media/thumb-standard/w480.webp",
                "960": "https://cdn.example/media/thumb-standard/w960.webp",
              },
            },
          },
          trackerThemes: [],
        } as never,
      });
    });
  }

  function renderPicker(onThemeChange: (key: string) => void | Promise<void>, themeKey = "standard") {
    return render(
      <MemoryRouter>
        <AuthProvider initialState={{ status: "unknown" } as AuthState}>
          <TrackerMenu
            {...footerProps(() => {})}
            controls={{ ...footerProps(() => {}).controls, themePicker: true }}
            themes={picker}
            themeKey={themeKey}
            onThemeChange={onThemeChange}
          />
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it("shows a thumbnail as the 480 variant from the snapshot's media", () => {
    seedMedia();
    const { getByTestId } = renderPicker(() => {});
    const img = getByTestId("tracker-menu-theme-standard").querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example/media/thumb-standard/w480.webp");
    expect(getByTestId("tracker-menu-theme-standard").textContent).toContain("Standard");
  });

  it("shows a chrome swatch for a theme without a thumbnail", () => {
    seedMedia();
    const { getByTestId } = renderPicker(() => {});
    const button = getByTestId("tracker-menu-theme-night");
    expect(button.querySelector("img")).toBeNull();
    const swatch = getByTestId("tracker-menu-theme-swatch-night");
    expect(swatch.style.getPropertyValue("--swatch-bg")).toBe("hsl(215 48% 11%)");
    expect(swatch.style.getPropertyValue("--swatch-ring")).toBe("hsl(192 100% 60%)");
    const css = readFileSync(trackerModulePath, "utf8");
    expect(ruleOf(css, ".themeSwatch")).toContain("background: var(--swatch-bg)");
    expect(ruleOf(css, ".themeSwatch")).toContain("var(--swatch-ring)");
  });

  it("shows the swatch when the thumbnail's media is missing", () => {
    act(() => store.setState({ ...initialStore }));
    const { getByTestId } = renderPicker(() => {});
    expect(getByTestId("tracker-menu-theme-standard").querySelector("img")).toBeNull();
    expect(getByTestId("tracker-menu-theme-swatch-standard")).toBeTruthy();
  });

  it("underlines the active theme only", () => {
    seedMedia();
    const { getByTestId } = renderPicker(() => {}, "night");
    expect(getByTestId("tracker-menu-theme-night").className).toContain("onMark");
    expect(getByTestId("tracker-menu-theme-night").getAttribute("aria-checked")).toBe("true");
    expect(getByTestId("tracker-menu-theme-standard").className).not.toContain("onMark");
  });

  it("a pick stays busy until the theme switch settles", async () => {
    seedMedia();
    let release: () => void = () => {};
    const onThemeChange = vi.fn(() => new Promise<void>((res) => (release = res)));
    const { getByTestId } = renderPicker(onThemeChange);
    fireEvent.click(getByTestId("tracker-menu-theme-night"));
    expect(onThemeChange).toHaveBeenCalledWith("night");
    expect(getByTestId("tracker-menu-theme-night").getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(getByTestId("tracker-menu-theme-night").getAttribute("aria-busy")).toBeNull(),
    );
  });
});

describe("TrackerMenu in the Map section", () => {
  function themeRow(key: string, renderer: string) {
    return {
      id: key.length,
      renderer,
      key,
      name: key.toUpperCase(),
      styleUrl: `https://cdn.example/themes/${key}.json`,
      spriteUrl: null,
      thumbnailMediaId: null,
      chrome: { bg: "white", fg: "gray", text: "black", tile: "silver", tileFg: "black", panel: "white", accent: "blue" },
      overlay: {
        routeColor: "blue",
        routeOpacity: 1,
        arrowColor: "white",
        timeLabelBg: "black",
        timeLabelFg: "white",
        timeLabelOpacity: 1,
        userColor: "red",
      },
      defaultLightMode: false,
      defaultDarkMode: false,
    };
  }

  async function renderSection() {
    sectionMocks.controller = {
      setTheme: vi.fn(async () => {}),
      setPois: vi.fn(),
      setMapType: vi.fn(),
      setFlightHistory: vi.fn(),
      setViewpoints: vi.fn(),
      setToggles: vi.fn(),
      setLiveFix: vi.fn(),
      follow: vi.fn(),
      recenter: vi.fn(),
      zoomBy: vi.fn(),
      fitHistory: vi.fn(),
      enableUserLocation: vi.fn(async () => {}),
      disableUserLocation: vi.fn(),
      getUserLocation: vi.fn(() => null),
      destroy: vi.fn(),
    };
    act(() => {
      store.setState({
        ...initialStore,
        snapshot: {
          schemaVersion: 1,
          media: {},
          icons: {},
          event: { id: 1, trackerBbox: { west: -114.3, south: 46.75, east: -113.8, north: 47.05 }, trackerMap: null },
          trackerThemes: [
            themeRow("standard", "google"),
            themeRow("night", "google"),
            themeRow("route-light", "maplibre"),
            themeRow("route-dark", "maplibre"),
          ],
        } as never,
      });
    });
    const { Map } = await import("../../../../src/content/sections/Map/Map");
    const bundle = { content: null, media: {}, icons: {} } as unknown as import("../../../../src/store/types").ContentBundle;
    const utils = render(
      <MemoryRouter>
        <Map data={{ controls: { themePicker: true, terrain: true } }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    fireEvent.click(utils.getByRole("button", { name: "Tracker menu" }));
    return utils;
  }

  function pickerKeys(utils: ReturnType<typeof render>): (string | null)[] {
    return utils
      .getAllByRole("radio")
      .map((b) => b.getAttribute("data-testid"))
      .filter((id) => id !== null && id.startsWith("tracker-menu-theme-"));
  }

  it("lists the enabled themes of the active renderer", async () => {
    sectionMocks.renderer = "maplibre";
    const utils = await renderSection();
    expect(pickerKeys(utils)).toEqual(["tracker-menu-theme-route-light", "tracker-menu-theme-route-dark"]);
    cleanup();
    sectionMocks.renderer = "google";
    const google = await renderSection();
    expect(pickerKeys(google)).toEqual(["tracker-menu-theme-standard", "tracker-menu-theme-night"]);
  });

  it("the Terrain and Road pair calls setMapType, terrain first", async () => {
    sectionMocks.renderer = "maplibre";
    const utils = await renderSection();
    const setMapType = sectionMocks.controller!.setMapType;
    expect(setMapType).toHaveBeenLastCalledWith("terrain");
    fireEvent.click(utils.getByRole("radio", { name: "Road" }));
    expect(setMapType).toHaveBeenLastCalledWith("roadmap");
    fireEvent.click(utils.getByRole("radio", { name: "Terrain" }));
    expect(setMapType).toHaveBeenLastCalledWith("terrain");
  });
});
