// docs/site.md section 8.4. The theme registry mirrors the contract's
// enum; `resolveOfferedThemes` filters unknown keys and falls back to the
// whole registry on an empty result; `resolveDefaultTheme` picks the
// requested key when it is offered.

import { describe, it, expect } from "vitest";
import {
  THEMES,
  THEME_KEYS,
  resolveOfferedThemes,
  resolveDefaultTheme,
} from "../../../src/map/themes";

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
