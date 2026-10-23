// docs/site.md sections 6.1 step 4 and 7.7. A signed-in person's theme and
// tracker choices follow their account. localStorage stays the truth
// (`wmsfo.theme` and `wmsfo.tracker.settings`); the server copy is applied
// once per page load from the `GET /me` answer (SubscriptionProvider), and
// every change while signed in is saved whole with one `PUT /me/preferences`
// 1 s after the last change of a burst. Nothing is sent while signed out,
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

export const PREFERENCES_DEBOUNCE_MS = 1000;

// True while applyServerPreferences writes the stores.
let applying = false;

export function localPreferences(): Preferences {
  const choice = getChoice();
  return { theme: choice === "system" ? null : choice, tracker: readTrackerSettings() };
}

// Whether the object holds a choice: a theme other than the system, or any
// tracker key.
export function hasChoice(p: Preferences): boolean {
  return p.theme !== null || Object.keys(p.tracker).length > 0;
}

// The `preferences` of a `GET /me` answer as a Preferences, or null when
// the account never saved any. Unknown tracker values are dropped by
// replaceTrackerSettings.
export function serverPreferences(me: Me): Preferences | null {
  const p = me.preferences ?? null;
  if (p === null) return null;
  const theme = p.theme === "light" || p.theme === "dark" ? p.theme : null;
  return { theme, tracker: (p.tracker ?? {}) as Preferences["tracker"] };
}

// Writes the server copy to the stores without triggering a save. A
// preview session's non-persisted theme stays on screen.
export function applyServerPreferences(p: Preferences): void {
  applying = true;
  try {
    const held = getOverride();
    if (p.theme === "light" || p.theme === "dark") setTheme(p.theme);
    else clearTheme();
    if (held !== null) setTheme(held, { persist: false });
    replaceTrackerSettings(p.tracker);
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

// Follows both stores and saves after a burst of changes while
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
  return () => {
    offChoice();
    offTracker();
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
