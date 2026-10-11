// docs/site.md section 17. The site ignores the prefers-reduced-motion
// preference: the motion helpers return false even when matchMedia reports
// reduce, and no file under src/ but src/lib/motion.ts names the query.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { prefersReducedMotion, useReducedMotion } from "../../src/lib/motion";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../src");
const motionPath = resolve(srcRoot, "lib/motion.ts");

function walk(dir: string, files: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function reportReduce(): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("motion helpers", () => {
  it("prefersReducedMotion() is false while matchMedia reports reduce", () => {
    reportReduce();
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("useReducedMotion() is false while matchMedia reports reduce", () => {
    reportReduce();
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("names prefers-reduced-motion nowhere under src/ but src/lib/motion.ts", () => {
    const hits = walk(srcRoot, [])
      .filter((f) => f !== motionPath)
      .filter((f) => readFileSync(f, "utf8").includes("prefers-reduced-motion"))
      .map((f) => relative(srcRoot, f));
    expect(hits).toEqual([]);
  });
});
