// docs/site.md section 7.4. FundsRing: the fill's data-level is low below
// 30, mid from 30 up to 100, met at 100 and above, from the raw percent.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { FundsRing, fundsLevel } from "../../../../src/content/sections/FundsRing/FundsRing";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Snapshot } from "../../../../src/contracts";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

function setEvent(event: Partial<NonNullable<Snapshot["event"]>> | null) {
  act(() =>
    store.setState({
      snapshot: { schemaVersion: 1, event } as unknown as Snapshot,
    }),
  );
}

function fillLevel(): string | null {
  const { container } = render(<FundsRing data={{}} items={[]} bundle={bundle} />);
  const circles = container.querySelectorAll("circle");
  return circles[1]?.getAttribute("data-level") ?? null;
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("fundsLevel", () => {
  it("is low below 30", () => {
    expect(fundsLevel(0)).toBe("low");
    expect(fundsLevel(29.9)).toBe("low");
  });
  it("is mid from 30 up to but not including 100", () => {
    expect(fundsLevel(30)).toBe("mid");
    expect(fundsLevel(99.9)).toBe("mid");
  });
  it("is met at 100 and above", () => {
    expect(fundsLevel(100)).toBe("met");
    expect(fundsLevel(140)).toBe("met");
  });
  it("is low with no number", () => {
    expect(fundsLevel(undefined)).toBe("low");
    expect(fundsLevel(null)).toBe("low");
  });
});

describe("FundsRing fill", () => {
  it("is low with no event", () => {
    setEvent(null);
    expect(fillLevel()).toBe("low");
  });
  it.each([
    [0, "low"],
    [29.9, "low"],
    [30, "mid"],
    [99.9, "mid"],
    [100, "met"],
    [140, "met"],
  ])("at %s percent is %s", (fundsPercent, level) => {
    setEvent({ fundsPercent });
    expect(fillLevel()).toBe(level);
  });
  it("reads the raw percent: 140 stays met while the number shows 100", () => {
    setEvent({ fundsPercent: 140 });
    const { container } = render(<FundsRing data={{}} items={[]} bundle={bundle} />);
    expect(container.textContent).toContain("100%");
    expect(container.querySelectorAll("circle")[1]?.getAttribute("data-level")).toBe("met");
  });
});
