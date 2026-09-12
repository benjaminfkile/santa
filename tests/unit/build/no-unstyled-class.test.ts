// docs/site.md section 7.7 and S18. Every class name that TSX in src/
// emits must have a rule in one of the stylesheets shipped by the site.
// Typed CSS module imports already fail the build when a missing class
// is referenced through `styles.xxx`; this test covers the other path
// where classes are used as string literals (`className="foo"`, template
// literals mixing `styles.xxx` with global class strings). It reads every
// `.tsx` file under src/, extracts class-name tokens from `className`
// attributes, and asserts each token is defined in a stylesheet under
// src/.

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

// Read a brace-delimited expression starting at `openIdx` (which must
// point at `{`). Tracks string, template, and comment context so nested
// braces do not confuse the scan. Returns the content between the
// matching braces (exclusive), or null on an unbalanced input.
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
          // Recurse over the interpolation.
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

// Split a template-literal `raw` string into whole class-name tokens.
// The literal is broken up by every `${...}` interpolation; a token
// that abuts an interpolation with no whitespace between is a class
// prefix (e.g. the `block-heading--h` in `block-heading--h${level}`)
// and must not be treated as a class name on its own.
function tokensFromTemplate(raw: string): string[] {
  const chunks: { text: string; leftAbut: boolean; rightAbut: boolean }[] = [];
  let i = 0;
  let prevAbutted = false;
  while (i < raw.length) {
    const dollar = raw.indexOf("${", i);
    if (dollar === -1) {
      chunks.push({ text: raw.slice(i), leftAbut: prevAbutted, rightAbut: false });
      break;
    }
    chunks.push({ text: raw.slice(i, dollar), leftAbut: prevAbutted, rightAbut: true });
    // Skip past the matching `}` for this interpolation.
    let depth = 1;
    let j = dollar + 2;
    for (; j < raw.length && depth > 0; j++) {
      if (raw[j] === "{") depth++;
      else if (raw[j] === "}") depth--;
    }
    i = j;
    prevAbutted = true;
  }
  const out: string[] = [];
  for (const c of chunks) {
    const parts = c.text.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    // The first token is only glued to the previous `${...}` when the
    // text has no leading whitespace AND this chunk follows an
    // interpolation. The last token is only glued to the next `${...}`
    // when the text has no trailing whitespace AND this chunk precedes
    // an interpolation.
    const startsWithSpace = /^\s/.test(c.text);
    const endsWithSpace = /\s$/.test(c.text);
    const firstGlued = c.leftAbut && !startsWithSpace;
    const lastGlued = c.rightAbut && !endsWithSpace;
    for (let k = 0; k < parts.length; k++) {
      const isFirst = k === 0;
      const isLast = k === parts.length - 1;
      if (isFirst && firstGlued) continue;
      if (isLast && lastGlued) continue;
      out.push(parts[k]);
    }
  }
  return out;
}

// Every occurrence of `className=` in a TSX file. Captures the argument,
// which is one of:
//   className="foo bar"
//   className='foo bar'
//   className={`foo ${x} bar`}
//   className={"foo"}
//   className={cond ? "foo" : "bar"}
//   className={styles.x}
// We only need the literal parts; interpolations and identifier references
// contribute no class names to check here.
function extractLiteralClasses(source: string): Set<string> {
  const hits = new Set<string>();

  // "..." or '...' string literals immediately after className=
  const attr = /className\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of source.matchAll(attr)) {
    const text = m[1] ?? m[2] ?? "";
    for (const cls of text.split(/\s+/)) if (cls) hits.add(cls);
  }

  // className={ ... } — the expression can be a ternary, a template
  // literal, a concat, or a mix. Template literals get their literal
  // segments (between ${...} chunks) extracted; ternary/concat branches
  // yield plain string literals. Strings that live inside a template
  // literal's ${...} are not class names in their own right (they are
  // substituted into a surrounding literal), so template literals are
  // stripped out before scanning the remainder for standalone strings.
  const bracedStarts = /className\s*=\s*\{/g;
  for (const m of source.matchAll(bracedStarts)) {
    const expr = readBraced(source, m.index! + m[0].length - 1);
    if (expr === null) continue;

    // Collect literal segments from each template literal. A segment
    // adjacent to a `${...}` interpolation without a whitespace boundary
    // is a class-name prefix (e.g. the `block-heading--h` in
    // `block-heading--h${level}`), so its trailing/leading token is
    // dropped: only whole class-name tokens are recorded.
    for (const s of expr.matchAll(/`([^`]*)`/g)) {
      const raw = s[1];
      for (const cls of tokensFromTemplate(raw)) hits.add(cls);
    }

    // Then strip templates and pick up any remaining standalone strings
    // (ternary branches, concatenations). Strings that are the right-hand
    // side of an (in)equality comparison (`x === "planned"`) or the
    // subject of a member lookup are not class names; drop them first so
    // the extractor does not falsely flag them.
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

// Every class selector `.x` in a stylesheet, including `:global(.x)`.
function extractCssClasses(css: string): Set<string> {
  const hits = new Set<string>();
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of stripped.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) {
    hits.add(m[1]);
  }
  return hits;
}

describe("no unstyled global class names", () => {
  it("every class name used as a string in src/ has a rule in a stylesheet under src/", () => {
    const tsxFiles = walk(srcRoot, ".tsx", []);
    const cssFiles = walk(srcRoot, ".css", []).filter((p) => !p.endsWith(".d.css.ts"));

    const defined = new Set<string>();
    for (const f of cssFiles) {
      for (const cls of extractCssClasses(readFileSync(f, "utf8"))) defined.add(cls);
    }

    const used = new Map<string, string[]>();
    for (const f of tsxFiles) {
      const cls = extractLiteralClasses(readFileSync(f, "utf8"));
      for (const c of cls) {
        // Skip identifiers that are common non-class tokens sometimes fed
        // to className (e.g. the empty string, or `undefined` from a
        // template concat we didn't fully strip). Class names contain
        // only [A-Za-z0-9_-] and never end on a `-` (that only happens as
        // the literal prefix of a `${var}` interpolation).
        if (!/^[A-Za-z_][A-Za-z0-9_-]*[A-Za-z0-9_]$/.test(c) && !/^[A-Za-z_]$/.test(c)) continue;
        const arr = used.get(c) ?? [];
        arr.push(relative(srcRoot, f));
        used.set(c, arr);
      }
    }

    // Guard the extractor: at least one well-known class must show up in
    // both sets, otherwise the check is silently passing.
    expect(used.has("frost")).toBe(true);
    expect(defined.has("frost")).toBe(true);

    const missing: string[] = [];
    for (const [cls, files] of used) {
      if (!defined.has(cls)) missing.push(`${cls} (in ${[...new Set(files)].join(", ")})`);
    }
    expect(missing).toEqual([]);
  });

  it("extractor picks up class tokens from string literals, ternaries, and template literals", () => {
    const source =
      'const a = <div className="frost countdown" />;\n' +
      'const b = <div className={cond ? "leaderboard" : "hero"} />;\n' +
      'const c = <div className={`countdown ${styles.x} block-quote`} />;\n' +
      'const d = <div className={mapType === "terrain" ? "hero" : "frost"} />;\n';
    const tokens = extractLiteralClasses(source);
    expect(tokens.has("frost")).toBe(true);
    expect(tokens.has("countdown")).toBe(true);
    expect(tokens.has("leaderboard")).toBe(true);
    expect(tokens.has("hero")).toBe(true);
    expect(tokens.has("block-quote")).toBe(true);
    // "terrain" is a comparison operand, not a class name.
    expect(tokens.has("terrain")).toBe(false);
  });
});
