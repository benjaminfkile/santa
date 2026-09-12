// docs/site.md section 22.1. Leaderboard.rankCookieTypes: zero fill; sort
// by count, then `sort`, then `id`; empty types renders nothing.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Leaderboard, rankCookieTypes } from "../../../../src/content/sections/Leaderboard/Leaderboard";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Snapshot, LiveObject } from "../../../../src/contracts";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

function setStore(patch: {
  cookieTypes?: Snapshot["cookieTypes"];
  cookieTally?: LiveObject["cookieTally"];
}) {
  const s = store.getState();
  const nextSnapshot: Snapshot = {
    ...(s.snapshot ?? { schemaVersion: 1 }),
    cookieTypes: patch.cookieTypes,
  };
  const nextLive: LiveObject = {
    ...(s.live ?? { schemaVersion: 1, publishedAt: "" }),
    cookieTally: patch.cookieTally,
  };
  act(() =>
    store.setState({
      snapshot: nextSnapshot,
      live: nextLive,
    }),
  );
}

describe("rankCookieTypes", () => {
  it("zero-fills counts for missing tally entries", () => {
    const ranked = rankCookieTypes(
      [
        { id: 1, name: "Chocolate", icon: null, sort: 10 },
        { id: 2, name: "Ginger", icon: null, sort: 20 },
      ],
      { "1": 5 },
    );
    expect(ranked.map((r) => [r.id, r.count])).toEqual([
      [1, 5],
      [2, 0],
    ]);
  });

  it("sorts by count desc, then sort asc, then id asc", () => {
    const ranked = rankCookieTypes(
      [
        { id: 5, name: "E", icon: null, sort: 30 },
        { id: 3, name: "C", icon: null, sort: 10 },
        { id: 4, name: "D", icon: null, sort: 20 },
        { id: 2, name: "B", icon: null, sort: 20 },
        { id: 1, name: "A", icon: null, sort: 10 },
      ],
      { "1": 10, "3": 10, "4": 5, "2": 5, "5": 0 },
    );
    expect(ranked.map((r) => r.id)).toEqual([1, 3, 2, 4, 5]);
  });

  it("returns an empty array for empty cookieTypes", () => {
    expect(rankCookieTypes([], {})).toEqual([]);
  });
});

describe("Leaderboard section", () => {
  it("renders nothing when cookieTypes is empty and there is no emptyText", () => {
    setStore({ cookieTypes: [], cookieTally: {} });
    const { container } = render(
      <Leaderboard data={{ variant: "full" }} items={[]} bundle={bundle} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders the empty text when cookieTypes is empty and emptyText is set", () => {
    setStore({ cookieTypes: [], cookieTally: {} });
    const { container } = render(
      <Leaderboard
        data={{ variant: "full", emptyText: "No cookies yet." }}
        items={[]}
        bundle={bundle}
      />,
    );
    expect(container.textContent).toContain("No cookies yet.");
  });

  it("renders rows with counts sorted by rankCookieTypes", () => {
    setStore({
      cookieTypes: [
        { id: 1, name: "Chocolate", icon: null, sort: 10 },
        { id: 2, name: "Ginger", icon: null, sort: 20 },
      ],
      cookieTally: { "1": 3, "2": 7 },
    });
    const { container } = render(
      <Leaderboard data={{ variant: "full" }} items={[]} bundle={bundle} />,
    );
    const rows = container.querySelectorAll("ol > li");
    expect(rows.length).toBe(2);
    expect(rows[0]?.textContent).toContain("Ginger");
    expect(rows[0]?.textContent).toContain("7");
    expect(rows[1]?.textContent).toContain("Chocolate");
    expect(rows[1]?.textContent).toContain("3");
  });

  it("exposes leaderboard-count on each row count cell", () => {
    setStore({
      cookieTypes: [
        { id: 1, name: "Chocolate", icon: null, sort: 10 },
        { id: 2, name: "Ginger", icon: null, sort: 20 },
      ],
      cookieTally: { "1": 3, "2": 7 },
    });
    const { getAllByTestId } = render(
      <Leaderboard data={{ variant: "full" }} items={[]} bundle={bundle} />,
    );
    const counts = getAllByTestId("leaderboard-count");
    expect(counts.map((n) => n.textContent?.trim())).toEqual(["7", "3"]);
  });

  it("panel variant caps to five rows until expanded", () => {
    const types = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `Type ${i + 1}`,
      icon: null,
      sort: i,
    }));
    const tally: Record<string, number> = {};
    for (const t of types) tally[String(t.id)] = 10 - t.sort;
    setStore({ cookieTypes: types, cookieTally: tally });
    const { container } = render(
      <Leaderboard data={{ variant: "panel" }} items={[]} bundle={bundle} />,
    );
    expect(container.querySelectorAll("ol > li").length).toBe(5);
  });
});
