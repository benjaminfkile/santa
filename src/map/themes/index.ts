// docs/site.md section 8.4. The theme registry: six JSON style arrays and
// the overlay palette each carries. `THEME_KEYS` mirrors the enum in
// contracts/schema/sections/map.schema.json.

import { standardTheme } from "./standard";
import { expeditionTheme } from "./expedition";
import { blizzardTheme } from "./blizzard";
import { charcoalTheme } from "./charcoal";
import { nightTheme } from "./night";
import { nebulaTheme } from "./nebula";

export const THEME_KEYS = [
  "standard",
  "expedition",
  "blizzard",
  "charcoal",
  "night",
  "nebula",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export type MapTheme = {
  key: ThemeKey;
  label: string;
  styles: google.maps.MapTypeStyle[];
  routeColor: string;
  routeOpacity: number;
  arrowColor: string;
  timeLabelBg: string;
  timeLabelFg: string;
  timeLabelOpacity: number;
  userColor: string;
  // What the tracker's pills, panels, tiles, and buttons paint with while
  // this style is on (the legacy tracker's per-theme colours): the map
  // section rebinds the site's surface tokens to these.
  chrome: {
    bg: string;      // pills and buttons
    fg: string;      // their secondary text and glyphs
    text: string;    // their primary text
    tile: string;    // menu tiles and toggles
    tileFg: string;  // text on a tile
    panel: string;   // the menu card
    accent: string;  // the active underline and the accent
  };
};

export const THEMES: Record<ThemeKey, MapTheme> = {
  standard: standardTheme,
  expedition: expeditionTheme,
  blizzard: blizzardTheme,
  charcoal: charcoalTheme,
  night: nightTheme,
  nebula: nebulaTheme,
};

export function resolveOfferedThemes(
  offered: readonly string[] | null | undefined,
): MapTheme[] {
  const filtered = (offered ?? [])
    .filter((k): k is ThemeKey => (THEME_KEYS as readonly string[]).includes(k))
    .map((k) => THEMES[k]);
  if (filtered.length === 0) return THEME_KEYS.map((k) => THEMES[k]);
  return filtered;
}

export function resolveDefaultTheme(
  key: string | null | undefined,
  offered: MapTheme[],
): MapTheme {
  if (key !== null && key !== undefined) {
    const found = offered.find((t) => t.key === key);
    if (found !== undefined) return found;
  }
  return offered[0] ?? THEMES.standard;
}
