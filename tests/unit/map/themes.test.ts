// docs/site.md sections 8.4, 22.1. The theme registry mirrors the contract's
// enum; `resolveOfferedThemes` filters unknown keys and falls back to the
// whole registry on an empty result; `resolveDefaultTheme` picks the
// requested key when it is offered. Every theme's chrome text on chrome bg
// and tile text on tile background clear WCAG 4.5:1.

import { describe, it, expect } from "vitest";
import {
  THEMES,
  THEME_KEYS,
  resolveOfferedThemes,
  resolveDefaultTheme,
} from "../../../src/map/themes";

type Rgb = { r: number; g: number; b: number; a: number };

function parseHex(hex: string): Rgb {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
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

describe("theme registry", () => {
  it("has all six keys", () => {
    expect([...THEME_KEYS]).toEqual([
      "standard",
      "expedition",
      "blizzard",
      "charcoal",
      "night",
      "nebula",
    ]);
    for (const k of THEME_KEYS) expect(THEMES[k]?.key).toBe(k);
  });
});

describe("resolveOfferedThemes", () => {
  it("returns the whole registry when no keys are supplied", () => {
    const list = resolveOfferedThemes(null);
    expect(list.map((t) => t.key)).toEqual([...THEME_KEYS]);
  });

  it("filters unknown keys", () => {
    const list = resolveOfferedThemes(["standard", "unknown", "night"] as string[]);
    expect(list.map((t) => t.key)).toEqual(["standard", "night"]);
  });

  it("falls back to the whole registry when no known keys remain", () => {
    const list = resolveOfferedThemes(["nope"] as string[]);
    expect(list.map((t) => t.key)).toEqual([...THEME_KEYS]);
  });
});

describe("resolveDefaultTheme", () => {
  it("returns the requested key when offered", () => {
    const offered = resolveOfferedThemes(["standard", "night"] as string[]);
    expect(resolveDefaultTheme("night", offered).key).toBe("night");
  });

  it("falls back to the first offered when the key is missing", () => {
    const offered = resolveOfferedThemes(["standard", "night"] as string[]);
    expect(resolveDefaultTheme("blizzard", offered).key).toBe("standard");
  });

  it("falls back to the first offered when the key is null", () => {
    const offered = resolveOfferedThemes(["night", "charcoal"] as string[]);
    expect(resolveDefaultTheme(null, offered).key).toBe("night");
  });
});

describe("theme chrome contrast", () => {
  const THRESHOLD = 4.5;
  for (const key of THEME_KEYS) {
    it(`${key}: chrome.text on chrome.bg and chrome.tileFg on chrome.tile are at 4.5:1 or better`, () => {
      const { chrome } = THEMES[key];
      const bg = parseHex(chrome.bg);
      const text = parseHex(chrome.text);
      const compositedText = text.a < 1 ? overOpaque(text, bg) : text;
      const textRatio = contrastRatio(compositedText, bg);
      expect(textRatio, `${key}: chrome.text on chrome.bg = ${textRatio.toFixed(2)}`).toBeGreaterThanOrEqual(THRESHOLD);

      const tile = parseHex(chrome.tile);
      const tileFg = parseHex(chrome.tileFg);
      const compositedTileFg = tileFg.a < 1 ? overOpaque(tileFg, tile) : tileFg;
      const tileRatio = contrastRatio(compositedTileFg, tile);
      expect(tileRatio, `${key}: chrome.tileFg on chrome.tile = ${tileRatio.toFixed(2)}`).toBeGreaterThanOrEqual(THRESHOLD);
    });
  }
});
