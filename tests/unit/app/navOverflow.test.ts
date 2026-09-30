// docs/site.md section 7.7. The priority-plus collapse math.

import { describe, it, expect } from "vitest";
import { visibleCount } from "../../../src/app/navOverflow";

describe("visibleCount", () => {
  const widths = [100, 80, 90, 70];
  // The whole row: 340 of items plus three 20 px gaps.
  const full = 400;

  it("keeps every item when the whole row fits, with no room kept for More", () => {
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: full })).toBe(4);
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 1000 })).toBe(4);
  });

  it("moves items into More last first as the width shrinks", () => {
    // Three items (310) plus a gap and More (80) needs 390.
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: full - 1 })).toBe(3);
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 390 })).toBe(3);
    // Two items (200) plus a gap and More needs 280.
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 389 })).toBe(2);
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 280 })).toBe(2);
    // One item (100) plus a gap and More needs 180.
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 279 })).toBe(1);
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 180 })).toBe(1);
    // Below that only More shows.
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 179 })).toBe(0);
    expect(visibleCount({ widths, gap: 20, moreWidth: 60, available: 0 })).toBe(0);
  });

  it("restores items from More, first out last back, as the width grows", () => {
    const counts = [150, 200, 300, 395, 400].map((available) =>
      visibleCount({ widths, gap: 20, moreWidth: 60, available }),
    );
    expect(counts).toEqual([0, 1, 2, 3, 4]);
  });

  it("tolerates sub-pixel rounding in the measured widths", () => {
    expect(visibleCount({ widths: [100.3, 99.9], gap: 0, moreWidth: 50, available: 200 })).toBe(2);
  });

  it("returns zero for an empty row", () => {
    expect(visibleCount({ widths: [], gap: 20, moreWidth: 60, available: 0 })).toBe(0);
  });
});
