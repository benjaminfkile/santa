// docs/site.md section 18. No stylesheet or inline style under src/ uses
// backdrop-filter: Safari on iOS repaints the blurred backdrop on every
// frame, so translucent surfaces use pre-blended fills instead.

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
    else if (info.isFile() && /\.(?:tsx?|css)$/.test(full)) hits.push(full);
  }
  return hits;
}

// The property in CSS (with or without the webkit prefix) and in a React
// style object.
const BANNED = [/backdrop-filter\s*:/i, /\b(?:Webkit|webkit)?[bB]ackdropFilter\b/];

describe("no backdrop-filter in the stylesheets", () => {
  it("finds stylesheets to sweep", () => {
    expect(walk(srcRoot, []).filter((f) => f.endsWith(".css")).length).toBeGreaterThan(10);
  });

  it("no file under src/ sets backdrop-filter", () => {
    const offenders: string[] = [];
    for (const file of walk(srcRoot, [])) {
      const text = readFileSync(file, "utf8");
      text.split(/\r?\n/).forEach((line, i) => {
        if (BANNED.some((re) => re.test(line))) {
          offenders.push(`${relative(repoRoot, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("index.html sets no backdrop-filter", () => {
    const html = readFileSync(resolve(repoRoot, "index.html"), "utf8");
    expect(BANNED.some((re) => re.test(html))).toBe(false);
  });
});
