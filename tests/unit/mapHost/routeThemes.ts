// The two seeded MapLibre themes (`route-light`, `route-dark`) from the
// contracts fixtures: their snapshot rows (`trackerThemes`), their style
// bodies, and a fetch stub that serves each body from its `styleUrl`.
// The seeded Google themes' rows and style arrays are served the same way
// (`googleRow`, GOOGLE_THEME_ROWS: `standard` and `night`).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import type { Snapshot } from "../../../src/contracts";
import type { MapTheme } from "../../../src/map/themes";

const SEED_DIR = resolve(__dirname, "..", "..", "..", "contracts", "fixtures", "themes");

export type RouteKey = "route-light" | "route-dark";

export type ThemeRow = NonNullable<Snapshot["trackerThemes"]>[number];

export function routeStyle(key: RouteKey): StyleSpecification {
  return JSON.parse(readFileSync(resolve(SEED_DIR, `${key}.json`), "utf8")) as StyleSpecification;
}

type SeedRow = Pick<
  MapTheme,
  "key" | "name" | "renderer" | "overlay" | "chrome" | "defaultLightMode" | "defaultDarkMode"
>;

const seed = JSON.parse(readFileSync(resolve(SEED_DIR, "seed.json"), "utf8")) as SeedRow[];

export function styleUrlOf(key: string): string {
  return `https://cdn.example/themes/${key}.json`;
}

export function routeRow(key: RouteKey): ThemeRow {
  const row = seed.find((r) => r.key === key && r.renderer === "maplibre");
  if (row === undefined) throw new Error(`no seeded maplibre theme ${key}`);
  return {
    ...row,
    styleUrl: styleUrlOf(key),
    spriteUrl: null,
    thumbnailMediaId: null,
  } as ThemeRow;
}

// The palettes of a seeded theme.
export function routePalette(key: RouteKey): Pick<MapTheme, "overlay" | "chrome"> {
  const row = routeRow(key) as unknown as Pick<MapTheme, "overlay" | "chrome">;
  return { overlay: row.overlay, chrome: row.chrome };
}

export const ROUTE_THEME_ROWS: ThemeRow[] = [routeRow("route-light"), routeRow("route-dark")];

export type GoogleKey = "standard" | "night" | "charcoal";

export function googleStyle(key: GoogleKey): google.maps.MapTypeStyle[] {
  return JSON.parse(readFileSync(resolve(SEED_DIR, `${key}.json`), "utf8")) as google.maps.MapTypeStyle[];
}

export function googleRow(key: GoogleKey): ThemeRow {
  const row = seed.find((r) => r.key === key && r.renderer === "google");
  if (row === undefined) throw new Error(`no seeded google theme ${key}`);
  return {
    ...row,
    styleUrl: styleUrlOf(key),
    spriteUrl: null,
    thumbnailMediaId: null,
  } as ThemeRow;
}

// The seeded Google themes flagged for light (`standard`) and dark (`night`).
export const GOOGLE_THEME_ROWS: ThemeRow[] = [googleRow("standard"), googleRow("night")];

// A background layer's colour in a style.
export function backgroundOf(style: { layers: { id: string; paint?: unknown }[] }): unknown {
  const layer = style.layers.find((l) => l.id === "background");
  return (layer?.paint as Record<string, unknown> | undefined)?.["background-color"];
}

// Serves every seeded body from its styleUrl, and each of `extra` from
// its URL; any other URL is a 404. `fail` makes every call reject.
export function stubThemeFetch(
  options: { fail?: boolean; extra?: Record<string, StyleSpecification> } = {},
) {
  const bodies = new Map<string, StyleSpecification | google.maps.MapTypeStyle[]>([
    [styleUrlOf("route-light"), routeStyle("route-light")],
    [styleUrlOf("route-dark"), routeStyle("route-dark")],
    [styleUrlOf("standard"), googleStyle("standard")],
    [styleUrlOf("night"), googleStyle("night")],
    [styleUrlOf("charcoal"), googleStyle("charcoal")],
    ...Object.entries(options.extra ?? {}),
  ]);
  const fetchMock = vi.fn(async (url: string) => {
    if (options.fail) throw new Error("style body unreachable");
    const body = bodies.get(url);
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      json: async () => structuredClone(body),
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
