// docs/site.md section 7.7. Sections and blocks must draw their colours,
// radii, and fonts from the theme tokens. This lint-style test scans every
// stylesheet under src/ and fails when a hex colour appears outside
// tokens.css.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../../src");
const tokensPath = resolve(srcRoot, "content/theme/tokens.css");

function walk(dir: string, hits: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full, hits);
    } else if (info.isFile() && full.endsWith(".css")) {
      hits.push(full);
    }
  }
  return hits;
}

const hexPattern = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g;

describe("no hex colours outside tokens.css", () => {
  it("stylesheets under src/ carry no hex colour except in tokens.css", () => {
    const files = walk(srcRoot, []);
    const offences: string[] = [];
    for (const file of files) {
      if (file === tokensPath) continue;
      const body = readFileSync(file, "utf8");
      const matches = body.match(hexPattern);
      if (matches) {
        offences.push(`${relative(srcRoot, file)}: ${matches.join(", ")}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
