// docs/site.md sections 7.7 and 8.4. The viewer's chosen tracker theme key.
// localStorage["wmsfo.tracker.theme"] is the truth, read and written
// through lib/storage; the key is also held in memory, so a blocked
// storage still keeps it for the page load. Every write tells the
// subscribeThemeKey listeners: the live map follows a write from the
// account sync (src/account/preferences.ts) that lands after it mounted,
// and the sync saves a pick made in the tracker menu. This module sits in
// the `theme` chunk (vite.config.ts) so the index chunk reaches it without
// the map chunk.

import { storageGet, storageRemove, storageSet } from "../../lib/storage";

export const THEME_STORAGE_KEY = "wmsfo.tracker.theme";

let memory: string | null = null;
const listeners = new Set<() => void>();

// The stored key, else the memory copy, else null.
export function readThemeKey(): string | null {
  return storageGet(THEME_STORAGE_KEY) ?? memory;
}

// Stores the key; null removes it.
export function writeThemeKey(key: string | null): void {
  memory = key;
  if (key === null) storageRemove(THEME_STORAGE_KEY);
  else storageSet(THEME_STORAGE_KEY, key);
  for (const l of [...listeners]) l();
}

export function subscribeThemeKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetThemeKeyForTests(): void {
  memory = null;
  storageRemove(THEME_STORAGE_KEY);
}
