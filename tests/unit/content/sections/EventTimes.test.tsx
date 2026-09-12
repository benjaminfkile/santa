// docs/site.md section 22.1. EventTimes: each field shown only when
// present; `airborneFor` ticks; `America/Denver` formatting.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { EventTimes } from "../../../../src/content/sections/EventTimes/EventTimes";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Snapshot, LiveObject } from "../../../../src/contracts";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function setState(live: Partial<LiveObject>, event: Snapshot["event"]) {
  act(() =>
    store.setState({
      live: { schemaVersion: 1, publishedAt: "", ...live } as LiveObject,
      snapshot: { schemaVersion: 1, event } as Snapshot,
    }),
  );
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-22T02:12:11Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => store.setState({ ...initialStore }));
});

describe("EventTimes", () => {
  it("renders each field only when the value exists", () => {
    setState(
      { eventStatusId: 4 },
      {
        statusId: 4,
        scheduledAt: "2026-12-22T01:00:00Z",
        wentLiveAt: "2026-12-22T01:02:11Z",
        endedAt: "2026-12-22T03:14:00Z",
      },
    );
    const { container } = render(
      <EventTimes
        data={{
          fields: ["scheduledAt", "wentLiveAt", "endedAt", "airborneFor"],
          labels: { scheduledAt: "Scheduled", wentLiveAt: "Liftoff", endedAt: "Wheels down" },
        }}
        items={[]}
        bundle={bundle}
      />,
    );
    const rows = container.querySelectorAll("dl > [data-row]");
    expect(rows.length).toBe(3);
    expect(container.textContent).toContain("Scheduled");
    expect(container.textContent).toContain("Liftoff");
    expect(container.textContent).toContain("Wheels down");
  });

  it("formats scheduledAt in America/Denver", () => {
    setState(
      { eventStatusId: 4 },
      {
        statusId: 4,
        scheduledAt: "2026-12-22T01:00:00Z",
        wentLiveAt: null,
        endedAt: null,
      },
    );
    const { container } = render(
      <EventTimes
        data={{
          fields: ["scheduledAt"],
          labels: { scheduledAt: "Scheduled" },
        }}
        items={[]}
        bundle={bundle}
      />,
    );
    const value = container.querySelector("dd")?.textContent ?? "";
    expect(value).toMatch(/Dec\s+21/);
    expect(value).toMatch(/PM/);
    expect(value).toMatch(/M[SD]T/);
  });

  it("shows airborneFor only while status is 3", () => {
    setState(
      { eventStatusId: 3 },
      { statusId: 3, wentLiveAt: "2026-12-22T01:02:11Z" },
    );
    const { container } = render(
      <EventTimes
        data={{ fields: ["airborneFor"], labels: { airborneFor: "Airborne for" } }}
        items={[]}
        bundle={bundle}
      />,
    );
    expect(container.textContent).toContain("Airborne for");
    expect(container.textContent).toContain("1h 10m");
  });

  it("omits airborneFor outside status 3", () => {
    setState(
      { eventStatusId: 4 },
      { statusId: 4, wentLiveAt: "2026-12-22T01:02:11Z" },
    );
    const { container } = render(
      <EventTimes
        data={{ fields: ["airborneFor"], labels: { airborneFor: "Airborne for" } }}
        items={[]}
        bundle={bundle}
      />,
    );
    expect(container.textContent).not.toContain("Airborne for");
  });

  it("blanks while !timeReady", () => {
    setState(
      { eventStatusId: 4 },
      { statusId: 3, wentLiveAt: "2026-12-22T01:02:11Z" },
    );
    const { container } = render(
      <EventTimes
        data={{ fields: ["wentLiveAt"], labels: { wentLiveAt: "Liftoff" } }}
        items={[]}
        bundle={bundle}
      />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector("dl")).toBeNull();
  });
});
