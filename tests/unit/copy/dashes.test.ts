// docs/site.md section 7.1. The site's own copy is limited to
// `copy/copy.ts`, and user-facing strings should read naturally without
// em (U+2014) or en (U+2013) dashes. This test scans every file under
// `src/` and fails on any hit.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const SRC_ROOT = resolve(__dirname, "..", "..", "..", "src");
const EM_DASH = "—";
const EN_DASH = "–";

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (stats.isFile()) {
      out.push(full);
    }
  }
  return out;
}

describe("no em or en dashes under src/", () => {
  it("finds no U+2014 or U+2013 in any src/ file", () => {
    const hits: { file: string; line: number; char: string }[] = [];
    for (const file of collectFiles(SRC_ROOT)) {
      const text = readFileSync(file, "utf8");
      if (!text.includes(EM_DASH) && !text.includes(EN_DASH)) continue;
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(EM_DASH)) {
          hits.push({ file: relative(SRC_ROOT, file), line: i + 1, char: "em" });
        }
        if (lines[i].includes(EN_DASH)) {
          hits.push({ file: relative(SRC_ROOT, file), line: i + 1, char: "en" });
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
