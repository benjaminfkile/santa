// docs/site.md section 7.1. Loading paints an empty main for the first
// 300 ms, then the status card with the turning snowflake, then the slow
// line after 15 s; unmounting clears both timers.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Loading } from "../../../src/pages/Loading";
import { copy } from "../../../src/copy/copy";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";

beforeEach(() => {
  vi.useFakeTimers();
  act(() => store.setState({ ...initialStore }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Loading", () => {
  it("paints an empty main before 300 ms", () => {
    const { container } = render(<Loading />);
    const main = container.querySelector("main#main");
    expect(main).not.toBeNull();
    expect(main?.childNodes).toHaveLength(0);
    act(() => vi.advanceTimersByTime(299));
    expect(container.querySelector("main#main")?.childNodes).toHaveLength(0);
  });

  it("shows the card with the title and a polite status after 300 ms", () => {
    const { container } = render(<Loading />);
    act(() => vi.advanceTimersByTime(300));
    const card = container.querySelector('[data-testid="loading"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector("svg")).not.toBeNull();
    const region = card?.querySelector('[role="status"]');
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.querySelector("h1")?.textContent).toBe(copy.loading.initial);
    expect(container.textContent).not.toContain(copy.loading.slow);
  });

  it("adds the slow line after 15 s", () => {
    const { container } = render(<Loading />);
    act(() => vi.advanceTimersByTime(14999));
    expect(container.textContent).not.toContain(copy.loading.slow);
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).toContain(copy.loading.slow);
  });

  it("leaves no timer behind after unmount", () => {
    const { unmount } = render(<Loading />);
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
