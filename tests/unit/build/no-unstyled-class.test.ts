// docs/site.md section 7.7 and S16f. After the module conversion every
// class name is exported by a typed CSS module and referenced through
// `styles.xxx`, so tsc fails on an unknown class. The one path that would
// bypass that check is a string literal in a `className=...` attribute:
// this test walks every `.tsx` under src/ and asserts no such string
// literal survives. When there are none, nothing needs to be verified
// against the stylesheets; the typed-module path already covers the rest.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../src");

function walk(dir: string, ext: string, hits: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, ext, hits);
    else if (info.isFile() && full.endsWith(ext)) hits.push(full);
  }
  return hits;
}

function readBraced(source: string, openIdx: number): string | null {
  if (source[openIdx] !== "{") return null;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
    } else if (ch === "`") {
      i++;
      while (i < source.length && source[i] !== "`") {
        if (source[i] === "\\") {
          i++;
        } else if (source[i] === "$" && source[i + 1] === "{") {
          i += 1;
          let d = 0;
          for (; i < source.length; i++) {
            if (source[i] === "{") d++;
            else if (source[i] === "}") {
              d--;
              if (d === 0) break;
            }
          }
        }
        i++;
      }
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(openIdx + 1, i);
      }
    }
  }
  return null;
}

function extractLiteralClasses(source: string): Set<string> {
  const hits = new Set<string>();
  const attr = /className\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of source.matchAll(attr)) {
    const text = m[1] ?? m[2] ?? "";
    for (const cls of text.split(/\s+/)) if (cls) hits.add(cls);
  }
  const bracedStarts = /className\s*=\s*\{/g;
  for (const m of source.matchAll(bracedStarts)) {
    const expr = readBraced(source, m.index! + m[0].length - 1);
    if (expr === null) continue;
    // Strip template literals to find bare string literals; strings inside
    // an equality comparison or template interpolation are not class
    // names in their own right, so drop them first.
    const outside = expr
      .replace(/`[^`]*`/g, "")
      .replace(/[!=]==?\s*("[^"]*"|'[^']*')/g, "")
      .replace(/("[^"]*"|'[^']*')\s*[!=]==?/g, "");
    for (const s of outside.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g)) {
      const text = s[1] ?? s[2] ?? "";
      for (const cls of text.split(/\s+/)) if (cls) hits.add(cls);
    }
  }
  return hits;
}

describe("no string-literal className anywhere in src", () => {
  it("every className comes from a typed CSS module", () => {
    const tsxFiles = walk(srcRoot, ".tsx", []);
    const offences: string[] = [];
    for (const f of tsxFiles) {
      const cls = extractLiteralClasses(readFileSync(f, "utf8"));
      for (const c of cls) {
        offences.push(`${c} (in ${relative(srcRoot, f)})`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("extractor picks up string-literal class tokens", () => {
    const source = 'const a = <div className="foo bar" />;\n';
    const tokens = extractLiteralClasses(source);
    expect(tokens.has("foo")).toBe(true);
    expect(tokens.has("bar")).toBe(true);
  });
});
