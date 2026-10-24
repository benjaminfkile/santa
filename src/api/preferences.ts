// docs/site.md sections 7.7 and 12. A signed-in person's theme and tracker
// choices, saved whole with `PUT /me/preferences` (contracts 4.4: both keys
// required, no other key). They are read back as `preferences` on `GET /me`
// (subscriptions.ts). src/account/preferences.ts is the only caller.

import { api } from "./client";
import type { components } from "../contracts";

type TrackerPreferencesDto = components["schemas"]["TrackerPreferencesDto"];

// The schema's tracker object (me-preferences.schema.json): every key
// optional, booleans, the map type, and the tracker theme's key, never null.
export type TrackerPreferences = {
  [K in Exclude<keyof TrackerPreferencesDto, "mapType" | "theme">]?: boolean;
} & { mapType?: "terrain" | "roadmap"; theme?: string };

export type Preferences = {
  theme: "light" | "dark" | null;
  tracker: TrackerPreferences;
};

export function putPreferences(prefs: Preferences): Promise<void> {
  return api<void>("/me/preferences", { method: "PUT", auth: true, body: prefs });
}
