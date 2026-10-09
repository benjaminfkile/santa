// docs/site.md section 8.4. The tracker themes are rows the admin panel
// manages; the snapshot carries the event's enabled ones in admin order as
// `trackerThemes`, and this module maps them to `MapTheme`. A theme's style
// body is fetched from its `styleUrl` on the first `getStyle()` call and
// kept for the page; a failed fetch rejects and the next call fetches again.
// `resolveInitialTheme` picks the starting theme of a renderer: the stored
// key when it names one of that renderer's themes, then the holder of the
// appearance's default flag, then the first in list order.
// `resolveDefaultTheme` is the same order without the stored key, the
// route preview's choice (8.9): the stored tracker theme plays no part there.

import type { StyleSpecification } from "maplibre-gl";
import type { Snapshot } from "../../contracts";
import { storageGet } from "../../lib/storage";
import type { Renderer } from "../renderer";

export const THEME_STORAGE_KEY = "wmsfo.tracker.theme";

export type ThemeStyle = google.maps.MapTypeStyle[] | StyleSpecification;

export type MapTheme = {
  key: string;                        // the row's slug; what the stored choice names
  renderer: Renderer;
  name: string;                       // the menu's nickname
  styleUrl: string;                   // the style body on the CDN, immutable
  spriteUrl: string | null;           // MapLibre only
  thumbnailMediaId: string | null;    // resolved through snapshot.media
  defaultLightMode: boolean;
  defaultDarkMode: boolean;
  overlay: {
    routeColor: string;
    routeOpacity: number;
    arrowColor: string;
    timeLabelBg: string;
    timeLabelFg: string;
    timeLabelOpacity: number;
    userColor: string;
  };
  // What the tracker's pills, panels, tiles, and buttons paint with while
  // this style is on: the map section rebinds the site's surface tokens to
  // these.
  chrome: {
    bg: string;      // pills and buttons
    fg: string;      // their secondary text and glyphs
    text: string;    // their primary text
    tile: string;    // menu tiles and toggles
    tileFg: string;  // text on a tile
    panel: string;   // the menu card
    accent: string;  // the active underline and the accent
  };
  getStyle(): Promise<ThemeStyle>;
};

type ThemeRow = NonNullable<Snapshot["trackerThemes"]>[number];

// One fetch per style URL per page: the URL names an immutable body.
const styleBodies = new Map<string, Promise<ThemeStyle>>();

function fetchStyle(url: string): Promise<ThemeStyle> {
  const cached = styleBodies.get(url);
  if (cached !== undefined) return cached;
  const pending = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Map style ${res.status} from ${url}`);
    return (await res.json()) as ThemeStyle;
  })();
  styleBodies.set(url, pending);
  pending.catch(() => {
    if (styleBodies.get(url) === pending) styleBodies.delete(url);
  });
  return pending;
}

function toTheme(row: ThemeRow): MapTheme {
  const styleUrl = row.styleUrl ?? "";
  const o = row.overlay ?? {};
  const c = row.chrome ?? {};
  return {
    key: row.key ?? "",
    renderer: row.renderer === "maplibre" ? "maplibre" : "google",
    name: row.name ?? row.key ?? "",
    styleUrl,
    spriteUrl: row.spriteUrl ?? null,
    thumbnailMediaId: row.thumbnailMediaId ?? null,
    defaultLightMode: row.defaultLightMode === true,
    defaultDarkMode: row.defaultDarkMode === true,
    overlay: {
      routeColor: o.routeColor ?? "",
      routeOpacity: o.routeOpacity ?? 1,
      arrowColor: o.arrowColor ?? "",
      timeLabelBg: o.timeLabelBg ?? "",
      timeLabelFg: o.timeLabelFg ?? "",
      timeLabelOpacity: o.timeLabelOpacity ?? 1,
      userColor: o.userColor ?? "",
    },
    chrome: {
      bg: c.bg ?? "",
      fg: c.fg ?? "",
      text: c.text ?? "",
      tile: c.tile ?? "",
      tileFg: c.tileFg ?? "",
      panel: c.panel ?? "",
      accent: c.accent ?? "",
    },
    getStyle: () => fetchStyle(styleUrl),
  };
}

export function loadThemes(
  snapshot: Pick<Snapshot, "trackerThemes"> | null | undefined,
): MapTheme[] {
  return (snapshot?.trackerThemes ?? [])
    .filter((row) => typeof row.key === "string" && row.key !== "" && typeof row.styleUrl === "string")
    .map(toTheme);
}

export function themesFor(themes: readonly MapTheme[], renderer: Renderer): MapTheme[] {
  return themes.filter((t) => t.renderer === renderer);
}

export function resolveInitialTheme(
  themes: readonly MapTheme[],
  renderer: Renderer,
  appearance: "light" | "dark",
): MapTheme | null {
  const offered = themesFor(themes, renderer);
  const stored = storageGet(THEME_STORAGE_KEY);
  if (stored !== null) {
    const found = offered.find((t) => t.key === stored);
    if (found !== undefined) return found;
  }
  return resolveDefaultTheme(offered, renderer, appearance);
}

export function resolveDefaultTheme(
  themes: readonly MapTheme[],
  renderer: Renderer,
  appearance: "light" | "dark",
): MapTheme | null {
  const offered = themesFor(themes, renderer);
  const flagged = offered.find((t) =>
    appearance === "dark" ? t.defaultDarkMode : t.defaultLightMode,
  );
  return flagged ?? offered[0] ?? null;
}
