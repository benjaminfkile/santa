// docs/site.md section 7.7. Colour scheme handling. The inline head script
// in index.html stamps data-theme before first paint; this module owns the
// media-query listener, the store/clear functions, the hook that lets
// the ThemeToggle read the resolved value, and one MutationObserver on
// <html> that non-CSS consumers (the map's overlay palette, canvas snow)
// subscribe to.

import { useSyncExternalStore, useCallback } from "react";
import { storageGet, storageSet, storageRemove } from "../../lib/storage";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "wmsfo.theme";

const listeners = new Set<() => void>();
let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

const schemeListeners = new Set<() => void>();
let schemeObserver: MutationObserver | null = null;

function readStoredChoice(): ThemeChoice {
  const v = storageGet(THEME_KEY);
  if (v === "light" || v === "dark") return v;
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  return systemPrefersDark() ? "dark" : "light";
}

function apply(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function setTheme(theme: ResolvedTheme): void {
  storageSet(THEME_KEY, theme);
  apply(theme);
  notify();
}

export function clearTheme(): void {
  storageRemove(THEME_KEY);
  apply(resolveTheme("system"));
  notify();
}

export function getChoice(): ThemeChoice {
  return readStoredChoice();
}

export function getResolved(): ResolvedTheme {
  const attr =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : null;
  if (attr === "light" || attr === "dark") return attr;
  return resolveTheme(getChoice());
}

export function startSystemListener(): void {
  if (typeof window === "undefined") return;
  if (mediaQuery !== null) return;
  // If the head script's catch branch stamped nothing, apply the system
  // resolution now so the tokens resolve.
  if (
    typeof document !== "undefined" &&
    !document.documentElement.hasAttribute("data-theme")
  ) {
    apply(resolveTheme(readStoredChoice()));
  }
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaListener = (e) => {
    if (readStoredChoice() !== "system") return;
    apply(e.matches ? "dark" : "light");
    notify();
  };
  mediaQuery.addEventListener("change", mediaListener);
}

export function stopSystemListener(): void {
  if (mediaQuery !== null && mediaListener !== null) {
    mediaQuery.removeEventListener("change", mediaListener);
  }
  mediaQuery = null;
  mediaListener = null;
}

function ensureSchemeObserver(): void {
  if (typeof document === "undefined") return;
  if (typeof MutationObserver === "undefined") return;
  if (schemeObserver !== null) return;
  schemeObserver = new MutationObserver(() => {
    for (const l of schemeListeners) l();
  });
  schemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

export function subscribeScheme(listener: () => void): () => void {
  ensureSchemeObserver();
  schemeListeners.add(listener);
  return () => {
    schemeListeners.delete(listener);
    if (schemeListeners.size === 0 && schemeObserver !== null) {
      schemeObserver.disconnect();
      schemeObserver = null;
    }
  };
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getChoiceServer = (): ThemeChoice => "system";
const getResolvedServer = (): ResolvedTheme => "light";

export function useThemeChoice(): {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setLight: () => void;
  setDark: () => void;
  followSystem: () => void;
} {
  const choice = useSyncExternalStore(subscribe, getChoice, getChoiceServer);
  const resolved = useSyncExternalStore(subscribe, getResolved, getResolvedServer);
  const setLight = useCallback(() => setTheme("light"), []);
  const setDark = useCallback(() => setTheme("dark"), []);
  const followSystem = useCallback(() => clearTheme(), []);
  return { choice, resolved, setLight, setDark, followSystem };
}
