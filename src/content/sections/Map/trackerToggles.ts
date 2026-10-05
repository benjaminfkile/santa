// docs/site.md section 8.5. The viewer's tracker choices for the page load:
// flight history, time labels, landmarks, the flight gauge shown or
// hidden, which instrument the gauge is showing, and the cookie tally open
// or collapsed. The map section seeds its toggles from
// here and falls back to its defaults only until the viewer has chosen, so
// a remount of the section (a live flip, the unavailable panel's retry)
// keeps what the viewer picked. Nothing is persisted.

export type TrackerToggleKey =
  | "flightHistory"
  | "timeLabels"
  | "landmarks"
  | "flightDock"
  | "cookieTally";

const choices: Partial<Record<TrackerToggleKey, boolean>> = {};

export function readTrackerToggle(key: TrackerToggleKey, fallback: boolean): boolean {
  return choices[key] ?? fallback;
}

export function writeTrackerToggle(key: TrackerToggleKey, value: boolean): void {
  choices[key] = value;
}

export function resetTrackerTogglesForTests(): void {
  gaugeSlot = null;
  delete choices.flightHistory;
  delete choices.timeLabels;
  delete choices.landmarks;
  delete choices.flightDock;
  delete choices.cookieTally;
}

// Which instrument the flight gauge is showing. Kept beside the toggles
// and reset with them; the gauge falls back to the first instrument its
// flags leave on when the remembered one is off.
export type GaugeSlotKey = "speed" | "altitude" | "heading";

let gaugeSlot: GaugeSlotKey | null = null;

export function readGaugeSlot(fallback: GaugeSlotKey): GaugeSlotKey {
  return gaugeSlot ?? fallback;
}

export function writeGaugeSlot(key: GaugeSlotKey): void {
  gaugeSlot = key;
}
