// docs/site.md section 7.6 and S17f. Tracker menu data row units:
// distance in feet under a mile / miles above; the viewer's timezone for the
// liftoff, recorded, and received timestamps; every value in --font-mono
// with tabular numerals through the co-located CSS module. The footer row:
// the account button alone on the left, the other buttons on the right.

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

const here = dirname(fileURLToPath(import.meta.url));
const trackerModulePath = resolve(here, "../../../../src/content/sections/Map/TrackerMenu.module.css");

const themes: MapTheme[] = [
  {
    key: "standard",
    label: "Standard",
    styles: [],
    routeColor: "hsl(210 100% 40%)",
    routeOpacity: 1,
    arrowColor: "hsl(210 100% 40%)",
    timeLabelBg: "hsl(0 0% 100%)",
    timeLabelFg: "hsl(0 0% 0%)",
    timeLabelOpacity: 1,
    userColor: "hsl(210 100% 40%)",
    chrome: {
      bg: "hsl(0 0% 100%)",
      fg: "hsl(0 0% 40%)",
      text: "hsl(0 0% 0%)",
      tile: "hsl(120 30% 80%)",
      tileFg: "hsl(0 0% 0%)",
      panel: "hsl(0 0% 100%)",
      accent: "hsl(210 100% 40%)",
    },
  },
];

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
      onFitHistory: () => {},
      onOpenLocation: () => {},
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

  it("formats liftoff, recorded, and received times through formatEventTime", () => {
    seedLive();
    const { getByTestId } = render(
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
          onFitHistory={() => {}}
          onOpenLocation={() => {}}
          distanceMetres={null}
        />
      </MemoryRouter>,
    );
    expect(getByTestId("data-row-liftoff").textContent).toContain(formatEventTime("2026-12-24T01:00:00Z"));
    expect(getByTestId("data-row-recorded").textContent).toContain(formatEventTime("2026-12-24T02:15:00Z"));
    expect(getByTestId("data-row-received").textContent).toContain(formatEventTime("2026-12-24T02:15:03Z"));
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
    onFitHistory: () => {},
    onOpenLocation: () => {},
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
  "tracker-menu-fit-history",
];

function expectRightGroupUnchanged(getByTestId: (id: string) => HTMLElement): void {
  const right = getByTestId("tracker-menu-toggles");
  const labels = Array.from(right.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"));
  expect(labels).toEqual(["Flight data", "Your location", "Flight history", "Time labels", "Fit history", "Close menu"]);
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

  it("with every control on and a flight history present the seven buttons are fixed 44 px squares and the right group wraps", () => {
    const { getByTestId } = renderMenu({ status: "signedOut" });
    const left = getByTestId("tracker-menu-account");
    const right = getByTestId("tracker-menu-toggles");
    expect(left.parentElement).toBe(right.parentElement);
    expect(left.parentElement?.children).toHaveLength(2);
    const buttons = [...Array.from(left.querySelectorAll("button")), ...Array.from(right.querySelectorAll("button"))];
    expect(buttons).toHaveLength(7);
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
    expect(classes.length).toBe(9);
    for (const c of classes) expect(["footerBtn", "close"]).toContain(c);

    const css = readFileSync(trackerModulePath, "utf8");
    expect(css).toMatch(/\.footer\s*\{[^}]*justify-content:\s*space-between/);
    expect(css).toMatch(/\.footer\s*\{[^}]*align-items:\s*flex-start/);
    expect(css).toMatch(/\.footerStart\s*\{[^}]*flex:\s*none/);
    expect(css).toMatch(/\.footerEnd\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.footerEnd\s*\{[^}]*justify-content:\s*flex-end/);
    expect(css).toMatch(/\.footerEnd\s*\{[^}]*gap:\s*6px 4px/);
    expect(css).toMatch(/\.footerBtn\s*\{[^}]*flex:\s*none;[^}]*width:\s*44px;[^}]*height:\s*44px/);
    expect(css).not.toMatch(/\.footerBtn\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.close\s*\{\s*composes:\s*footerBtn/);
    expect(css).toMatch(/\.trackerMenu\s*\{[^}]*width:\s*min\(301px,\s*100%\)/);
    expect(css).toMatch(/\.panel\s*\{[^}]*padding:\s*6px/);
  });
});

