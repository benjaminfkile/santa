// docs/site.md section 8.5. The viewer's flight history and time labels
// choices for the page load. The map section seeds its toggles from here
// and falls back to the content defaults only until the viewer has chosen,
// so a remount of the section (a live flip, the unavailable panel's retry)
// keeps what the viewer picked. Nothing is persisted.

export type TrackerToggleKey = "flightHistory" | "timeLabels";

const choices: Partial<Record<TrackerToggleKey, boolean>> = {};

export function readTrackerToggle(key: TrackerToggleKey, fallback: boolean): boolean {
  return choices[key] ?? fallback;
}

export function writeTrackerToggle(key: TrackerToggleKey, value: boolean): void {
  choices[key] = value;
}

export function resetTrackerTogglesForTests(): void {
  delete choices.flightHistory;
  delete choices.timeLabels;
}
