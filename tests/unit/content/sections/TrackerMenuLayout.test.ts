// docs/site.md section 7.6. The tracker menu card's width, which a DOM test
// cannot see, because jsdom has no layout: 400 px above 760 px, so the
// one-row footer keeps clear space after the account button with the route
// group open, and the full width at 760 px and below.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(
  __dirname,
  "../../../../src/content/sections/Map/TrackerMenu.module.css",
);
const css = readFileSync(cssPath, "utf8");

// The declarations of one rule, by selector, from a given offset.
function ruleOf(selector: string, from = 0): string {
  const at = css.indexOf(selector + " {", from);
  expect(at).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

// The body of one media block, by its query.
function mediaOf(query: string): string {
  const at = css.indexOf("@media " + query + " {");
  expect(at).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("\n}", at));
}

describe("the tracker menu card", () => {
  it("is 400 px wide, never wider than the screen", () => {
    expect(ruleOf(".trackerMenu")).toContain("width: min(400px, 100%);");
  });

  it("takes the full width at 760 px and below", () => {
    const block = mediaOf("(max-width: 760px)");
    expect(block).toMatch(/\.trackerMenu \{ width: 100%; \}/);
  });

  it("still wraps the footer below a 360 px viewport", () => {
    const block = mediaOf("(max-width: 359.98px)");
    expect(block).toContain(".footer { flex-wrap: wrap;");
    expect(block).toContain(".footerEnd { flex-wrap: wrap;");
  });
});
