// docs/site.md section 8.5. The viewer's tracker choices for the page load:
// flight history, time labels, the flight data dock shown or hidden, and
// the dock expanded or collapsed. The map section seeds its toggles from
// here and falls back to its defaults only until the viewer has chosen, so
// a remount of the section (a live flip, the unavailable panel's retry)
// keeps what the viewer picked. Nothing is persisted.

export type TrackerToggleKey = "flightHistory" | "timeLabels" | "flightDock" | "flightDockExpanded";

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
  delete choices.flightDock;
  delete choices.flightDockExpanded;
}
