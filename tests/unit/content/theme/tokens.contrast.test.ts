// docs/site.md section 7.7. Parses tokens.css and fails the build when any
// text token on any surface token drops under 4.5:1, or a status token on
// --panel under 3:1.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, "../../../../src/content/theme/tokens.css");
const css = readFileSync(tokensPath, "utf8");

type Rgb = { r: number; g: number; b: number; a: number };

function parseColor(input: string, palette: Map<string, string>): Rgb {
  let value = input.trim();
  // resolve var() (support one level of substitution using the palette)
  while (value.startsWith("var(")) {
    const inner = value.slice(4, value.lastIndexOf(")"));
    const [name] = inner.split(",").map((s) => s.trim());
    const resolved = palette.get(name);
    if (!resolved) throw new Error(`cannot resolve ${value}`);
    value = resolved.trim();
  }
  if (value.startsWith("#")) return parseHex(value);
  if (value.startsWith("rgb")) return parseRgb(value);
  throw new Error(`unrecognized colour literal: ${value}`);
}

function parseHex(hex: string): Rgb {
  const s = hex.slice(1);
  if (s.length === 3) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
      a: 1,
    };
  }
  if (s.length === 6) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
      a: 1,
    };
  }
  if (s.length === 8) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
      a: parseInt(s.slice(6, 8), 16) / 255,
    };
  }
  throw new Error(`bad hex: ${hex}`);
}

function parseRgb(input: string): Rgb {
  const m = input.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`bad rgb: ${input}`);
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map((s) => s.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts[3] !== undefined ? Number(parts[3]) : 1;
  return { r, g, b, a };
}

function overOpaque(fg: Rgb, bg: Rgb): Rgb {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function parseBlock(selector: string): Map<string, string> {
  const pattern = new RegExp(
    `^\\s*${selector.replace(/[[\]"]/g, (m) => `\\${m}`)}\\s*\\{`,
    "m",
  );
  const match = pattern.exec(css);
  if (!match) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", match.index);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  const map = new Map<string, string>();
  for (const line of body.split("\n")) {
    const trimmed = line.trim().replace(/;$/, "");
    if (!trimmed.startsWith("--")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    map.set(trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim());
  }
  return map;
}

type Palette = { name: string; tokens: Map<string, string>; ground: Rgb };

function loadPalette(selector: "dark" | "light"): Palette {
  const tokens = parseBlock(`:root[data-theme="${selector}"]`);
  return {
    name: selector,
    tokens,
    ground: parseColor(tokens.get("--panel") ?? "", tokens),
  };
}

const TEXT_TOKENS = ["--text", "--text-bright", "--text-dim"] as const;
const SURFACE_TOKENS = ["--ground", "--panel", "--panel-2"] as const;
const STATUS_TOKENS = ["--ok", "--warn", "--err", "--accent"] as const;

const TEXT_THRESHOLD = 4.5;
const STATUS_THRESHOLD = 3;

export function checkPaletteContrast(
  palette: Palette,
  overrides?: Partial<Record<string, string>>,
): string[] {
  const problems: string[] = [];
  const resolve = (name: string) => {
    const override = overrides?.[name];
    const value = override ?? palette.tokens.get(name);
    if (!value) throw new Error(`missing token ${name} in ${palette.name}`);
    return parseColor(value, palette.tokens);
  };
  for (const surfaceName of SURFACE_TOKENS) {
    const surface = resolve(surfaceName);
    for (const textName of TEXT_TOKENS) {
      const fg = resolve(textName);
      const composited = fg.a < 1 ? overOpaque(fg, surface) : fg;
      const ratio = contrastRatio(composited, surface);
      if (ratio < TEXT_THRESHOLD) {
        problems.push(
          `${palette.name}: ${textName} on ${surfaceName} = ${ratio.toFixed(2)} (< ${TEXT_THRESHOLD})`,
        );
      }
    }
  }
  const panel = resolve("--panel");
  for (const statusName of STATUS_TOKENS) {
    const status = resolve(statusName);
    const composited = status.a < 1 ? overOpaque(status, panel) : status;
    const ratio = contrastRatio(composited, panel);
    if (ratio < STATUS_THRESHOLD) {
      problems.push(
        `${palette.name}: ${statusName} on --panel = ${ratio.toFixed(2)} (< ${STATUS_THRESHOLD})`,
      );
    }
  }
  const accent = resolve("--accent");
  const onAccent = resolve("--on-accent");
  const onAccentComposited = onAccent.a < 1 ? overOpaque(onAccent, accent) : onAccent;
  const onAccentRatio = contrastRatio(onAccentComposited, accent);
  if (onAccentRatio < TEXT_THRESHOLD) {
    problems.push(
      `${palette.name}: --on-accent on --accent = ${onAccentRatio.toFixed(2)} (< ${TEXT_THRESHOLD})`,
    );
  }
  return problems;
}

describe("tokens.css contrast", () => {
  const dark = loadPalette("dark");
  const light = loadPalette("light");

  it("passes for the dark palette", () => {
    expect(checkPaletteContrast(dark)).toEqual([]);
  });

  it("passes for the light palette", () => {
    expect(checkPaletteContrast(light)).toEqual([]);
  });

  it("fails when a text token drops below 4.5:1 (proof: deliberate low contrast)", () => {
    // Replace --text with a value very close to --panel, so the ratio
    // collapses. The palette check must catch it.
    const problems = checkPaletteContrast(dark, { "--text": "#101a30" });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.includes("--text"))).toBe(true);
  });

  it("fails when a status token on --panel drops below 3:1", () => {
    const problems = checkPaletteContrast(light, { "--ok": "#a7bcd0" });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.includes("--ok"))).toBe(true);
  });

  it("fails when --on-accent on --accent drops below 4.5:1", () => {
    // Choose a near-white on-accent while --accent is also near-white:
    // the ratio collapses well below 4.5.
    const problems = checkPaletteContrast(light, {
      "--on-accent": "#eaf3fa",
      "--accent": "#e5eef7",
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.includes("--on-accent"))).toBe(true);
  });
});
