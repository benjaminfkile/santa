// docs/site.md section 7.5. {event:*} placeholders resolve from the
// snapshot; scheduledAt is formatted in the viewer's timezone.

import { describe, it, expect } from "vitest";
import { resolvePlaceholder } from "../../../../src/content/inline/placeholders";

const event = {
  name: "Santa Flyover 2026",
  year: 2026,
  scheduledAt: "2026-12-22T01:00:00Z",
} as unknown as Parameters<typeof resolvePlaceholder>[0];

// ICU may separate the time and the day period with a narrow no-break space.
function spaced(s: string): string {
  return s.replace(/\s/g, " ");
}

describe("resolvePlaceholder", () => {
  it("formats scheduledAt in the given zone with its abbreviation", () => {
    expect(spaced(resolvePlaceholder(event, "scheduledAt", "America/Denver"))).toBe("Dec 21, 2026, 6:00 PM MST");
    expect(spaced(resolvePlaceholder(event, "scheduledAt", "America/New_York"))).toBe("Dec 21, 2026, 8:00 PM EST");
  });

  it("resolves name and year", () => {
    expect(resolvePlaceholder(event, "name")).toBe("Santa Flyover 2026");
    expect(resolvePlaceholder(event, "year")).toBe("2026");
  });

  it("returns an empty string when there is no event", () => {
    expect(resolvePlaceholder(null, "scheduledAt")).toBe("");
  });
});
