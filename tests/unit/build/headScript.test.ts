// docs/site.md section 7.7 and S17f. The head script stamps data-theme
// before first paint. Its catch branch stamps nothing (system) rather
// than forcing dark. The test asserts that the catch clause does not
// call setAttribute for data-theme.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(resolve(here, "../../../index.html"), "utf8");

describe("index.html head script", () => {
  it("still runs the try branch to stamp light or dark from localStorage or matchMedia", () => {
    expect(indexHtml).toMatch(/wmsfo\.theme/);
    expect(indexHtml).toMatch(/prefers-color-scheme: dark/);
    expect(indexHtml).toMatch(/setAttribute\(\s*["']data-theme["']/);
  });

  it("only stamps data-theme once — from the try branch, not from catch", () => {
    // Extract the head script (between the first <script> and </script>
    // after `wmsfo.theme` so we're sure it's the theme boot script).
    const scriptMatch = indexHtml.match(/<script>([\s\S]*?wmsfo\.theme[\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const scriptBody = scriptMatch![1];
    const setAttrHits = scriptBody.match(/setAttribute\(\s*["']data-theme["']/g) ?? [];
    expect(setAttrHits.length).toBe(1);
  });

  it("outer catch clause does not fall back to dark", () => {
    // Isolate the boot script and look at every `catch (err)` in it: none
    // may stamp data-theme or hard-code the dark fallback.
    const scriptMatch = indexHtml.match(/<script>([\s\S]*?wmsfo\.theme[\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const scriptBody = scriptMatch![1];
    const errCatches = scriptBody.match(/catch\s*\(\s*err\s*\)\s*\{[\s\S]*?\}/g) ?? [];
    expect(errCatches.length).toBeGreaterThan(0);
    for (const body of errCatches) {
      expect(body).not.toMatch(/setAttribute\(\s*["']data-theme["']/);
    }
  });
});
