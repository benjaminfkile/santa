// docs/site.md section 7.7. Sections and blocks must draw their colours,
// radii, and fonts from the theme tokens. This lint-style test scans every
// stylesheet, .ts, and .tsx file under src/ and fails when a hex colour
// appears outside tokens.css. `src/map/themes/*.ts` (the Google Maps
// style JSON) and the generated icons are excluded.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../../src");
const tokensPath = resolve(srcRoot, "content/theme/tokens.css");
const themesDir = resolve(srcRoot, "map/themes");
const generatedIconsDir = resolve(srcRoot, "content/icons/generated");

function isExcludedFile(full: string): boolean {
  if (full === tokensPath) return true;
  if (full.startsWith(themesDir + sep) || full === themesDir) return true;
  if (full.startsWith(generatedIconsDir + sep) || full === generatedIconsDir) return true;
  if (full.endsWith(".d.css.ts")) return true;
  return false;
}

function walk(dir: string, hits: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full, hits);
    } else if (
      info.isFile() &&
      (full.endsWith(".css") || full.endsWith(".ts") || full.endsWith(".tsx"))
    ) {
      if (!isExcludedFile(full)) hits.push(full);
    }
  }
  return hits;
}

const hexPattern = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g;

describe("no hex colours outside tokens.css", () => {
  it("stylesheets, .ts, and .tsx files under src/ carry no hex colour except in tokens.css", () => {
    const files = walk(srcRoot, []);
    const offences: string[] = [];
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      const matches = body.match(hexPattern);
      if (matches) {
        offences.push(`${relative(srcRoot, file)}: ${matches.join(", ")}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
