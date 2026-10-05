// docs/site.md section 10. The two layout rules of the cookie dialog that
// a DOM test cannot see, because jsdom has no layout: the stepper buttons
// must own their box, and the type list must not shrink inside the
// dialog's scroll area. Both were real defects, and both are invisible to
// every other test in the suite.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(
  __dirname,
  "../../../../src/content/sections/CookieControl/CookieControl.module.css",
);
const css = readFileSync(cssPath, "utf8");

// The declarations of one rule, by selector.
function ruleOf(selector: string): string {
  const at = css.indexOf(selector + " {");
  expect(at).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

describe("the cookie dialog's stepper buttons", () => {
  it("own their box instead of composing a padded text-button recipe", () => {
    const rule = ruleOf(".stepBtn");
    // Composing `btnQuiet` put `.btn { padding: 0.4rem 1rem }` after this
    // rule in the sheet, so `padding: 0` lost and the glyph was squeezed to
    // 36px minus two 1rem sides: a 4px sliver. The plus and the minus then
    // read as specks whatever size, stroke or colour they were given.
    expect(rule).not.toContain("composes");
    expect(rule).toContain("padding: 0;");
    expect(rule).toContain("width: 36px");
    expect(rule).toContain("height: 36px");
  });

  it("size the glyph themselves, so it never depends on the button's padding", () => {
    expect(ruleOf(".stepBtn svg")).toContain("width: 20px");
  });

  it("dim a disabled stepper by colour, not by a wash that hides it", () => {
    // Disabled is the common state: every plus is disabled with no cookies
    // left, every minus at zero. A whole dialog at 0.5 opacity read as empty
    // circles.
    const rule = ruleOf(".stepBtn:disabled");
    expect(rule).toContain("opacity: 1");
    expect(rule).toContain("color: var(--text-dim)");
  });
});

describe("the cookie dialog's type list", () => {
  it("does not shrink, so the scroll area scrolls instead of clipping a row", () => {
    const rule = ruleOf(".rows");
    // The list is a flex child of `.scroll`. Without `flex: none` it shrinks
    // and, with `overflow: hidden` for its rounded corners, clips its last
    // row rather than letting the area scroll: on a short phone the last
    // cookie was cut in half and unreachable.
    expect(rule).toContain("flex: none");
    expect(rule).toContain("overflow: hidden");
  });

  it("sits in the dialog's scrolling region", () => {
    const dialogCss = readFileSync(
      resolve(__dirname, "../../../../src/ui/Dialog.module.css"),
      "utf8",
    );
    const at = dialogCss.indexOf(".scroll {");
    expect(at).toBeGreaterThan(-1);
    const scroll = dialogCss.slice(at, dialogCss.indexOf("}", at));
    expect(scroll).toContain("overflow-y: auto");
    expect(scroll).toContain("min-height: 0");
  });
});
