// docs/site.md section 5.1. The store hook recomputes when the selector
// changes with the store held still, and keeps identity when the selector
// result is equal under the caller's comparison.

import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { store, useStore } from "../../src/store/useStore";
import { initialStore } from "../../src/store/types";
import type { SiteStore } from "../../src/store/types";

afterEach(() => {
  cleanup();
  act(() => store.setState(() => ({ ...initialStore })));
});

function Reader({ slug }: { slug: string }) {
  const value = useStore((s: SiteStore) => `${slug}:${s.diag.consecutivePollFailures}`);
  return <output data-testid="value">{value}</output>;
}

describe("useStore", () => {
  it("recomputes when the selector changes and the store does not", () => {
    const { rerender } = render(<Reader slug="about" />);
    expect(screen.getByTestId("value").textContent).toBe("about:0");
    rerender(<Reader slug="sponsors" />);
    expect(screen.getByTestId("value").textContent).toBe("sponsors:0");
  });

  it("re-renders on a store change", () => {
    render(<Reader slug="about" />);
    act(() => store.setState((s) => ({ ...s, diag: { ...s.diag, consecutivePollFailures: 2 } })));
    expect(screen.getByTestId("value").textContent).toBe("about:2");
  });

  it("keeps the previous result when the caller's comparison says equal", () => {
    const seen: object[] = [];
    function Obj({ n }: { n: number }) {
      const value = useStore(
        (s: SiteStore) => ({ n: Math.min(n, 1), failures: s.diag.consecutivePollFailures }),
        (a, b) => a.n === b.n && a.failures === b.failures,
      );
      seen.push(value);
      return null;
    }
    const { rerender } = render(<Obj n={1} />);
    rerender(<Obj n={5} />);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});
