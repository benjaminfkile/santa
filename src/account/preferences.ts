// docs/site.md sections 6.1 step 4 and 7.7. A signed-in person's theme and
// tracker choices follow their account. localStorage stays the truth
// (`wmsfo.theme`, `wmsfo.tracker.settings`, and the tracker theme key under
// its own `wmsfo.tracker.theme`, joined here as `tracker.theme`); the
// server copy is applied once per page load from the `GET /me` answer
// (SubscriptionProvider), and every change while signed in is saved whole
// with one `PUT /me/preferences` 1 s after the last change of a burst. Nothing is sent while signed out,
// during an apply, for the preview session's non-persisted theme, or at
// boot; a failed save is ignored.

import { putPreferences, type Preferences } from "../api/preferences";
import type { Me } from "../api/subscriptions";
import {
  clearTheme,
  getChoice,
  getOverride,
  setTheme,
  subscribeChoice,
} from "../content/theme/colorScheme";
import {
  readTrackerSettings,
  replaceTrackerSettings,
  subscribeTrackerSettings,
} from "../content/sections/Map/trackerToggles";
import { readThemeKey, subscribeThemeKey, writeThemeKey } from "../map/themes/themeKey";

export const PREFERENCES_DEBOUNCE_MS = 1000;

// True while applyServerPreferences writes the stores.
let applying = false;

// The tracker object carries `theme` only while a theme key is stored.
export function localPreferences(): Preferences {
  const choice = getChoice();
  const tracker = readTrackerSettings();
  const themeKey = readThemeKey();
  if (themeKey !== null) tracker.theme = themeKey;
  return { theme: choice === "system" ? null : choice, tracker };
}

// Whether the object holds a choice: a theme other than the system, or any
// tracker key (the tracker theme key among them).
export function hasChoice(p: Preferences): boolean {
  return p.theme !== null || Object.keys(p.tracker).length > 0;
}

// The `preferences` of a `GET /me` answer as a Preferences, or null when
// the account never saved any. Unknown tracker values are dropped by
// replaceTrackerSettings; a tracker theme that is not a string is dropped
// by applyServerPreferences.
export function serverPreferences(me: Me): Preferences | null {
  const p = me.preferences ?? null;
  if (p === null) return null;
  const theme = p.theme === "light" || p.theme === "dark" ? p.theme : null;
  return { theme, tracker: (p.tracker ?? {}) as Preferences["tracker"] };
}

// Writes the server copy to the stores without triggering a save. A
// preview session's non-persisted theme stays on screen. The tracker
// theme key goes to its own store, and a copy without one removes the
// stored key; replaceTrackerSettings keeps it out of the settings object.
export function applyServerPreferences(p: Preferences): void {
  applying = true;
  try {
    const held = getOverride();
    if (p.theme === "light" || p.theme === "dark") setTheme(p.theme);
    else clearTheme();
    if (held !== null) setTheme(held, { persist: false });
    replaceTrackerSettings(p.tracker);
    const themeKey = p.tracker.theme;
    writeThemeKey(typeof themeKey === "string" && themeKey !== "" ? themeKey : null);
  } finally {
    applying = false;
  }
}

// Sends the local copy once; a failure is ignored.
export function pushPreferences(): void {
  putPreferences(localPreferences()).catch(() => {
    // SignInRequired, a 4xx, or a network error: the local copy stays the truth.
  });
}

// Follows the three stores (the theme choice, the tracker settings, and
// the tracker theme key) and saves after a burst of changes while
// `isSignedIn()` holds. Returns the teardown.
export function startPreferencesSync(isSignedIn: () => boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onChange = () => {
    if (applying || !isSignedIn()) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (isSignedIn()) pushPreferences();
    }, PREFERENCES_DEBOUNCE_MS);
  };
  const offChoice = subscribeChoice(onChange);
  const offTracker = subscribeTrackerSettings(onChange);
  const offThemeKey = subscribeThemeKey(onChange);
  return () => {
    offChoice();
    offTracker();
    offThemeKey();
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
