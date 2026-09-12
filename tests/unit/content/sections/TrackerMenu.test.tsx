// docs/site.md section 7.6 and S17f. Tracker menu data row units:
// distance in feet under a mile / miles above; mountain time for the
// liftoff, recorded, and received timestamps; every value in --font-mono
// with tabular numerals through the co-located CSS module.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { TrackerMenu } from "../../../../src/content/sections/Map/TrackerMenu";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { MapTheme } from "../../../../src/map/themes";

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

  it("formats liftoff, recorded, and received times through formatMountainTime", () => {
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
          onFitHistory={() => {}}
          onOpenLocation={() => {}}
          distanceMetres={null}
        />
      </MemoryRouter>,
    );
    // formatMountainTime renders "MST" or "MDT" as the zone abbreviation.
    expect(getByTestId("data-row-liftoff").textContent).toMatch(/M[SD]T/);
    expect(getByTestId("data-row-recorded").textContent).toMatch(/M[SD]T/);
    expect(getByTestId("data-row-received").textContent).toMatch(/M[SD]T/);
  });

  it("data row cells are rendered in --font-mono with tabular numerals", () => {
    const css = readFileSync(trackerModulePath, "utf8");
    expect(css).toMatch(/\.dataRow\s+dd\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
    expect(css).toMatch(/\.dataRow\s+dd\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });
});
