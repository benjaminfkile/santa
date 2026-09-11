// docs/site.md section 7.7. Fails when the generated inline icon
// components in src/content/icons/generated/ are stale (i.e. do not match
// what scripts/gen-icons.mjs would produce from contracts/icons/).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { computeIconOutputs } from "../../../../scripts/gen-icons.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "../../../../src/content/icons/generated");

describe("icon generator staleness", () => {
  it("every generated file matches the current output of scripts/gen-icons.mjs", async () => {
    const expected = await computeIconOutputs();
    const drift: string[] = [];
    for (const [name, body] of expected) {
      const path = resolve(OUT_DIR, name);
      if (!existsSync(path)) {
        drift.push(`missing: ${name}`);
        continue;
      }
      const actual = readFileSync(path, "utf8");
      if (actual !== body) drift.push(`differs: ${name}`);
    }
    expect(drift).toEqual([]);
  });

  it("library index exposes every id under contracts/icons/", async () => {
    const generated = await import("../../../../src/content/icons/generated/index");
    const expected = await computeIconOutputs();
    const expectedIds = Array.from(expected.keys())
      .filter((n) => n.endsWith(".tsx"))
      .map((n) => n.slice(0, -4))
      .sort();
    expect(generated.LIBRARY_ICON_IDS.slice().sort()).toEqual(expectedIds);
  });
});
