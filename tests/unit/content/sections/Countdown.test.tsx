// docs/site.md section 22.1. Countdown: format and hide at zero, nothing
// outside status 2, blank while !timeReady.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Countdown } from "../../../../src/content/sections/Countdown/Countdown";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Snapshot, LiveObject } from "../../../../src/contracts";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function setState(live: Partial<LiveObject> | null, event: Snapshot["event"] | null) {
  act(() =>
    store.setState({
      live: live === null ? null : ({ schemaVersion: 1, publishedAt: "", ...live } as LiveObject),
      snapshot: event === null ? null : ({ schemaVersion: 1, event } as Snapshot),
    }),
  );
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-15T00:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => store.setState({ ...initialStore }));
});

describe("Countdown", () => {
  it("renders nothing outside status 2", () => {
    setState({ eventStatusId: 3 }, { statusId: 3, scheduledAt: "2026-12-22T01:00:00Z" });
    const { container } = render(
      <Countdown data={{ heading: "Countdown" }} items={[]} bundle={bundle} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when now >= scheduledAt", () => {
    setState({ eventStatusId: 2 }, { statusId: 2, scheduledAt: "2026-12-14T00:00:00Z" });
    const { container } = render(
      <Countdown data={{ heading: "Countdown" }} items={[]} bundle={bundle} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders blank while !timeReady", () => {
    setState({ eventStatusId: 2 }, { statusId: 3, scheduledAt: "2026-12-22T01:00:00Z" });
    const { container } = render(
      <Countdown data={{ heading: "Countdown" }} items={[]} bundle={bundle} />,
    );
    expect(container.querySelector(".countdown__blank")).not.toBeNull();
    expect(container.querySelector(".countdown__digits")).toBeNull();
  });

  it("renders X d X h X m X s when status is 2 and timeReady", () => {
    setState({ eventStatusId: 2 }, { statusId: 2, scheduledAt: "2026-12-22T01:00:00Z" });
    const { container } = render(
      <Countdown data={{ heading: "Countdown to liftoff" }} items={[]} bundle={bundle} />,
    );
    const digits = container.querySelector(".countdown__digits");
    expect(digits).not.toBeNull();
    const cells = container.querySelectorAll(".countdown__cell");
    expect(cells.length).toBe(4);
    const values = Array.from(container.querySelectorAll(".countdown__value")).map(
      (n) => n.textContent,
    );
    expect(values[0]).toBe("7");
    expect(values[1]).toBe("1");
    expect(values[2]).toBe("0");
    expect(values[3]).toBe("0");
  });
});
