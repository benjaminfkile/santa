// The six seeded Google themes as the loader gives them, built from the
// contracts fixtures (contracts/fixtures/themes: the seed rows and the
// style arrays), each with a `getStyle` that resolves its array at once.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MapTheme } from "../../../src/map/themes";

const SEED_DIR = resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "themes");

type SeedRow = Pick<
  MapTheme,
  "key" | "name" | "renderer" | "overlay" | "chrome" | "defaultLightMode" | "defaultDarkMode"
>;

export const SEEDED_KEYS = ["standard", "expedition", "blizzard", "charcoal", "night", "nebula"] as const;
export type SeededKey = (typeof SEEDED_KEYS)[number];

export function seededStyle(key: SeededKey): google.maps.MapTypeStyle[] {
  return JSON.parse(readFileSync(resolve(SEED_DIR, `${key}.json`), "utf8")) as google.maps.MapTypeStyle[];
}

const rows = JSON.parse(readFileSync(resolve(SEED_DIR, "seed.json"), "utf8")) as SeedRow[];

function seeded(key: SeededKey): MapTheme {
  const row = rows.find((r) => r.key === key && r.renderer === "google");
  if (row === undefined) throw new Error(`no seeded google theme ${key}`);
  const style = seededStyle(key);
  return {
    key,
    renderer: "google",
    name: row.name,
    styleUrl: `https://cdn.example/themes/${key}.json`,
    spriteUrl: null,
    thumbnailMediaId: null,
    defaultLightMode: row.defaultLightMode,
    defaultDarkMode: row.defaultDarkMode,
    overlay: row.overlay,
    chrome: row.chrome,
    getStyle: () => Promise.resolve(style),
  };
}

export const SEEDED: Record<SeededKey, MapTheme> = Object.fromEntries(
  SEEDED_KEYS.map((k) => [k, seeded(k)]),
) as Record<SeededKey, MapTheme>;
