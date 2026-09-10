// docs/site.md section 7.7. Optional per-browser overrides for the theme
// tokens: accent, surface, and font pairing. Applied on top of the
// document theme; persisted in localStorage.

import { useCallback, useSyncExternalStore } from "react";
import { storageGet, storageSet } from "../../lib/storage";

export const ACCENT_KEYS = ["red", "green", "gold", "blue"] as const;
export const SURFACE_KEYS = ["snow", "night", "forest"] as const;
export const FONT_KEYS = ["festive", "classic", "modern"] as const;

export type AccentKey = (typeof ACCENT_KEYS)[number];
export type SurfaceKey = (typeof SURFACE_KEYS)[number];
export type FontKey = (typeof FONT_KEYS)[number];

export type ThemeOverrides = {
  accent: AccentKey | null;
  surface: SurfaceKey | null;
  fonts: FontKey | null;
};

const KEY_ACCENT = "wmsfo.theme.accent";
const KEY_SURFACE = "wmsfo.theme.surface";
const KEY_FONTS = "wmsfo.theme.fonts";

let cached: ThemeOverrides = readFromStorage();

function readFromStorage(): ThemeOverrides {
  const accent = storageGet(KEY_ACCENT);
  const surface = storageGet(KEY_SURFACE);
  const fonts = storageGet(KEY_FONTS);
  return {
    accent: (ACCENT_KEYS as readonly string[]).includes(accent ?? "") ? (accent as AccentKey) : null,
    surface: (SURFACE_KEYS as readonly string[]).includes(surface ?? "") ? (surface as SurfaceKey) : null,
    fonts: (FONT_KEYS as readonly string[]).includes(fonts ?? "") ? (fonts as FontKey) : null,
  };
}

function getSnapshot(): ThemeOverrides {
  return cached;
}

function updateCache() {
  cached = readFromStorage();
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function applyOverridesToDocument(doc: Document = document): void {
  const o = cached;
  const html = doc.documentElement;
  if (o.accent !== null) html.setAttribute("data-accent", o.accent);
  if (o.surface !== null) html.setAttribute("data-surface", o.surface);
  if (o.fonts !== null) html.setAttribute("data-fonts", o.fonts);
}

export function useThemeOverrides() {
  const overrides = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setAccent = useCallback((v: AccentKey) => {
    storageSet(KEY_ACCENT, v);
    document.documentElement.setAttribute("data-accent", v);
    updateCache();
  }, []);
  const setSurface = useCallback((v: SurfaceKey) => {
    storageSet(KEY_SURFACE, v);
    document.documentElement.setAttribute("data-surface", v);
    updateCache();
  }, []);
  const setFonts = useCallback((v: FontKey) => {
    storageSet(KEY_FONTS, v);
    document.documentElement.setAttribute("data-fonts", v);
    updateCache();
  }, []);

  return { overrides, setAccent, setSurface, setFonts };
}
