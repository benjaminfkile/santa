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
    const { getByTestId } = render(
      <Countdown data={{ heading: "Countdown" }} items={[]} bundle={bundle} />,
    );
    // When !timeReady no digits row is rendered; the aria-hidden blank
    // placeholder is the only child besides the heading. Look for a
    // decorative aria-hidden div inside the countdown root.
    const root = getByTestId("countdown");
    const blank = root.querySelector('[aria-hidden="true"]');
    expect(blank).not.toBeNull();
    // No aria-label from CountdownDigits present.
    expect(root.querySelector("[aria-label]")).toBeNull();
  });

  it("renders X d X h X m X s when status is 2 and timeReady", () => {
    setState({ eventStatusId: 2 }, { statusId: 2, scheduledAt: "2026-12-22T01:00:00Z" });
    const { getByTestId } = render(
      <Countdown data={{ heading: "Countdown to liftoff" }} items={[]} bundle={bundle} />,
    );
    const root = getByTestId("countdown");
    // The digits row is rendered as an inner element with an aria-label
    // matching the "N d N h N m N s" text.
    const digits = root.querySelector("[aria-label]");
    expect(digits).not.toBeNull();
    // Four cells inside digits.
    const cells = Array.from(digits!.children);
    expect(cells.length).toBe(4);
    const values = cells.map((c) => c.firstElementChild?.textContent ?? "");
    expect(values[0]).toBe("7");
    expect(values[1]).toBe("1");
    expect(values[2]).toBe("0");
    expect(values[3]).toBe("0");
  });

  it("exposes a data-testid=countdown on the root when rendered", () => {
    setState({ eventStatusId: 2 }, { statusId: 2, scheduledAt: "2026-12-22T01:00:00Z" });
    const { getByTestId } = render(
      <Countdown data={{ heading: "Countdown" }} items={[]} bundle={bundle} />,
    );
    expect(getByTestId("countdown")).not.toBeNull();
  });
});
