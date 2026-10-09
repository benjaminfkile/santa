// docs/site.md section 8.5. Pure parts of the flight history overlay:
// arrow step and scale by zoom, label interval by zoom, label text
// formatting, and the label-point selection that walks the timed points
// and picks a label each time the elapsed time crosses the next interval.
// Below zoom 12 the time labels collapse to clickable dots titled with the
// label text; a click shows the full label for 2.5 s.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createFlightHistoryOverlay,
  timeDotSvgDataUri,
  timeLabelSvgDataUri,
  timeLabelsCollapsedForZoom,
  arrowStepForZoom,
  arrowScaleForZoom,
  labelIntervalMinutesForZoom,
  formatLabelText,
  pickLabelPoints,
  type HistoryPoint,
} from "../../../src/map/flightHistoryOverlay";
import { SEEDED } from "./themeFixtures";
import { FakeMap, FakeMapObject, fakeLibs, installFakeGoogle, resetFakeGoogle } from "./fakeGoogle";

describe("arrowStepForZoom", () => {
  it("uses 20 at zoom 15 and above", () => {
    expect(arrowStepForZoom(15)).toBe(20);
    expect(arrowStepForZoom(18)).toBe(20);
  });
  it("uses 40 at zoom 13 to 14", () => {
    expect(arrowStepForZoom(13)).toBe(40);
    expect(arrowStepForZoom(14)).toBe(40);
  });
  it("uses 80 at zoom 11 to 12", () => {
    expect(arrowStepForZoom(11)).toBe(80);
    expect(arrowStepForZoom(12)).toBe(80);
  });
  it("uses 150 at zoom 9 to 10", () => {
    expect(arrowStepForZoom(9)).toBe(150);
    expect(arrowStepForZoom(10)).toBe(150);
  });
  it("uses 250 below zoom 9", () => {
    expect(arrowStepForZoom(8)).toBe(250);
    expect(arrowStepForZoom(3)).toBe(250);
  });
});

describe("arrowScaleForZoom", () => {
  it("uses 3 at zoom 9 and above", () => {
    expect(arrowScaleForZoom(9)).toBe(3);
    expect(arrowScaleForZoom(18)).toBe(3);
  });
  it("uses 2 below zoom 9", () => {
    expect(arrowScaleForZoom(8)).toBe(2);
    expect(arrowScaleForZoom(3)).toBe(2);
  });
});

describe("labelIntervalMinutesForZoom", () => {
  it("uses 5 minutes above zoom 12", () => {
    expect(labelIntervalMinutesForZoom(13)).toBe(5);
    expect(labelIntervalMinutesForZoom(18)).toBe(5);
  });
  it("uses 20 minutes at zoom 12 and below", () => {
    expect(labelIntervalMinutesForZoom(12)).toBe(20);
    expect(labelIntervalMinutesForZoom(5)).toBe(20);
  });
});

describe("formatLabelText", () => {
  it("renders minutes only under an hour", () => {
    expect(formatLabelText(0)).toBe("0 min");
    expect(formatLabelText(35)).toBe("35 min");
    expect(formatLabelText(59)).toBe("59 min");
  });
  it("renders whole hours without minutes", () => {
    expect(formatLabelText(60)).toBe("1 hr");
    expect(formatLabelText(120)).toBe("2 hr");
  });
  it("renders hours plus minutes", () => {
    expect(formatLabelText(80)).toBe("1 hr 20 min");
    expect(formatLabelText(185)).toBe("3 hr 5 min");
  });
});

describe("pickLabelPoints", () => {
  function ptAt(minute: number): HistoryPoint {
    const t = new Date(Date.UTC(2025, 11, 24, 20, 0, 0) + minute * 60000);
    return { lat: 40 + minute * 0.01, lng: -105 + minute * 0.01, recordedAt: t.toISOString() };
  }

  it("returns nothing when the interval is zero or the list is empty", () => {
    expect(pickLabelPoints([], 5)).toEqual([]);
    expect(pickLabelPoints([ptAt(0), ptAt(5)], 0)).toEqual([]);
  });

  it("picks the first point past each interval boundary", () => {
    const points: HistoryPoint[] = Array.from({ length: 61 }, (_, i) => ptAt(i));
    const labels = pickLabelPoints(points, 5);
    expect(labels.map((l) => l.minutesElapsed)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(labels.map((l) => l.labelText)).toEqual([
      "5 min", "10 min", "15 min", "20 min", "25 min", "30 min",
      "35 min", "40 min", "45 min", "50 min", "55 min", "1 hr",
    ]);
  });

  it("uses the first timed point as the anchor and skips null recordedAt", () => {
    const points: HistoryPoint[] = [
      { lat: 0, lng: 0, recordedAt: null },
      ptAt(0),
      { lat: 0, lng: 0, recordedAt: null },
      ptAt(5),
      ptAt(20),
    ];
    const labels = pickLabelPoints(points, 5);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0].minutesElapsed).toBe(5);
    expect(labels[labels.length - 1].minutesElapsed).toBe(20);
  });

  it("returns nothing when no point carries a timestamp", () => {
    const points: HistoryPoint[] = [
      { lat: 0, lng: 0, recordedAt: null },
      { lat: 1, lng: 1, recordedAt: null },
    ];
    expect(pickLabelPoints(points, 5)).toEqual([]);
  });
});

describe("timeLabelsCollapsedForZoom", () => {
  it("collapses below zoom 12 only", () => {
    expect(timeLabelsCollapsedForZoom(11)).toBe(true);
    expect(timeLabelsCollapsedForZoom(12)).toBe(false);
  });
});

describe("createFlightHistoryOverlay time labels", () => {
  const theme = SEEDED.night;
  const points: HistoryPoint[] = Array.from({ length: 41 }, (_, i) => ({
    lat: 40 + i * 0.01,
    lng: -105 + i * 0.01,
    recordedAt: new Date(Date.UTC(2025, 11, 24, 20, i, 0)).toISOString(),
  }));

  beforeEach(() => {
    installFakeGoogle();
    resetFakeGoogle();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function labelMarkers(): FakeMapObject[] {
    return [...FakeMapObject.live].filter((o) => typeof o.opts.title === "string");
  }

  function draw(zoom: number) {
    const map = new FakeMap(document.createElement("div"), { zoom });
    const overlay = createFlightHistoryOverlay(fakeLibs(), map as unknown as google.maps.Map, points);
    overlay.redraw(theme, zoom, { flightHistory: true, timeLabels: true });
    return overlay;
  }

  it("draws clickable dots titled with the label text at zoom 11, the full label on a click for 2.5 s", () => {
    const overlay = draw(11);
    const markers = labelMarkers();
    expect(markers.map((m) => m.opts.title)).toEqual(["20 min", "40 min"]);
    for (const m of markers) {
      expect(m.opts.clickable).toBe(true);
      expect((m.opts.icon as { url: string }).url).toBe(timeDotSvgDataUri(theme));
    }
    const first = markers[0];
    first.trigger("click");
    expect((first.icons[0] as { url: string }).url).toBe(timeLabelSvgDataUri("20 min", theme));
    vi.advanceTimersByTime(2499);
    expect(first.icons).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect((first.icons[1] as { url: string }).url).toBe(timeDotSvgDataUri(theme));

    first.trigger("click");
    overlay.destroy();
    vi.advanceTimersByTime(5000);
    expect(first.icons).toHaveLength(3);
  });

  it("draws the full labels, not clickable, at zoom 13", () => {
    draw(13);
    const markers = labelMarkers();
    expect(markers).toHaveLength(8);
    for (const m of markers) {
      expect(m.opts.clickable).toBe(false);
      expect((m.opts.icon as { url: string }).url).toBe(timeLabelSvgDataUri(m.opts.title as string, theme));
      expect(m.listeners.size).toBe(0);
    }
  });
});
