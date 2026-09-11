// docs/site.md section 7.7 and S16. The global stylesheet at
// src/content/theme/tokens.css must not carry any rule for a content
// section class. Section styles live in co-located CSS modules under
// src/content/sections/**/*.module.css. This test scans tokens.css for
// selectors that would step on those modules and fails the build if any
// creep back in.
//
// The map, tracker menu, route preview, and live-indicator selectors are
// intentionally left out of this list: S17 moves them.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, "../../../../src/content/theme/tokens.css");
const css = readFileSync(tokensPath, "utf8");

// Every content-section class prefix the S16 palette introduces. If a rule
// selector matches one of these the global sheet is stepping on a module.
const SECTION_CLASS_PREFIXES = [
  "hero",
  "rich-text",
  "block-heading",
  "block-paragraph",
  "block-list",
  "block-quote",
  "block-media",
  "block-links",
  "block-icon",
  "block-divider",
  "media-gallery",
  "links",
  "icon-row",
  "divider",
  "countdown",
  "event-times",
  "funds-ring",
  "latest-message",
  "leaderboard",
  "sponsor-carousel",
  "sponsor-grid",
  "alerts-signup",
  "contact-form",
  "cookie-control",
  "status-pill",
];

function stripComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findSelectorOffences(sheet: string): string[] {
  const body = stripComments(sheet);
  const offences: string[] = [];
  // Walk the top-level rules by tracking brace depth: any selector chunk
  // that appears at depth 0 immediately before an opening brace is a rule
  // selector. Inside @media / @supports blocks the depth is 1, so the same
  // rule applies once we drop back to a body containing selectors, which is
  // when the character right before the `{` is not `@`.
  let depth = 0;
  let lastBreak = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") {
      const selector = body.slice(lastBreak, i).trim();
      if (selector && !selector.startsWith("@")) {
        for (const prefix of SECTION_CLASS_PREFIXES) {
          // A section class either stands alone (`.hero`) or extends with a
          // BEM tail (`.hero__title`, `.hero--tall`, `.hero-copy`). The
          // boundary character is anything that ends a CSS ident, so the
          // next char after the prefix must not be a letter or digit.
          const pattern = new RegExp(`(^|[^A-Za-z0-9_-])\\.${prefix}(?![A-Za-z0-9])`);
          if (pattern.test(selector)) {
            offences.push(selector);
            break;
          }
        }
      }
      depth++;
      lastBreak = i + 1;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      lastBreak = i + 1;
    } else if (ch === ";" && depth === 0) {
      lastBreak = i + 1;
    } else if ((ch === "," || ch === "\n") && depth <= 1) {
      // Selectors can span commas or newlines; do nothing, keep the same
      // lastBreak so the full selector list is captured before the brace.
    }
  }
  return offences;
}

describe("global stylesheet holds no section rules", () => {
  it("tokens.css declares no rule for a content-section class", () => {
    const offences = findSelectorOffences(css);
    expect(offences).toEqual([]);
  });

  it("catches a deliberate section rule (proof the check works)", () => {
    const offending = `${css}\n.hero__intro { color: red; }\n.leaderboard__row { color: red; }\n`;
    const offences = findSelectorOffences(offending);
    expect(offences.some((s) => s.includes(".hero__intro"))).toBe(true);
    expect(offences.some((s) => s.includes(".leaderboard__row"))).toBe(true);
  });
});
