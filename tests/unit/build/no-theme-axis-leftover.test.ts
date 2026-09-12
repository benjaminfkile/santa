// docs/site.md section 7.7 and S15/S18. The design foundation collapsed
// the three previous theme axes (accent, surface, font pairing) into a
// single light/dark scheme. This test fails if any leftover attribute,
// localStorage key, or CSS selector for the removed axes reappears
// anywhere under src/ or index.html.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const srcRoot = resolve(repoRoot, "src");

function walk(dir: string, hits: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, hits);
    else if (info.isFile() && /\.(?:tsx?|css|html|mjs|js)$/.test(full)) hits.push(full);
  }
  return hits;
}

const banned = [
  /data-accent/,
  /data-surface/,
  /data-fonts/,
  /wmsfo\.theme\.accent/,
  /wmsfo\.theme\.surface/,
  /wmsfo\.theme\.fonts/,
  /\bAccentKey\b/,
  /\bSurfaceKey\b/,
  /\bFontKey\b/,
  /themeOverrides/,
  /applyTheme\b/,
];

describe("removed theme axes leave no leftover", () => {
  it("no reference to the removed axes remains in src/ or index.html", () => {
    const files = [...walk(srcRoot, []), resolve(repoRoot, "index.html")];
    const offences: string[] = [];
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      for (const re of banned) {
        if (re.test(body)) {
          offences.push(`${relative(repoRoot, file)}: ${re.source}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});
