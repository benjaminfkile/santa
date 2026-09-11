// docs/site.md section 7.7. Typed CSS modules: tcm generates a .d.css.ts
// beside each .module.css exposing every class as a named export, and
// TypeScript's allowArbitraryExtensions setting pairs the two. An import
// of an unknown class fails tsc, which this test proves by feeding a
// stubbed program to the compiler API.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../..");
const NODE = process.execPath;
const TSC = resolve(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");

describe("CSS module typing", () => {
  it("typecheck fails when a component imports an unknown CSS module class", () => {
    const work = mkdtempSync(join(tmpdir(), "wmsfo-css-typing-"));
    try {
      const css = "/* fixture */\n.knownClass { color: red; }\n";
      const dts =
        "export const __esModule: true;\n" +
        "export const knownClass: string;\n";
      const badTs = 'import * as styles from "./Fixture.module.css";\nconsole.log(styles.doesNotExist);\n';
      writeFileSync(join(work, "Fixture.module.css"), css);
      writeFileSync(join(work, "Fixture.module.d.css.ts"), dts);
      writeFileSync(join(work, "bad.ts"), badTs);
      writeFileSync(
        join(work, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "es2023",
            module: "esnext",
            moduleResolution: "bundler",
            allowArbitraryExtensions: true,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          },
          include: ["bad.ts"],
        }),
      );
      const result = spawnSync(NODE, [TSC, "-p", "tsconfig.json"], {
        cwd: work,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      const out = (result.stdout || "") + (result.stderr || "");
      expect(out).toMatch(/doesNotExist|has no exported member/);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it("the .d.css.ts sidecar exists for every .module.css in src/", () => {
    const rootDir = resolve(REPO_ROOT, "src");
    const modules: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const info = statSync(full);
        if (info.isDirectory()) walk(full);
        else if (full.endsWith(".module.css")) modules.push(full);
      }
    };
    walk(rootDir);
    const missing = modules.filter((path) => {
      const dts = path.replace(/\.module\.css$/, ".module.d.css.ts");
      try {
        readFileSync(dts, "utf8");
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
