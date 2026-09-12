// docs/site.md section 7.7 and S16f. The global stylesheet at
// src/content/theme/tokens.css must carry no CSS class rule at all.
// Every class rule lives in a co-located `.module.css` under src/ and is
// typed through tcm. The four selectors that survive globally are the
// attribute-based ones: `[data-theme]`, `[hidden]`, `:focus-visible`, and
// `::selection`. This test parses tokens.css and fails the build if a
// class selector `.x { ... }` appears anywhere in it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, "../../../../src/content/theme/tokens.css");
const css = readFileSync(tokensPath, "utf8");

function stripComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Walk the sheet at brace depth 0 (or 1, inside an @media/@supports) and
// collect every selector that appears immediately before an opening brace.
// A selector containing `.identifier` at any point is a class rule.
function findClassRuleSelectors(sheet: string): string[] {
  const body = stripComments(sheet);
  const offences: string[] = [];
  let depth = 0;
  let lastBreak = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{") {
      const selector = body.slice(lastBreak, i).trim();
      if (selector && !selector.startsWith("@")) {
        // Match `.name` where the char before is not part of an identifier
        // and the name begins with a letter or underscore.
        if (/(^|[^A-Za-z0-9_-])\.[A-Za-z_][A-Za-z0-9_-]*/.test(selector)) {
          offences.push(selector);
        }
      }
      depth += 1;
      lastBreak = i + 1;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      lastBreak = i + 1;
    } else if (ch === ";" && depth === 0) {
      lastBreak = i + 1;
    }
  }
  return offences;
}

describe("global stylesheet holds no class rules", () => {
  it("tokens.css declares no class rule at all", () => {
    const offences = findClassRuleSelectors(css);
    expect(offences).toEqual([]);
  });

  it("catches a deliberate class rule (proof the check works)", () => {
    const offending = `${css}\n.hero { color: red; }\n.foo__bar { color: red; }\n`;
    const offences = findClassRuleSelectors(offending);
    expect(offences.some((s) => s.includes(".hero"))).toBe(true);
    expect(offences.some((s) => s.includes(".foo__bar"))).toBe(true);
  });
});
