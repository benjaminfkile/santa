// docs/site.md section 8.5. The viewer's tracker choices: flight history,
// time labels, viewpoints, the flight gauge shown or hidden, the cookie
// tally open or collapsed, the map type (terrain or road), and the live
// screen's snow (seasonalLayers.tsx reads and writes that one). They live
// in localStorage["wmsfo.tracker.settings"] as one JSON object, read and
// written through lib/storage, so a refresh, a remount of the section (a
// live flip, the unavailable panel's retry), and the next visit all keep
// what the viewer picked. A choice is also held in memory, so a blocked
// storage still keeps it for the page load. The content default applies
// only until the viewer has chosen. Every write tells the
// subscribeTrackerSettings listeners, so the live screen's toggles, the
// cookie tally, and the snow layer follow a replace from the account sync
// (src/account/preferences.ts) that lands after they mounted.

import { useSyncExternalStore } from "react";
import { storageGet, storageRemove, storageSet } from "../../../lib/storage";
import type { TrackerPreferences } from "../../../api/preferences";

export const TRACKER_SETTINGS_KEY = "wmsfo.tracker.settings";

export type TrackerToggleKey =
  | "flightHistory"
  | "timeLabels"
  | "landmarks"
  | "flightDock"
  | "cookieTally"
  | "snow";

export type TrackerMapType = "terrain" | "roadmap";

type TrackerSettings = Partial<Record<TrackerToggleKey, boolean>> & { mapType?: TrackerMapType };

const TOGGLE_KEYS: readonly TrackerToggleKey[] = [
  "flightHistory",
  "timeLabels",
  "landmarks",
  "flightDock",
  "cookieTally",
  "snow",
];

let memory: TrackerSettings = {};
const listeners = new Set<() => void>();

function stored(): TrackerSettings {
  const raw = storageGet(TRACKER_SETTINGS_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? (parsed as TrackerSettings) : {};
  } catch {
    return {};
  }
}

function settings(): TrackerSettings {
  return { ...memory, ...stored() };
}

function save(next: TrackerSettings): void {
  memory = next;
  storageSet(TRACKER_SETTINGS_KEY, JSON.stringify(next));
  for (const l of [...listeners]) l();
}

// The known keys of an object with a valid value; anything else is dropped,
// `theme` among them: the tracker theme key lives under its own storage key
// (map/themes/themeKey.ts) and the account sync joins the two.
function known(source: unknown): TrackerPreferences {
  const out: TrackerPreferences = {};
  if (source === null || typeof source !== "object") return out;
  const values = source as Record<string, unknown>;
  for (const key of TOGGLE_KEYS) {
    const value = values[key];
    if (typeof value === "boolean") out[key] = value;
  }
  if (values.mapType === "terrain" || values.mapType === "roadmap") out.mapType = values.mapType;
  return out;
}

// The stored choices as one object, known keys only.
export function readTrackerSettings(): TrackerPreferences {
  return known(settings());
}

// Writes the whole object: a key absent from `next` is removed.
export function replaceTrackerSettings(next: TrackerPreferences): void {
  save(known(next));
}

// Called after every write: the per-key writers, the map type writer, the
// remove, and the replace.
export function subscribeTrackerSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readTrackerToggle(key: TrackerToggleKey, fallback: boolean): boolean {
  const value = settings()[key];
  return typeof value === "boolean" ? value : fallback;
}

export function writeTrackerToggle(key: TrackerToggleKey, value: boolean): void {
  save({ ...settings(), [key]: value });
}

// Whether the viewer has chosen this toggle (true or false) at all.
export function hasTrackerToggle(key: TrackerToggleKey): boolean {
  return typeof settings()[key] === "boolean";
}

export function removeTrackerToggle(key: TrackerToggleKey): void {
  const next = { ...settings() };
  delete next[key];
  save(next);
}

export function readTrackerMapType(fallback: TrackerMapType): TrackerMapType {
  const value = settings().mapType;
  return value === "terrain" || value === "roadmap" ? value : fallback;
}

export function writeTrackerMapType(value: TrackerMapType): void {
  save({ ...settings(), mapType: value });
}

// The stored toggle, else `fallback`, re-read on every write.
export function useTrackerToggle(key: TrackerToggleKey, fallback: boolean): boolean {
  const read = () => readTrackerToggle(key, fallback);
  return useSyncExternalStore(subscribeTrackerSettings, read, read);
}

// The stored map type, else `fallback`, re-read on every write.
export function useTrackerMapType(fallback: TrackerMapType): TrackerMapType {
  const read = () => readTrackerMapType(fallback);
  return useSyncExternalStore(subscribeTrackerSettings, read, read);
}

export function resetTrackerTogglesForTests(): void {
  memory = {};
  storageRemove(TRACKER_SETTINGS_KEY);
}
