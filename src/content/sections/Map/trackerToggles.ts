// docs/site.md section 8.5. The viewer's tracker choices: flight history,
// time labels, viewpoints, the flight gauge shown or hidden, the cookie
// tally open or collapsed, and the map type (terrain or road). They live
// in localStorage["wmsfo.tracker.settings"] as one JSON object, read and
// written through lib/storage, so a refresh, a remount of the section (a
// live flip, the unavailable panel's retry), and the next visit all keep
// what the viewer picked. A choice is also held in memory, so a blocked
// storage still keeps it for the page load. The content default applies
// only until the viewer has chosen.

import { storageGet, storageRemove, storageSet } from "../../../lib/storage";

export const TRACKER_SETTINGS_KEY = "wmsfo.tracker.settings";

export type TrackerToggleKey =
  | "flightHistory"
  | "timeLabels"
  | "landmarks"
  | "flightDock"
  | "cookieTally";

export type TrackerMapType = "terrain" | "roadmap";

type TrackerSettings = Partial<Record<TrackerToggleKey, boolean>> & { mapType?: TrackerMapType };

let memory: TrackerSettings = {};

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
}

export function readTrackerToggle(key: TrackerToggleKey, fallback: boolean): boolean {
  const value = settings()[key];
  return typeof value === "boolean" ? value : fallback;
}

export function writeTrackerToggle(key: TrackerToggleKey, value: boolean): void {
  save({ ...settings(), [key]: value });
}

export function readTrackerMapType(fallback: TrackerMapType): TrackerMapType {
  const value = settings().mapType;
  return value === "terrain" || value === "roadmap" ? value : fallback;
}

export function writeTrackerMapType(value: TrackerMapType): void {
  save({ ...settings(), mapType: value });
}

export function resetTrackerTogglesForTests(): void {
  memory = {};
  storageRemove(TRACKER_SETTINGS_KEY);
}
