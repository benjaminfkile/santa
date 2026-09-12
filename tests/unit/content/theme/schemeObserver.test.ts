// docs/site.md section 7.7 and S17f. One MutationObserver on
// <html>[data-theme] that non-CSS consumers subscribe to.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { subscribeScheme } from "../../../../src/content/theme/colorScheme";

let unsubs: (() => void)[] = [];

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  unsubs = [];
});

afterEach(() => {
  for (const u of unsubs) u();
  unsubs = [];
  document.documentElement.removeAttribute("data-theme");
});

describe("subscribeScheme", () => {
  it("fires when data-theme flips on <html>", async () => {
    let fired = 0;
    unsubs.push(subscribeScheme(() => {
      fired += 1;
    }));
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-theme", "light");
    // MutationObserver callbacks queue microtasks; flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(fired).toBeGreaterThanOrEqual(1);
  });

  it("stops firing after unsubscribe", async () => {
    let fired = 0;
    const stop = subscribeScheme(() => {
      fired += 1;
    });
    stop();
    document.documentElement.setAttribute("data-theme", "dark");
    await Promise.resolve();
    await Promise.resolve();
    expect(fired).toBe(0);
  });
});
